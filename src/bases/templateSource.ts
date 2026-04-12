// templateSource.ts

import { App, normalizePath, TFile } from 'obsidian';

export type TemplateSourceType = 'vault' | 'external';

/**
 * A template stored as a vault file.
 * Can be constructed from a {@link TFile} or a vault-relative path string.
 * Whichever is provided is stored immediately; the other is resolved lazily,
 * cached, and returned on first access.
 */
export class VaultTemplateSource {
  //-- Attributes

  // Source type
  readonly type: TemplateSourceType = 'vault' as const;

  // Template file and path
  private readonly _path: string;
  private _file: TFile | undefined; // File is initialize lazily

  // App
  private readonly _app: App | undefined;


  //-- Constructor

  /**
   * Construct from a `TFile` when the file object is already in hand (e.g. from a
   * file-picker modal). The path is read directly from the file; `app` is not needed.
   *
   * Construct from a vault-relative path string when only the path is known (e.g.
   * when restoring a source from a stored `pb-metadata.template` ref). `app` is
   * required so the `file` accessor can lazily resolve the `TFile` on first access.
   */
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


  //-- Accesors
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

/** A template registered by an external source. */
export class ExternalTemplateSource {
  //-- Attributes

  // Source type
  readonly type: TemplateSourceType = 'external' as const;
  constructor(readonly sourceName: string, readonly templateName: string) {}

  //-- Accessors

  /** Returns a `"sourceName:templateName"` ref string. */
  toRef(): string { return `${this.sourceName}:${this.templateName}`; }
}

/** Union of all supported template source kinds. */
export type TemplateSource = VaultTemplateSource | ExternalTemplateSource;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolves a component ref key against a vault folder, appending `.yaml` if
 * not already present. Returns the vault-relative path, or `null` if the file
 * does not exist in the vault.
 */
function resolveComponentPath(componentsFolder: string, ref: string, app: App): string | null {
  const withYaml = ref.endsWith('.yaml') ? ref : `${ref}.yaml`;
  const candidate = normalizePath(`${componentsFolder}/${withYaml}`);
  return app.vault.getFileByPath(candidate) ? candidate : null;
}

// ── parseTemplateRef ──────────────────────────────────────────────────────────

/**
 * Parses a ref string into a {@link TemplateSource}.
 *
 * **Without `componentsFolder`** (stored template refs from `pb-metadata.template`):
 * Qualified refs → {@link ExternalTemplateSource}.
 * Unqualified refs → {@link VaultTemplateSource} with the ref as a lazy vault path.
 *
 * **With `componentsFolder`** (`!sub` component refs):
 * Qualified refs → {@link ExternalTemplateSource}.
 * Unqualified refs are resolved against `componentsFolder`; returns `null` if the
 * file does not exist in the vault.
 *
 * @param app - Required for vault file resolution.
 * @param componentsFolder - When provided, unqualified refs are resolved against
 *   this folder and the returned {@link VaultTemplateSource} holds the fully-resolved
 *   vault-relative path.
 */
export function parseTemplateRef(ref: string, app: App): TemplateSource;
export function parseTemplateRef(ref: string, app: App, componentsFolder: string): TemplateSource | null;
export function parseTemplateRef(ref: string, app: App, componentsFolder?: string): TemplateSource | null {
  const colonIdx = ref.indexOf(':');
  if (colonIdx !== -1) {
    return new ExternalTemplateSource(ref.substring(0, colonIdx), ref.substring(colonIdx + 1));
  }
  if (componentsFolder !== undefined) {
    const vaultPath = resolveComponentPath(componentsFolder, ref, app);
    return vaultPath ? new VaultTemplateSource(vaultPath, app) : null;
  }
  return new VaultTemplateSource(ref, app);
}

export function getTemplateRefSourceType(ref: string, app: App): TemplateSourceType {
  const colonIdx = ref.indexOf(':');
  return colonIdx === -1 ? 'vault' : 'external';
}
