// templateSource.ts

import { normalizePath, TFile } from 'obsidian';

export type TemplateSourceType = 'vault' | 'qualified';

/**
 * A pure identifier for a template stored as a vault file.
 *
 * `toRef()` returns the folder-relative ref (e.g. `dashboard.yaml`) — stored in
 * `pb-metadata.template` and used for cycle detection.
 * `path` returns the vault-relative path (e.g. `Templates/bases/dashboard.yaml`).
 *
 * Content retrieval is handled externally (e.g. by `TemplateEvaluator`).
 */
export class VaultTemplateSource {
  readonly type: TemplateSourceType = 'vault' as const;

  constructor(readonly path: string, private readonly _ref: string) {}

  /** Template folder-relative ref (e.g. `dashboard.yaml`). */
  toRef(): string { return this._ref; }

  /** Leaf file name with no path or extension (e.g. `boards/task-board.yaml` → `task-board`). */
  toName(): string {
    const leaf = this._ref.includes('/') ? this._ref.slice(this._ref.lastIndexOf('/') + 1) : this._ref;
    return leaf.replace(/\.yaml$/, '');
  }
}

/**
 * A template provided by a registered qualified source (i.e. another plugin).
 * Referenced using the `sourceName:templateName` format.
 */
export class QualifiedTemplateSource {
  readonly type: TemplateSourceType = 'qualified' as const;
  constructor(readonly sourceName: string, readonly templateName: string) {}

  /** Returns `"sourceName:templateName"`. */
  toRef(): string { return `${this.sourceName}:${this.templateName}`; }

  /** Display name — just the template name, without the source qualifier. */
  toName(): string { return this.templateName; }
}

/** Union of all supported template source kinds. */
export type TemplateSource = VaultTemplateSource | QualifiedTemplateSource;

// ── TemplateSourceResolver ────────────────────────────────────────────────────

/**
 * Parses template ref strings into {@link TemplateSource} instances.
 *
 * All refs are either qualified (`sourceName:key`) or folder-relative.
 * Pass `context: 'component'` for `!sub` refs (resolved against {@link componentsFolder})
 * or `context: 'base'` for header refs stored in `pb-metadata.template`
 * (resolved against {@link basesFolder}).
 */
export class TemplateSourceResolver {
  constructor(
    private readonly getComponentsFolder: () => string,
    private readonly getBasesFolder: () => string,
  ) {}

  get componentsFolder(): string { return this.getComponentsFolder(); }
  get basesFolder(): string { return this.getBasesFolder(); }

  /**
   * Parses a ref string into a {@link TemplateSource}.
   *
   * - Qualified (`sourceName:key`) → {@link QualifiedTemplateSource}
   * - Unqualified → resolved against the folder for the given context;
   *   `.yaml` is appended if absent.
   *
   * @param ref     - The ref string (e.g. `filter/isTask` or `task-base:filter/isTask`).
   * @param context - `'component'` resolves against {@link componentsFolder};
   *                  `'base'` resolves against {@link basesFolder}.
   * @throws If `ref` contains `..`.
   */
  parseRef(ref: string, context: 'base' | 'component'): TemplateSource {
    const qualified = this.parseQualified(ref);
    if (qualified) return new QualifiedTemplateSource(qualified.sourceName, qualified.templateName);

    if (ref.includes('..')) throw new Error(`Invalid ref path: ${ref}`);

    const folder = context === 'component' ? this.componentsFolder : this.basesFolder;
    const withYaml = ref.endsWith('.yaml') ? ref : `${ref}.yaml`;
    const vaultPath = normalizePath(`${folder}/${withYaml}`);

    return new VaultTemplateSource(vaultPath, ref);
  }

  /**
   * Constructs a {@link VaultTemplateSource} from a TFile, computing the
   * folder-relative ref by stripping the context folder prefix from the file path.
   *
   * @param file    - The vault file to wrap.
   * @param context - `'base'` strips {@link basesFolder}; `'component'` strips {@link componentsFolder}.
   */
  sourceFromFile(file: TFile, context: 'base' | 'component'): VaultTemplateSource {
    const folder = context === 'component' ? this.componentsFolder : this.basesFolder;
    const prefix = folder ? `${folder}/` : '';
    const ref = file.path.startsWith(prefix) ? file.path.slice(prefix.length) : file.path;
    return new VaultTemplateSource(file.path, ref);
  }

  private parseQualified(ref: string): { sourceName: string; templateName: string } | null {
    const i = ref.indexOf(':');
    return i === -1 ? null : { sourceName: ref.substring(0, i), templateName: ref.substring(i + 1) };
  }
}
