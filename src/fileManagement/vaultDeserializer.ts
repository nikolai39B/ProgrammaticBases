import * as yaml from 'js-yaml';
import { App, normalizePath } from 'obsidian';
import { ExternalSource } from 'settings';
import {
  HarvestedParams,
  ParamSpecs,
  ResolvedParams,
  buildScopedParams,
  mergeHarvestedParams,
  parseParamSpecs,
} from 'bases/templateParams';
import { parseTemplateRef, PluginTemplateSource, VaultTemplateSource } from 'bases/templateSource';

type ResolvedRef =
  | { type: 'vault'; path: string }
  | { type: 'memory'; content: string; id: string };

/**
 * Deserializes YAML files from the Obsidian vault, resolving !sub tags.
 *
 * Files use an optional `metadata:` / `content:` wrapper format.
 * When present, `metadata:` is stripped before substitution and only
 * `content:` is used as the resolved value.
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
   * Pass 1 entry point for a vault file path.
   * Mirrors {@link deserializeFile} but runs the collect pass instead.
   *
   * @param path - vault-relative path to the template YAML file
   * @returns All discovered params, keyed by param name with sources accumulated.
   */
  async collectFileParams(path: string): Promise<HarvestedParams> {
    const discoveredParams: HarvestedParams = {};
    await harvestResolved(
      { type: 'vault', path },
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
   * Pass 1 entry point for an in-memory YAML string.
   * Mirrors {@link deserializeContent} but runs the collect pass instead.
   *
   * @param content - raw YAML string
   * @param id - unique identifier for circular reference detection
   * @returns All discovered params, keyed by param name with sources accumulated.
   */
  async collectContentParams(content: string, id: string): Promise<HarvestedParams> {
    const discoveredParams: HarvestedParams = {};
    await harvestResolved(
      { type: 'memory', content, id },
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
   * Deserializes a YAML file at the given vault path (Pass 2).
   * @param path - vault-relative path to the YAML file
   */
  deserializeFile(path: string): Promise<unknown> {
    return deserializeResolved(
      { type: 'vault', path },
      this.app,
      new Set(),
      this.sources,
      this.componentsFolder,
      this.resolvedParams,
      '',
    );
  }

  /**
   * Deserializes a raw YAML string (Pass 2).
   * @param content - raw YAML string
   * @param id - unique identifier for circular reference detection
   */
  deserializeContent(content: string, id: string): Promise<unknown> {
    return deserializeResolved(
      { type: 'memory', content, id },
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

/** Resolves a vault ref, appending `.yaml` if not already present. */
function resolveVaultPath(folderPath: string, ref: string, app: App): string | null {
  const withYaml = ref.endsWith('.yaml') ? ref : `${ref}.yaml`;
  const candidate = normalizePath(`${folderPath}/${withYaml}`);
  return app.vault.getFileByPath(candidate) ? candidate : null;
}

/**
 * Resolves a !sub reference to either a vault path or in-memory content.
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
  // Parse the ref into a template source
  const refSource = parseTemplateRef(ref, app);
  if (!refSource) {
    throw new Error(`Invalid ref "${ref}" in !sub`);
  }

  // Handle vault source
  if (refSource instanceof VaultTemplateSource) {
    // Validate that the path does not escape the vault
    if (refSource.path.includes('..')) {
      throw new Error(`Invalid !sub path: ${refSource.path}`);
    }

    // Get the vault-relative path to the template
    const vaultPath = resolveVaultPath(componentsFolder, refSource.path, app);
    if (!vaultPath) {
      throw new Error(`Component not found: "${refSource.path}" in vault folder "${componentsFolder}"`);
    }

    return { type: 'vault', path: vaultPath };
  }

  // Handle plugin source
  if (refSource instanceof PluginTemplateSource) {
    // Get the source
    const source = sources.get(refSource.sourceName);
    if (!source) {
      throw new Error(`Unknown source qualifier "${refSource.sourceName}" in !sub: ${ref}`);
    }

    // Get the content
    const content = source.components?.[refSource.templateName];
    if (!content) {
      throw new Error(`Component "${refSource.templateName}" not found in source "${refSource.sourceName}"`);
    }

    return { type: 'memory', content, id: refSource.toRef() };
  }

  // Unhandled
  throw new Error(`Invalid ref "${ref}" in !sub`);
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
  const id = resolved.type === 'vault' ? resolved.path : resolved.id;

  if (visited.has(id)) {
    throw new Error(`Circular !sub reference detected: ${id}`);
  }

  let content: string;
  if (resolved.type === 'vault') {
    const file = app.vault.getFileByPath(resolved.path);
    if (!file) throw new Error(`File not found: ${resolved.path}`);
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
  // Parse YAML then unwrap content: from wrapper format before resolving promises
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

  // This tag evaulates the value as a javascript expression
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
 * Pass 1 core: resolves `!sub` only, harvesting `metadata.params` from each
 * component into `discoveredParams`. `!exp`/`!fnc` are no-ops.
 */
async function harvestResolved(
  resolved: ResolvedRef,
  app: App,
  visited: Set<string>,
  sources: Map<string, ExternalSource>,
  componentsFolder: string,
  discoveredParams: HarvestedParams,
  sourcePath: string,
): Promise<unknown> {
  const id = resolved.type === 'vault' ? resolved.path : resolved.id;

  if (visited.has(id)) {
    throw new Error(`Circular !sub reference detected: ${id}`);
  }

  let content: string;
  if (resolved.type === 'vault') {
    const file = app.vault.getFileByPath(resolved.path);
    if (!file) throw new Error(`File not found: ${resolved.path}`);
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
      return harvestResolved(resolved, app, visited, sources, componentsFolder, discoveredParams, childPath);
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
