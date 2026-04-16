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
  private _file: TFile | undefined; // File is initialized lazily

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

// ── TemplateSourceResolver ────────────────────────────────────────────────────

/**
 * Parses template ref strings into {@link TemplateSource} instances,
 * validating vault file existence where applicable.
 *
 * This is the single authoritative place for the format 1 vs 2 distinction:
 * - Format 1 (unqualified `!sub`): component folder-relative vault path
 * - Format 2 (qualified `!sub`): external source component (`sourceName:key`)
 * - Format 3 (header ref): vault-relative template path or external template ref
 */
export class TemplateSourceResolver {
  constructor(
    readonly app: App,
    private readonly getComponentsFolder: () => string,
  ) {}

  get componentsFolder(): string { return this.getComponentsFolder(); }

  /**
   * Parse a header ref (stored in `pb-metadata.template`).
   * Qualified → {@link ExternalTemplateSource} (identity only; external source validates existence).
   * Unqualified → validates file exists in vault; throws with a "file was moved?" message
   * if not found; returns {@link VaultTemplateSource} with TFile otherwise.
   */
  parseHeaderRef(ref: string): TemplateSource {
    const qualified = this.parseQualified(ref);
    if (qualified) return new ExternalTemplateSource(qualified.sourceName, qualified.templateName);
    const file = this.app.vault.getFileByPath(ref);
    if (!file) throw new Error(
      `Template not found: "${ref}". If you moved the file, update the path in pb-metadata.template.`
    );
    return new VaultTemplateSource(file);
  }

  /**
   * Parse a `!sub` component ref.
   * Qualified → {@link ExternalTemplateSource} (identity only; external source validates existence).
   * Unqualified → resolves against the components folder; throws if the file does not exist.
   */
  parseSubRef(ref: string): TemplateSource {
    const qualified = this.parseQualified(ref);
    if (qualified) return new ExternalTemplateSource(qualified.sourceName, qualified.templateName);
    if (ref.includes('..')) throw new Error(`Invalid !sub path: ${ref}`);
    const withYaml = ref.endsWith('.yaml') ? ref : `${ref}.yaml`;
    const candidate = normalizePath(`${this.getComponentsFolder()}/${withYaml}`);
    const file = this.app.vault.getFileByPath(candidate);
    if (!file) throw new Error(`Component not found: "${ref}" in folder "${this.getComponentsFolder()}"`);
    return new VaultTemplateSource(file);
  }

  private parseQualified(ref: string): { sourceName: string; templateName: string } | null {
    const i = ref.indexOf(':');
    return i === -1 ? null : { sourceName: ref.substring(0, i), templateName: ref.substring(i + 1) };
  }
}
