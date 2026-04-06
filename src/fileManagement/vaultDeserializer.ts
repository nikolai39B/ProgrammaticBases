import * as yaml from 'js-yaml';
import { App, normalizePath, TFolder } from 'obsidian';

/**
 * Deserializes YAML files from the Obsidian vault, resolving !sub tags
 * by recursively loading and substituting referenced files.
 */
export class VaultDeserializer {
  constructor(private app: App, baseDirectory?: string) {
    if (baseDirectory) {
      const normalized = normalizePath(baseDirectory);
      const folder = app.vault.getAbstractFileByPath(normalized);
      if (!(folder instanceof TFolder)) {
        throw new Error(`Base directory not found in vault: ${normalized}`);
      }
      this.baseDirectory = normalized;
    } else {
      // Default to vault root — no subdirectory constraint
      this.baseDirectory = '';
    }
  }

  private baseDirectory: string;

  /**
   * Deserializes a YAML file at the given vault path.
   * @param path - vault-relative path to the YAML file
   * @returns the deserialized object with all !sub tags resolved
   */
  deserialize(path: string): Promise<unknown> {
    return this.deserializeFile(path, new Set());
  }

  /**
   * Core deserialization function. Loads a YAML file, builds a schema
   * with !sub support, and resolves all promises in the parsed result.
   */
  private async deserializeFile(path: string, visited: Set<string>): Promise<unknown> {
    // Resolve relative paths against the base directory
    const resolvedPath = (!path.startsWith('/') && this.baseDirectory)
      ? normalizePath(`${this.baseDirectory}/${path}`)
      : normalizePath(path);

    // Ensure the resolved path stays within the base directory
    if (this.baseDirectory && !resolvedPath.startsWith(this.baseDirectory + '/')) {
      throw new Error(`!sub path escapes base directory: ${resolvedPath}`);
    }

    // Check for circular dependencies
    if (visited.has(resolvedPath)) {
      throw new Error(`Circular !sub reference detected: ${resolvedPath}`);
    }

    // Get the file
    const file = this.app.vault.getFileByPath(resolvedPath);
    if (!file) {
      throw new Error(`File not found: ${resolvedPath}`);
    }

    // Read the file
    const content = await this.app.vault.read(file);
    const schema = this.buildSchema(new Set([...visited, resolvedPath]));
    const raw = yaml.load(content, { schema });
    return this.resolvePromises(raw);
  }

  /**
   * Builds a js-yaml schema that handles !sub tags by deserializing
   * the referenced file and returning a promise for its contents.
   */
  private buildSchema(visited: Set<string>): yaml.Schema {
    const subTag = new yaml.Type('!sub', {
      kind: 'scalar',

      // Validate
      resolve: (data: unknown) => typeof data === 'string',

      // Deserialize the target file
      construct: (path: string) => {
        return this.deserializeFile(path, visited);
      },
    });

    return yaml.CORE_SCHEMA.extend([subTag]);
  }

  /**
   * Recursively walks a parsed YAML value and resolves any promises,
   * including those nested inside arrays and objects.
   */
  private async resolvePromises(value: unknown): Promise<unknown> {
    // Handle promises
    if (value instanceof Promise) {
      return this.resolvePromises(await value);
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return Promise.all(value.map(v => this.resolvePromises(v)));
    }

    // Handle objects which may contain promises
    if (value !== null && typeof value === 'object') {
      const entries = await Promise.all(
        Object.entries(value as Record<string, unknown>).map(
          async ([k, v]) => [k, await this.resolvePromises(v)] as const
        )
      );
      return Object.fromEntries(entries);
    }

    return value;
  }
}
