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
 * - Pass 1 (`harvestParams`): resolves `!sub` only to collect all declared
 *   params from the template and every nested component. `!exp`/`!fnc` are no-ops.
 * - Pass 2 (`deserialize` / `deserializeContent`): resolves `!sub` + evaluates
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

  /**
   * Deserializes a YAML file at the given vault path (Pass 2).
   * @param path - vault-relative path to the YAML file
   */
  deserialize(path: string): Promise<unknown> {
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

  /**
   * Pass 1: resolves all `!sub` tags to discover every `metadata.params`
   * declaration across the template and its transitive components.
   * `!exp`/`!fnc` are no-ops during this pass.
   *
   * @param content - raw YAML string of the template's `content:` block
   * @param id - unique identifier for the template, used for circular ref detection
   * @returns All discovered params, keyed by param name with sources accumulated.
   */
  async harvestParams(content: string, id: string): Promise<HarvestedParams> {
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
  const colonIdx = ref.indexOf(':');

  if (colonIdx !== -1) {
    // Qualified — resolve against the named external source
    const qualifier = ref.substring(0, colonIdx);
    const key = ref.substring(colonIdx + 1);

    if (key.includes('..')) {
      throw new Error(`Invalid !sub path: ${ref}`);
    }

    const source = sources.get(qualifier);
    if (!source) throw new Error(`Unknown source qualifier "${qualifier}" in !sub: ${ref}`);

    const content = source.components?.[key];
    if (!content) throw new Error(`Component "${key}" not found in source "${qualifier}"`);

    return { type: 'memory', content, id: `${qualifier}:${key}` };
  }

  // Unqualified — resolve against the vault components folder
  if (ref.includes('..')) {
    throw new Error(`Invalid !sub path: ${ref}`);
  }

  const vaultPath = resolveVaultPath(componentsFolder, ref, app);
  if (vaultPath) return { type: 'vault', path: vaultPath };

  throw new Error(`Component not found: "${ref}" in vault folder "${componentsFolder}"`);
}

/**
 * Extracts the `content:` value from a raw parsed YAML object if the
 * wrapper format is in use (`metadata:` + `content:` keys present).
 * Otherwise returns the object as-is (legacy format without wrapper).
 */
function unwrapContent(raw: unknown): unknown {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    'pb-content' in (raw as Record<string, unknown>)
  ) {
    return (raw as Record<string, unknown>)['pb-content'];
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
