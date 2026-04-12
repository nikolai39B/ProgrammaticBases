import * as yaml from 'js-yaml';
import { App } from 'obsidian';
import { ExternalSource } from 'settings';
import {
  HarvestedParams,
  ParamSpecs,
  ResolvedParams,
  buildScopedParams,
  mergeHarvestedParams,
  parseParamSpecs,
} from 'bases/templateParams';
import { parseTemplateRef, ExternalTemplateSource, VaultTemplateSource } from 'bases/templateSource';

type ResolvedRef =
  | { type: 'vault'; source: VaultTemplateSource }
  | { type: 'external'; source: ExternalTemplateSource; content: string };

/**
 * Deserializes YAML files from the Obsidian vault, resolving !sub tags.
 *
 * Files use an optional `pb-metadata:` wrapper. When present, `pb-metadata` is
 * stripped and all remaining top-level keys are used as the resolved value.
 *
 * **Two-pass usage:**
 * - Pass 1 (`collectFileParams` / `collectContentParams`): resolves `!sub` only to
 *   collect all declared params from the template and every nested component.
 *   `!exp`/`!fnc` are no-ops.
 * - Pass 2 (`deserializeFile` / `deserializeContent`): resolves `!sub` + evaluates
 *   `!exp`/`!fnc` with the user-supplied `resolvedParams`.
 *
 * Unqualified !sub refs (e.g. `!sub filter/isTask`) are resolved against the
 * vault `componentsFolder` only.
 *
 * Qualified !sub refs (e.g. `!sub task-base:filter/isTask`) are resolved
 * against the named external source only.
 */
export class VaultDeserializer {
  constructor(
    private app: App,
    private sources: Map<string, ExternalSource>,
    private componentsFolder: string,
    private resolvedParams: ResolvedParams = {},
  ) {}

  //-- Collect Params

  /**
   * Pass 1 entry point for a vault template source.
   * Mirrors {@link deserializeFile} but runs the collect pass instead.
   *
   * @param source - vault template source to harvest params from
   * @returns All discovered params, keyed by param name with sources accumulated.
   */
  async collectFileParams(source: VaultTemplateSource): Promise<HarvestedParams> {
    const discoveredParams: HarvestedParams = {};
    await collectParamsFromResolvedRef(
      { type: 'vault', source },
      this.app,
      new Set(),
      this.sources,
      this.componentsFolder,
      discoveredParams,
      '',
    );
    return discoveredParams;
  }

  /**
   * Pass 1 entry point for an external template source.
   * Mirrors {@link deserializeContent} but runs the collect pass instead.
   *
   * @param source - external template source (used as unique id for circular reference detection)
   * @param content - raw YAML string
   * @returns All discovered params, keyed by param name with sources accumulated.
   */
  async collectContentParams(source: ExternalTemplateSource, content: string): Promise<HarvestedParams> {
    const discoveredParams: HarvestedParams = {};
    await collectParamsFromResolvedRef(
      { type: 'external', source, content },
      this.app,
      new Set(),
      this.sources,
      this.componentsFolder,
      discoveredParams,
      '',
    );
    return discoveredParams;
  }


  //-- Deserialize

  /**
   * Deserializes a vault template source (Pass 2).
   * @param source - vault template source to deserialize
   */
  deserializeFile(source: VaultTemplateSource): Promise<unknown> {
    return deserializeResolved(
      { type: 'vault', source },
      this.app,
      new Set(),
      this.sources,
      this.componentsFolder,
      this.resolvedParams,
      '',
    );
  }

  /**
   * Deserializes an external template source (Pass 2).
   * @param source - external template source (used as unique id for circular reference detection)
   * @param content - raw YAML string
   */
  deserializeContent(source: ExternalTemplateSource, content: string): Promise<unknown> {
    return deserializeResolved(
      { type: 'external', source, content },
      this.app,
      new Set(),
      this.sources,
      this.componentsFolder,
      this.resolvedParams,
      '',
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolves a !sub reference to a ResolvedRef.
 * Delegates path resolution to {@link parseTemplateRef} so all vault paths are
 * fully resolved before reaching the deserializer.
 *
 * Qualified refs target a named external source exclusively.
 * Unqualified refs search the vault components folder exclusively.
 */
function resolveRef(
  ref: string,
  sources: Map<string, ExternalSource>,
  componentsFolder: string,
  app: App,
): ResolvedRef {
  if (ref.includes('..')) {
    throw new Error(`Invalid !sub path: ${ref}`);
  }

  const source = parseTemplateRef(ref, app, componentsFolder);

  // Handle external source
  if (source instanceof ExternalTemplateSource) {
    const extSource = sources.get(source.sourceName);
    if (!extSource) {
      throw new Error(`Unknown source qualifier "${source.sourceName}" in !sub: ${ref}`);
    }
    const content = extSource.components?.[source.templateName];
    if (!content) {
      throw new Error(`Component "${source.templateName}" not found in source "${source.sourceName}"`);
    }
    return { type: 'external', source, content };
  }

  // Handle vault source (fully resolved by parseTemplateRef)
  if (source instanceof VaultTemplateSource) {
    return { type: 'vault', source };
  }

  // null — vault component not found
  throw new Error(`Component not found: "${ref}" in vault folder "${componentsFolder}"`);
}

/**
 * Strips `pb-metadata` from the top-level parsed object, leaving only the
 * actual base/component content. If `pb-metadata` is not present, the object
 * is returned as-is (files with no metadata key are still valid).
 */
function unwrapContent(raw: unknown): unknown {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if ('pb-metadata' in obj) {
      const { 'pb-metadata': _, ...rest } = obj;
      return rest;
    }
  }
  return raw;
}

// ── Pass 2 deserialization ─────────────────────────────────────────────────────

/**
 * Core deserialization function (Pass 2). Resolves a ref to content, parses YAML
 * with the full custom schema, and recursively resolves all !sub tags and promises.
 * `!exp`/`!fnc` tags evaluate against `resolvedParams` scoped to `sourcePath`.
 */
async function deserializeResolved(
  resolved: ResolvedRef,
  app: App,
  visited: Set<string>,
  sources: Map<string, ExternalSource>,
  componentsFolder: string,
  resolvedParams: ResolvedParams,
  sourcePath: string,
): Promise<unknown> {
  const id = resolved.source.toRef();

  if (visited.has(id)) {
    throw new Error(`Circular !sub reference detected: ${id}`);
  }

  let content: string;
  if (resolved.type === 'vault') {
    const file = app.vault.getFileByPath(resolved.source.path);
    if (!file) throw new Error(`File not found: ${resolved.source.path}`);
    content = await app.vault.read(file);
  } else {
    content = resolved.content;
  }

  const schema = buildSchema(
    app,
    new Set([...visited, id]),
    sources,
    componentsFolder,
    resolvedParams,
    sourcePath,
  );
  // Parse YAML then unwrap pb-metadata before resolving promises
  const raw = yaml.load(content, { schema });
  return resolvePromises(unwrapContent(raw));
}

function buildSchema(
  app: App,
  visited: Set<string>,
  sources: Map<string, ExternalSource>,
  componentsFolder: string,
  resolvedParams: ResolvedParams,
  currentSourcePath: string,
): yaml.Schema {
  // This tag handles substitution of components into the base or parent component
  const subTag = new yaml.Type('!sub', {
    kind: 'scalar',
    resolve: (data: unknown) => typeof data === 'string',
    construct: (ref: string) => {
      const resolved = resolveRef(ref, sources, componentsFolder, app);
      // Append this ref to the source path so nested components are tracked
      const childPath = currentSourcePath ? `${currentSourcePath} > ${ref}` : ref;
      return deserializeResolved(resolved, app, visited, sources, componentsFolder, resolvedParams, childPath);
    },
  });

  // This tag evaluates the value as a javascript expression
  const expTag = new yaml.Type('!exp', {
    kind: 'scalar',
    resolve: (data: unknown) => typeof data === 'string',
    construct: (expr: string): unknown => {
      const params = buildScopedParams(resolvedParams, currentSourcePath);
      try {
        return new Function('params', `return (${expr})`)(params);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`!exp evaluation failed for "${expr}": ${msg}`);
      }
    },
  });

  // This tag evaluates the value as a javascript function body
  const fncTag = new yaml.Type('!fnc', {
    kind: 'scalar',
    resolve: (data: unknown) => typeof data === 'string',
    construct: (body: string): unknown => {
      const params = buildScopedParams(resolvedParams, currentSourcePath);
      try {
        return new Function('params', body)(params);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`!fnc evaluation failed: ${msg}`);
      }
    },
  });

  return yaml.CORE_SCHEMA.extend([subTag, expTag, fncTag]);
}

// ── Pass 1 harvesting ─────────────────────────────────────────────────────────

/**
 * Pass 1 core: resolves `!sub` only, harvesting `pb-metadata.params` from each
 * component into `discoveredParams`. `!exp`/`!fnc` are no-ops.
 */
async function collectParamsFromResolvedRef(
  resolved: ResolvedRef,
  app: App,
  visited: Set<string>,
  sources: Map<string, ExternalSource>,
  componentsFolder: string,
  discoveredParams: HarvestedParams,
  sourcePath: string,
): Promise<unknown> {
  const id = resolved.source.toRef();

  if (visited.has(id)) {
    throw new Error(`Circular !sub reference detected: ${id}`);
  }

  let content: string;
  if (resolved.type === 'vault') {
    const file = app.vault.getFileByPath(resolved.source.path);
    if (!file) throw new Error(`File not found: ${resolved.source.path}`);
    content = await app.vault.read(file);
  } else {
    content = resolved.content;
  }

  // Read metadata.params: parse with a permissive schema so any !sub/!exp/!fnc
  // tags in the content block don't cause unknown-tag errors at this stage.
  const noopTag = (name: string) => new yaml.Type(name, {
    kind: 'scalar', resolve: () => true, construct: () => null,
  });
  const safeSchema = yaml.CORE_SCHEMA.extend([noopTag('!sub'), noopTag('!exp'), noopTag('!fnc')]);
  const rawOuter = yaml.load(content, { schema: safeSchema }) as Record<string, unknown> | null;
  if (rawOuter && typeof rawOuter === 'object' && !Array.isArray(rawOuter)) {
    const metaRaw = (rawOuter as Record<string, unknown>)['pb-metadata'];
    if (metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)) {
      const paramsRaw = (metaRaw as Record<string, unknown>)['params'];
      const specs: ParamSpecs = parseParamSpecs(paramsRaw);
      mergeHarvestedParams(discoveredParams, specs, sourcePath);
    }
  }

  const schema = buildHarvestSchema(
    app,
    new Set([...visited, id]),
    sources,
    componentsFolder,
    discoveredParams,
    sourcePath,
  );
  const raw = yaml.load(content, { schema });
  return resolvePromises(unwrapContent(raw));
}

function buildHarvestSchema(
  app: App,
  visited: Set<string>,
  sources: Map<string, ExternalSource>,
  componentsFolder: string,
  discoveredParams: HarvestedParams,
  currentSourcePath: string,
): yaml.Schema {
  const subTag = new yaml.Type('!sub', {
    kind: 'scalar',
    resolve: (data: unknown) => typeof data === 'string',
    construct: (ref: string) => {
      const resolved = resolveRef(ref, sources, componentsFolder, app);
      const childPath = currentSourcePath ? `${currentSourcePath} > ${ref}` : ref;
      return collectParamsFromResolvedRef(resolved, app, visited, sources, componentsFolder, discoveredParams, childPath);
    },
  });

  // !exp and !fnc are no-ops during harvest — return null so the tree resolves cleanly
  const noopTag = (name: string) => new yaml.Type(name, {
    kind: 'scalar',
    resolve: (data: unknown) => typeof data === 'string',
    construct: () => null,
  });

  return yaml.CORE_SCHEMA.extend([subTag, noopTag('!exp'), noopTag('!fnc')]);
}

// ── Promise resolution ────────────────────────────────────────────────────────

async function resolvePromises(value: unknown): Promise<unknown> {
  if (value instanceof Promise) {
    return resolvePromises(await value);
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map(resolvePromises));
  }
  if (value !== null && typeof value === 'object') {
    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(
        async ([k, v]) => [k, await resolvePromises(v)] as const
      )
    );
    return Object.fromEntries(entries);
  }
  return value;
}
