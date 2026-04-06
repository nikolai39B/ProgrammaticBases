import * as yaml from 'js-yaml';
import { App, normalizePath } from 'obsidian';
import { ComponentsFolder } from 'settings';

/**
 * Deserializes YAML files from the Obsidian vault, resolving !sub tags
 * by recursively loading and substituting referenced files.
 *
 * !sub references are resolved against the provided componentsFolders in
 * priority order (first match wins). A qualifier prefix can be used to
 * target a specific folder explicitly: `!sub task-base:filter/focused.yaml`.
 */
export class VaultDeserializer {
  constructor(private app: App, private componentsFolders: ComponentsFolder[] = []) {}

  /**
   * Deserializes a YAML file at the given vault path.
   * @param path - vault-relative path to the YAML file
   * @returns the deserialized object with all !sub tags resolved
   */
  deserialize(path: string): Promise<unknown> {
    return deserialize(path, this.app, new Set(), this.componentsFolders);
  }
}

/**
 * Core deserialization function. Loads a YAML file, builds a schema
 * with !sub support, and resolves all promises in the parsed result.
 * @param path - vault-relative path to the YAML file
 * @param app - Obsidian app instance
 * @param visited - set of already-visited paths for circular reference detection
 * @param componentsFolders - named folders used to resolve !sub references
 */
async function deserialize(path: string, app: App, visited: Set<string>, componentsFolders: ComponentsFolder[]): Promise<unknown> {
  // Check for circular dependencies
  if (visited.has(path)) {
    throw new Error(`Circular !sub reference detected: ${path}`);
  }

  // Get the file
  const file = app.vault.getFileByPath(path);
  if (!file) {
    throw new Error(`File not found: ${path}`);
  }

  // Read the file
  const content = await app.vault.read(file);
  const schema = buildSchema(app, new Set([...visited, path]), componentsFolders);
  const raw = yaml.load(content, { schema });
  return resolvePromises(raw);
}

/**
 * Resolves a !sub reference to a vault-relative path using componentsFolders.
 *
 * Qualified references (e.g. "task-base:filter/focused.yaml") are resolved
 * against the named folder only, and throw if the name is not registered.
 * Unqualified references (e.g. "filter/focused.yaml") are searched across
 * all folders in priority order — first match wins.
 *
 * @param ref - the raw !sub reference string
 * @param folders - named component folders to search
 * @param app - Obsidian app instance (used for existence checks on unqualified refs)
 * @returns vault-relative path to the referenced file
 */
function resolveComponentPath(ref: string, folders: ComponentsFolder[], app: App): string {
  const colonIdx = ref.indexOf(':');

  if (colonIdx !== -1) {
    // Qualified reference — target a specific named folder
    const qualifier = ref.substring(0, colonIdx);
    const relativePath = ref.substring(colonIdx + 1);

    if (relativePath.includes('..')) {
      throw new Error(`Invalid !sub path: ${ref}`);
    }

    const folder = folders.find(f => f.name === qualifier);
    if (!folder) {
      throw new Error(`Unknown component folder qualifier "${qualifier}" in !sub: ${ref}`);
    }

    return normalizePath(`${folder.path}/${relativePath}`);
  }

  // Unqualified reference — search folders in priority order
  if (ref.includes('..')) {
    throw new Error(`Invalid !sub path: ${ref}`);
  }

  for (const folder of folders) {
    const candidate = normalizePath(`${folder.path}/${ref}`);
    if (app.vault.getFileByPath(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Component not found: "${ref}" (searched ${folders.length} folder(s))`);
}

/**
 * Builds a js-yaml schema that handles !sub tags by deserializing
 * the referenced file and returning a promise for its contents.
 * @param app - Obsidian app instance
 * @param visited - set of already-visited paths, passed through for circular reference detection
 * @param componentsFolders - named folders used to resolve !sub references
 */
function buildSchema(app: App, visited: Set<string>, componentsFolders: ComponentsFolder[]): yaml.Schema {
  // Define the 'sub' type which loads components from other files
  const subTag = new yaml.Type('!sub', {
    kind: 'scalar',

    // Validate
    resolve: (data: unknown) => typeof data === 'string',

    // Deserialize the target file
    construct: (ref: string) => {
      const resolvedPath = resolveComponentPath(ref, componentsFolders, app);
      return deserialize(resolvedPath, app, visited, componentsFolders);
    },
  });

  return yaml.CORE_SCHEMA.extend([subTag]);
}

/**
 * Recursively walks a parsed YAML value and resolves any promises,
 * including those nested inside arrays and objects.
 * @param value - the value to resolve
 */
async function resolvePromises(value: unknown): Promise<unknown> {
  // Handle promises
  if (value instanceof Promise) {
    return resolvePromises(await value);
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return Promise.all(value.map(resolvePromises));
  }

  // Handle objects which may contain promises
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