import * as yaml from 'js-yaml';
import { App } from 'obsidian';

/**
 * Deserializes YAML files from the Obsidian vault, resolving !sub tags
 * by recursively loading and substituting referenced files.
 */
export class VaultDeserializer {
  constructor(private app: App) {}

  /**
   * Deserializes a YAML file at the given vault path.
   * @param path - vault-relative path to the YAML file
   * @returns the deserialized object with all !sub tags resolved
   */
  deserialize(path: string): Promise<unknown> {
    return deserialize(path, this.app, new Set());
  }
}

/**
 * Core deserialization function. Loads a YAML file, builds a schema
 * with !sub support, and resolves all promises in the parsed result.
 * @param path - vault-relative path to the YAML file
 * @param app - Obsidian app instance
 * @param visited - set of already-visited paths for circular reference detection
 */
async function deserialize(path: string, app: App, visited: Set<string>): Promise<unknown> {
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
  const schema = buildSchema(app, new Set([...visited, path]));
  const raw = yaml.load(content, { schema });
  return resolvePromises(raw);
}

/**
 * Builds a js-yaml schema that handles !sub tags by deserializing
 * the referenced file and returning a promise for its contents.
 * @param app - Obsidian app instance
 * @param visited - set of already-visited paths, passed through for circular reference detection
 */
function buildSchema(app: App, visited: Set<string>): yaml.Schema {
  // Define the 'sub' type which loads components from other files
  const subTag = new yaml.Type('!sub', {
    kind: 'scalar',

    // Validate
    resolve: (data: unknown) => typeof data === 'string',

    // Deserialize the target file
    construct: (path: string) => {
      // Don't attempt to load paths outside the intended directory
      if (path.includes('..')) {
        throw new Error(`Invalid !sub path: ${path}`);
      }

      // Deserialize the file
      return deserialize(path, app, visited);
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