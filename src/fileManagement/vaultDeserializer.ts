import * as yaml from 'js-yaml';
import { App, normalizePath } from 'obsidian';
import { ExternalSource } from 'settings';

type ResolvedRef =
  | { type: 'vault'; path: string }
  | { type: 'memory'; content: string; id: string };

/**
 * Deserializes YAML files from the Obsidian vault, resolving !sub tags.
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
  ) {}

  /**
   * Deserializes a YAML file at the given vault path.
   * @param path - vault-relative path to the YAML file
   */
  deserialize(path: string): Promise<unknown> {
    return deserializeResolved({ type: 'vault', path }, this.app, new Set(), this.sources, this.componentsFolder);
  }

  /**
   * Deserializes a raw YAML string (e.g. from a plugin-registered base template).
   * @param content - raw YAML string
   * @param id - unique identifier for this content, used for circular reference detection
   */
  deserializeContent(content: string, id: string): Promise<unknown> {
    return deserializeResolved({ type: 'memory', content, id }, this.app, new Set(), this.sources, this.componentsFolder);
  }
}

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
function resolveRef(ref: string, sources: Map<string, ExternalSource>, componentsFolder: string, app: App): ResolvedRef {
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
 * Core deserialization function. Resolves a ref to content, parses YAML,
 * and recursively resolves all !sub tags and promises.
 */
async function deserializeResolved(
  resolved: ResolvedRef,
  app: App,
  visited: Set<string>,
  sources: Map<string, ExternalSource>,
  componentsFolder: string,
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

  const schema = buildSchema(app, new Set([...visited, id]), sources, componentsFolder);
  const raw = yaml.load(content, { schema });
  return resolvePromises(raw);
}

function buildSchema(app: App, visited: Set<string>, sources: Map<string, ExternalSource>, componentsFolder: string): yaml.Schema {
  const subTag = new yaml.Type('!sub', {
    kind: 'scalar',
    resolve: (data: unknown) => typeof data === 'string',
    construct: (ref: string) => {
      const resolved = resolveRef(ref, sources, componentsFolder, app);
      return deserializeResolved(resolved, app, visited, sources, componentsFolder);
    },
  });

  return yaml.CORE_SCHEMA.extend([subTag]);
}

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
