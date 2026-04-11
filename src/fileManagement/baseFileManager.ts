import { App, TFile, normalizePath } from 'obsidian';
import { BaseConfig } from 'bases/baseConfig';
import { ViewRegistry } from 'views/viewRegistry';
import * as yaml from 'js-yaml';

/**
 * Handles vault I/O for `.base` files — read, create, and write.
 *
 * All path arguments are accepted with or without the `.base` extension;
 * {@link resolveFilePath} appends it automatically when absent and normalizes
 * the result for Obsidian's vault API. Intermediate directories are created
 * on demand before any write operation.
 */
export class BaseFileManager {
  /**
   * @param app - The Obsidian app instance used for all vault operations.
   * @param viewRegistry - Registry used to deserialize view configs when reading a base.
   */
  constructor(private readonly app: App, private readonly viewRegistry: ViewRegistry) {}

  /**
   * Reads an existing `.base` file and deserializes it into a {@link BaseConfig}.
   *
   * @param filePath - Vault-relative path to the file. `.base` is appended if no
   *   extension is present.
   * @returns The deserialized {@link BaseConfig}.
   * @throws If no file exists at the resolved path, or if the YAML cannot be parsed
   *   into a valid {@link BaseConfig}.
   */
  async readBase(filePath: string): Promise<BaseConfig> {
    const resolvedPath = this.resolveFilePath(filePath);

    // Resolve the TFile; throw early with a clear message rather than letting
    // vault.read fail with a less informative error
    const file = this.app.vault.getFileByPath(resolvedPath);
    if (!file) throw new Error(`File not found: ${resolvedPath}`);

    const content = await this.app.vault.read(file);
    const raw = yaml.load(content) as Record<string, unknown>;
    return BaseConfig.deserialize(raw, this.viewRegistry);
  }

  /**
   * Creates a new `.base` file at the given path. Throws if the file already exists.
   *
   * @param config - The configuration to serialize and write.
   * @param filePath - Vault-relative output path. `.base` is appended if no
   *   extension is present.
   * @throws If a file already exists at the resolved path, or if the vault write fails.
   */
  async createBase(config: BaseConfig, filePath: string): Promise<void> {
    const resolvedPath = this.resolveFilePath(filePath);

    // Guard against accidentally overwriting an existing file
    const existingFile = this.app.vault.getAbstractFileByPath(resolvedPath);
    if (existingFile) {
        throw new Error(`File already exists at path: ${resolvedPath}`);
    }

    await this.ensureDirectoryExists(resolvedPath);
    await this.app.vault.create(resolvedPath, yaml.dump(config.serialize(), { lineWidth: -1 }));
  }

  /**
   * Writes a `.base` file, overwriting it if it already exists.
   * Creates the file if it does not exist.
   *
   * @param config - The configuration to serialize and write.
   * @param filePath - Vault-relative output path. `.base` is appended if no
   *   extension is present.
   * @throws If the vault write or modify operation fails.
   */
  async writeBase(config: BaseConfig, filePath: string): Promise<void> {
    const resolvedPath = this.resolveFilePath(filePath);
    const existingFile = this.app.vault.getAbstractFileByPath(resolvedPath);

    await this.ensureDirectoryExists(resolvedPath);

    // vault.modify requires a TFile reference; fall back to create for any other
    // case (file absent, or a TFolder somehow occupying the path)
    if (existingFile instanceof TFile) {
        await this.app.vault.modify(existingFile, yaml.dump(config.serialize(), { lineWidth: -1 }));
    } else {
        await this.app.vault.create(resolvedPath, yaml.dump(config.serialize(), { lineWidth: -1 }));
    }
  }

  /**
   * Resolves a caller-supplied path to the normalized vault path used for all
   * vault API calls. Appends `.base` when the path has no extension, then
   * normalizes separators via Obsidian's {@link normalizePath}.
   *
   * @param filePath - Raw path as supplied by the caller.
   * @returns The normalized, extension-guaranteed vault path.
   * @throws If `filePath` is empty or whitespace-only.
   */
  private resolveFilePath(filePath: string): string {
    if (!filePath || !filePath.trim()) {
        throw new Error('File path must not be empty');
    }

    // A dot anywhere after the last slash is treated as an extension delimiter;
    // folder names containing dots (e.g. "v1.2/my-base") do not trigger this
    const hasExtension = /\.[^/\\]+$/.test(filePath);
    const pathWithExtension = hasExtension ? filePath : `${filePath}.base`;
    return normalizePath(pathWithExtension);
  }

  /**
   * Recursively ensures that all intermediate directories for `normalizedPath`
   * exist, creating any that are missing in top-down order.
   *
   * The recursion walks up to the root before creating folders, so parent
   * directories are always created before their children.
   *
   * @param normalizedPath - The fully normalized file path whose parent tree
   *   should be guaranteed to exist.
   * @throws If any `vault.createFolder` call fails (e.g. permission error).
   */
  private async ensureDirectoryExists(normalizedPath: string): Promise<void> {
    const dirPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));

    // Root-level file (no slash) or directory already present — nothing to do
    if (!dirPath || this.app.vault.getAbstractFileByPath(dirPath)) {
        return;
    }

    // Ensure the parent exists before creating this directory
    await this.ensureDirectoryExists(dirPath);
    await this.app.vault.createFolder(dirPath);
  }
}
