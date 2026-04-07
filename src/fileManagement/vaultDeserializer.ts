import * as yaml from 'js-yaml';
import { App, normalizePath } from 'obsidian';
import { ComponentsFolder, ComponentSource } from 'settings';

type ResolvedRef =
  | { type: 'vault'; path: string }
  | { type: 'memory'; content: string; id: string };

/**
 * Deserializes YAML files from the Obsidian vault, resolving !sub tags
 * by recursively loading and substituting referenced files.
 *
 * !sub references are resolved against in-memory `componentSources` first,
 * then vault `componentsFolders` — both in priority order. A qualifier prefix
 * can target a specific source/folder: `!sub task-base:filter/focused.yaml`.
 */
export class VaultDeserializer {
  constructor(
    private app: App,
    private componentSources: ComponentSource[] = [],
    private componentsFolders: ComponentsFolder[] = [],
  ) {}

  /**
   * Deserializes a YAML file at the given vault path.
   * @param path - vault-relative path to the YAML file
   */
  deserialize(path: string): Promise<unknown> {
    return deserializeResolved({ type: 'vault', path }, this.app, new Set(), this.componentSources, this.componentsFolders);
  }

  /**
   * Deserializes a raw YAML string (e.g. from a plugin-registered base template).
   * !sub references within the content are resolved normally.
   * @param content - raw YAML string to deserialize
   * @param name - the template's registered name, used as the root id for circular reference detection
   */
  deserializeContent(content: string, name: string): Promise<unknown> {
    return deserializeResolved({ type: 'memory', content, id: name }, this.app, new Set(), this.componentSources, this.componentsFolders);
  }
}

/**
 * Resolves a !sub reference to either a vault path or in-memory content.
 * In-memory sources are checked before vault folders, both in priority order.
 */
/** Resolves a ref to a vault path, appending `.yaml` if not already present. */
function resolveVaultPath(folderPath: string, ref: string, app: App): string | null {
  const withYaml = ref.endsWith('.yaml') ? ref : `${ref}.yaml`;
  const candidate = normalizePath(`${folderPath}/${withYaml}`);
  return app.vault.getFileByPath(candidate) ? candidate : null;
}

function resolveRef(ref: string, sources: ComponentSource[], folders: ComponentsFolder[], app: App): ResolvedRef {
  const colonIdx = ref.indexOf(':');

  if (colonIdx !== -1) {
    // Qualified reference — target a specific named source or folder
    const qualifier = ref.substring(0, colonIdx);
    const relativePath = ref.substring(colonIdx + 1);

    if (relativePath.includes('..')) {
      throw new Error(`Invalid !sub path: ${ref}`);
    }

    // Check in-memory sources first
    const source = sources.find(s => s.name === qualifier);
    if (source) {
      const key = normalizePath(relativePath);
      const content = source.components[key];
      if (!content) throw new Error(`Component "${relativePath}" not found in source "${qualifier}"`);
      return { type: 'memory', content, id: `${qualifier}:${key}` };
    }

    // Fall back to vault folders
    const folder = folders.find(f => f.name === qualifier);
    if (!folder) throw new Error(`Unknown component qualifier "${qualifier}" in !sub: ${ref}`);
    const vaultPath = resolveVaultPath(folder.path, relativePath, app);
    if (!vaultPath) throw new Error(`Component "${relativePath}" not found in folder "${qualifier}"`);
    return { type: 'vault', path: vaultPath };
  }

  // Unqualified reference — search in priority order
  if (ref.includes('..')) {
    throw new Error(`Invalid !sub path: ${ref}`);
  }

  const key = normalizePath(ref);

  for (const source of sources) {
    if (source.components[key]) {
      return { type: 'memory', content: source.components[key], id: `${source.name}:${key}` };
    }
  }

  for (const folder of folders) {
    const vaultPath = resolveVaultPath(folder.path, ref, app);
    if (vaultPath) return { type: 'vault', path: vaultPath };
  }

  throw new Error(`Component not found: "${ref}" (searched ${sources.length} source(s), ${folders.length} folder(s))`);
}

/**
 * Core deserialization function. Resolves a ref to content, parses YAML,
 * and recursively resolves all !sub tags and promises.
 */
async function deserializeResolved(
  resolved: ResolvedRef,
  app: App,
  visited: Set<string>,
  sources: ComponentSource[],
  folders: ComponentsFolder[],
): Promise<unknown> {
  const id = resolved.type === 'vault' ? resolved.path : resolved.id;

  // Check for circular references
  if (visited.has(id)) {
    throw new Error(`Circular !sub reference detected: ${id}`);
  }

  let content: string;

  if (resolved.type === 'vault') {
    // If the component is a vault file, read it
    const file = app.vault.getFileByPath(resolved.path);
    if (!file) throw new Error(`File not found: ${resolved.path}`);
    content = await app.vault.read(file);
  } else {
    // Otherwise, the component is already in memory so use it directly
    content = resolved.content;
  }

  // Build a new schema with an updated visited path
  const schema = buildSchema(app, new Set([...visited, id]), sources, folders);

  // Load the content as yaml
  const raw = yaml.load(content, { schema });
  return resolvePromises(raw);
}

/**
 * Builds a js-yaml schema that handles !sub tags by resolving references
 * against in-memory sources and vault folders.
 */
function buildSchema(app: App, visited: Set<string>, sources: ComponentSource[], folders: ComponentsFolder[]): yaml.Schema {
  const subTag = new yaml.Type('!sub', {
    kind: 'scalar',
    resolve: (data: unknown) => typeof data === 'string',
    construct: (ref: string) => {
      const resolved = resolveRef(ref, sources, folders, app);
      return deserializeResolved(resolved, app, visited, sources, folders);
    },
  });

  return yaml.CORE_SCHEMA.extend([subTag]);
}

/**
 * Recursively walks a parsed YAML value and resolves any promises,
 * including those nested inside arrays and objects.
 */
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
