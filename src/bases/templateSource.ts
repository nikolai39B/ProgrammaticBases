// templateSource.ts

import { App, TFile } from 'obsidian';

/**
 * A template stored as a vault file.
 * Can be constructed from a {@link TFile} or a vault-relative path string.
 * Whichever is provided is stored immediately; the other is resolved lazily,
 * cached, and returned on first access.
 */
export class VaultTemplateSource {
  readonly type = 'vault' as const;

  private readonly _path: string;
  private _file: TFile | undefined;
  private readonly _app: App | undefined;

  constructor(file: TFile);
  constructor(path: string, app: App);
  constructor(fileOrPath: TFile | string, app?: App) {
    if (typeof fileOrPath === 'string') {
      this._path = fileOrPath;
      this._app = app;
    } else {
      this._file = fileOrPath;
      this._path = fileOrPath.path;
    }
  }

  get path(): string { return this._path; }

  /** Resolves and caches the TFile, throwing if the path cannot be found in the vault. */
  get file(): TFile {
    if (!this._file) {
      const file = this._app!.vault.getFileByPath(this._path);
      if (!file) throw new Error(`File not found: ${this._path}`);
      this._file = file;
    }
    return this._file;
  }

  /** Returns the vault-relative path as the serializable ref string. */
  toRef(): string { return this._path; }
}

/** A template registered by a plugin under a named source. */
export class PluginTemplateSource {
  readonly type = 'plugin' as const;
  constructor(readonly sourceName: string, readonly templateName: string) {}
  /** Returns a `"sourceName:templateName"` ref string. */
  toRef(): string { return `${this.sourceName}:${this.templateName}`; }
}

/** Union of all supported template source kinds. */
export type TemplateSource = VaultTemplateSource | PluginTemplateSource;

/**
 * Reconstructs a {@link TemplateSource} from a ref string stored in `pb-metadata.template`.
 * Qualified refs of the form `"sourceName:templateName"` → {@link PluginTemplateSource}.
 * All other strings are treated as vault-relative paths → {@link VaultTemplateSource}.
 *
 * @param app - Required to lazily resolve the vault file from the stored path.
 */
export function parseTemplateRef(ref: string, app: App): TemplateSource {
  const colonIdx = ref.indexOf(':');
  if (colonIdx !== -1) {
    return new PluginTemplateSource(ref.substring(0, colonIdx), ref.substring(colonIdx + 1));
  }
  return new VaultTemplateSource(ref, app);
}
