import { App, TFile, normalizePath } from 'obsidian';
import { BaseConfig } from '../config/baseConfig';

export class BaseFileManager {
    constructor(private readonly app: App) {}

    /**
     * Creates a new .base file. Throws if the file already exists.
     */
    async createBase(config: BaseConfig, filePath: string): Promise<void> {
        const resolvedPath = this.resolveFilePath(filePath);
        const existingFile = this.app.vault.getAbstractFileByPath(resolvedPath);

        if (existingFile) {
            throw new Error(`File already exists at path: ${resolvedPath}`);
        }

        await this.ensureDirectoryExists(resolvedPath);
        await this.app.vault.create(resolvedPath, config.serialize());
    }

    /**
     * Writes a .base file, overwriting if it already exists.
     * Creates the file if it doesn't exist.
     */
    async writeBase(config: BaseConfig, filePath: string): Promise<void> {
        const resolvedPath = this.resolveFilePath(filePath);
        const existingFile = this.app.vault.getAbstractFileByPath(resolvedPath);

        await this.ensureDirectoryExists(resolvedPath);

        if (existingFile instanceof TFile) {
            await this.app.vault.modify(existingFile, config.serialize());
        } else {
            await this.app.vault.create(resolvedPath, config.serialize());
        }
    }

    /**
     * Appends .base extension if no extension is provided.
     * Then normalizes the path for Obsidian's vault API.
     */
    private resolveFilePath(filePath: string): string {
        if (!filePath || !filePath.trim()) {
            throw new Error('File path must not be empty');
        }

        const hasExtension = /\.[^/\\]+$/.test(filePath);
        const pathWithExtension = hasExtension ? filePath : `${filePath}.base`;
        return normalizePath(pathWithExtension);
    }

    /**
     * Recursively ensures all intermediate directories exist for a given path.
     */
    private async ensureDirectoryExists(normalizedPath: string): Promise<void> {
        const dirPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));

        if (!dirPath || this.app.vault.getAbstractFileByPath(dirPath)) {
            return;
        }

        await this.ensureDirectoryExists(dirPath);
        await this.app.vault.createFolder(dirPath);
    }
}