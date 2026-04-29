// paramConfigModal.ts

import { App, Modal, Setting } from 'obsidian';
import ProgrammaticBases from 'main';
import { TemplateSource } from 'bases/templateSource';
import { FolderSuggest } from 'settings';
import {
  HarvestedParam,
  HarvestedParams,
  ParamValue,
  ResolvedParams,
} from 'bases/templateParams';

/**
 * Evaluates a JavaScript expression string and returns its result as a
 * {@link ParamValue}, or `undefined` if the expression throws.
 *
 * Used to resolve `defaultExpr` fields at modal-open time (no `params`
 * context — expression must be self-contained, e.g. `new Date().toISOString().slice(0,10)`).
 *
 * @param expr - A JS expression string suitable for wrapping in `return (...)`.
 * @returns The evaluated value cast to `ParamValue`, or `undefined` on error.
 */
export function evalDefaultExpr(expr: string): ParamValue | undefined {
  try {
    return new Function(`return (${expr})`)() as ParamValue;
  } catch {
    return undefined;
  }
}

/**
 * One page of params scoped to a single template source (the top-level
 * template or a specific component).
 */
export interface ParamPage {
  /** Empty string for template-level params; the component path string otherwise. */
  sourcePath: string;
  /** All params declared by this source, in discovery order. */
  params: [string, HarvestedParam][];
}

/**
 * Abstract base class for multi-page param configuration modals.
 *
 * Handles building param pages from harvested metadata, pre-filling initial
 * values, rendering fields by type, and navigating between pages. Subclasses
 * provide the final-page content and the action to take when the user confirms.
 *
 * **Page sequence**
 * - Pages `0..N-1`: one page per source that declared at least one param
 *   (template-level first `""`, then components in discovery order).
 * - Page `N` (final): rendered by {@link renderFinalContent}. If there are no
 *   param pages, the final page is shown immediately on open.
 *
 * **Subclass contract**
 * - Implement the five abstract getters: {@link totalPages}, {@link isOnFinalPage},
 *   {@link finalButtonLabel}, {@link modalTitle}.
 * - Implement {@link onFinalAction} to perform the confirm action.
 * - Override {@link renderFinalContent} to render any content on the last page
 *   (no-op default — fine when the final page only needs the nav button).
 */
export abstract class ParamConfigModal extends Modal {
  /** Index of the currently displayed page (0-based). */
  protected currentPage = 0;
  /** Ordered list of pages, one per source that declared params. */
  protected readonly paramPages: ParamPage[];
  /**
   * Flat map of scoped param keys → current values.
   *
   * Keys are either the bare param name (template-level) or
   * `"<sourcePath>><paramName>"` (component-level), matching the format used
   * by {@link buildScopedParams} during template evaluation.
   */
  protected readonly values: ResolvedParams = {};
  /** Validation errors for the current page, keyed by the same scoped key used in `values`. */
  protected pageErrors: Record<string, string> = {};

  /**
   * @param app - The Obsidian `App` instance (passed through to `Modal`).
   * @param plugin - The loaded plugin instance (used for vault API and file I/O).
   * @param template - The template source being configured.
   * @param harvested - All params discovered across the template and its components.
   * @param initialValues - Optional pre-fill values (e.g. cached params from an existing base).
   *   Keys must use the scoped `"<sourcePath>><paramName>"` format. Values from this map
   *   take priority over `defaultExpr` and static `default`.
   */
  constructor(
    app: App,
    protected readonly plugin: ProgrammaticBases,
    protected readonly template: TemplateSource,
    harvested: HarvestedParams,
    initialValues: ResolvedParams = {},
  ) {
    super(app);

    // Build one page per unique source, preserving discovery order.
    // `seenSources` is used as an ordered set — indexOf would be O(n²) but
    // source counts are tiny in practice.
    const seenSources: string[] = [];
    for (const entry of Object.values(harvested)) {
      for (const src of Object.keys(entry.specs)) {
        if (!seenSources.includes(src)) seenSources.push(src);
      }
    }
    this.paramPages = seenSources
      .map(src => ({
        sourcePath: src,
        params: Object.entries(harvested).filter(([, e]) => src in e.specs),
      }))
      .filter(p => p.params.length > 0);

    // Pre-fill each scoped key using the priority chain:
    //   initialValues > defaultExpr (evaluated) > static default > type fallback
    for (const [paramName, entry] of Object.entries(harvested)) {
      for (const [src, spec] of Object.entries(entry.specs)) {
        const key = src ? `${src}>${paramName}` : paramName;

        // Cached / caller-supplied value takes priority
        if (key in initialValues) {
          this.values[key] = initialValues[key];
          continue;
        }

        let defaultVal: ParamValue;
        if (spec.defaultExpr !== undefined) {
          // Evaluate the expression; fall back to static default on error
          defaultVal = evalDefaultExpr(spec.defaultExpr) ?? spec.default ?? '';
        } else if (spec.default !== undefined) {
          defaultVal = spec.default;
        } else if (spec.type === 'boolean') {
          defaultVal = false;
        } else if (spec.type === 'enum') {
          // First option is the natural default for a dropdown
          defaultVal = spec.options[0] ?? '';
        } else {
          defaultVal = '';
        }
        this.values[key] = defaultVal as ParamValue;
      }
    }
  }

  /** Total number of pages including the final page. */
  protected abstract get totalPages(): number;
  /** Whether the modal is currently showing its last page (where the confirm button lives). */
  protected abstract get isOnFinalPage(): boolean;
  /** Label for the confirm button on the final page (e.g. `"Create"` or `"Update"`). */
  protected abstract get finalButtonLabel(): string;
  /** Title string shown in the modal header. */
  protected abstract get modalTitle(): string;
  /**
   * Called when the user clicks the confirm button on the final page.
   * Subclasses should validate any final-page inputs here before committing.
   */
  protected abstract onFinalAction(): void;

  onOpen() {
    this.titleEl.setText(this.modalTitle);
    this.renderCurrentPage();
  }

  onClose() {
    this.contentEl.empty();
  }

  /**
   * Clears and re-renders the content area for the current page index.
   * Calls {@link renderParamPage} for param pages, {@link renderFinalContent}
   * for the final page, then always appends the nav bar via {@link renderNav}.
   */
  protected renderCurrentPage() {
    this.contentEl.empty();
    if (this.currentPage < this.paramPages.length) {
      this.renderParamPage(this.paramPages[this.currentPage]!);
    } else {
      this.renderFinalContent();
    }
    this.renderNav();
  }

  /**
   * Renders the body of the final page. No-op by default — suitable when the
   * final page only needs the nav bar (e.g. `UpdateConfigurationModal` with no params).
   * Override to add output-location fields or other confirm-page content.
   */
  protected renderFinalContent(): void {}

  /**
   * Renders the heading, step counter, and all param fields for a single param page.
   *
   * @param page - The {@link ParamPage} to render.
   */
  private renderParamPage(page: ParamPage) {
    const heading = page.sourcePath ? `Component: ${page.sourcePath}` : 'Base';
    this.contentEl.createEl('p', { text: heading, cls: 'pb-page-heading' });
    this.contentEl.createEl('p', {
      text: `Step ${this.currentPage + 1} of ${this.totalPages}`,
      cls: 'setting-item-description',
    });

    for (const [name, entry] of page.params) {
      this.renderField(name, entry, page.sourcePath);
    }
  }

  /**
   * Validates all fields on a param page and returns any errors.
   *
   * Checks that required fields are non-empty and that number fields respect
   * their `min`/`max` bounds.
   *
   * @param page - The param page to validate.
   * @returns A map of scoped key → error message for every failing field.
   *   Empty object means the page is valid.
   */
  protected validateParamPage(page: ParamPage): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const [name, entry] of page.params) {
      const spec = entry.specs[page.sourcePath]!;
      const key = page.sourcePath ? `${page.sourcePath}>${name}` : name;
      const value = this.values[key];

      // Required check (booleans are always present via the toggle)
      if (spec.type !== 'boolean' && !spec.optional && (value === '' || value === undefined)) {
        errors[key] = 'Required';
        continue;
      }

      // Range check for number fields
      if (spec.type === 'number' && typeof value === 'number') {
        if (spec.min !== undefined && value < spec.min)
          errors[key] = `Must be at least ${spec.min}`;
        else if (spec.max !== undefined && value > spec.max)
          errors[key] = `Must be at most ${spec.max}`;
      }
    }
    return errors;
  }

  /**
   * Renders a single param field as an Obsidian `Setting` row, choosing the
   * appropriate control based on `spec.type`.
   *
   * Appends a description built from `spec.description` and any constraint
   * hints (`optional`, `min`, `max`). Inline validation errors are shown
   * below the row via {@link renderFieldError}.
   *
   * @param name - The canonical param name (key in `harvested`).
   * @param entry - The harvested param entry containing all source specs.
   * @param sourcePath - The source path this page belongs to (empty = template level).
   */
  protected renderField(name: string, entry: HarvestedParam, sourcePath: string) {
    const spec = entry.specs[sourcePath]!;
    const key = sourcePath ? `${sourcePath}>${name}` : name;
    const currentValue = this.values[key] ?? '';

    const setting = new Setting(this.contentEl).setName(spec.label ?? name);

    // Build constraint hint suffix: "(optional)", "(min 0, max 100)", etc.
    const hints: string[] = [];
    if (spec.optional) hints.push('optional');
    if (spec.type === 'number') {
      if (spec.min !== undefined) hints.push(`min ${spec.min}`);
      if (spec.max !== undefined) hints.push(`max ${spec.max}`);
    }
    const hint = hints.length > 0 ? `(${hints.join(', ')})` : undefined;
    const desc = spec.description
      ? (hint ? `${spec.description} ${hint}` : spec.description)
      : hint;
    if (desc) setting.setDesc(desc);

    switch (spec.type) {
      case 'boolean':
        setting.addToggle(toggle =>
          toggle
            .setValue(Boolean(currentValue))
            .onChange(v => { this.values[key] = v; }));
        break;

      case 'folder':
        setting.addText(text => {
          new FolderSuggest(this.app, text.inputEl);
          text
            .setValue(String(currentValue))
            .onChange(v => { this.values[key] = v.trim(); });
        });
        break;

      case 'number':
        setting.addText(text => {
          text.inputEl.type = 'number';
          if (spec.min !== undefined) text.inputEl.min = String(spec.min);
          if (spec.max !== undefined) text.inputEl.max = String(spec.max);
          // Prevent 'e'/'E' — browsers allow scientific notation in number inputs by default
          text.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'e' || e.key === 'E') e.preventDefault();
          });
          text
            .setValue(currentValue !== '' ? String(currentValue) : '')
            .onChange(v => {
              const trimmed = v.trim();
              if (trimmed === '') { this.values[key] = ''; return; }
              const n = parseFloat(trimmed);
              if (!isNaN(n)) this.values[key] = n;
            });
        });
        break;

      case 'date':
        setting.addText(text => {
          text.inputEl.type = 'date';
          text
            .setValue(String(currentValue))
            .onChange(v => { this.values[key] = v; });
        });
        break;

      case 'datetime':
        setting.addText(text => {
          text.inputEl.type = 'datetime-local';
          text
            .setValue(String(currentValue))
            .onChange(v => { this.values[key] = v; });
        });
        break;

      case 'enum':
        setting.addDropdown(dropdown => {
          for (const option of spec.options) dropdown.addOption(option, option);
          // Guard against a stored value that is no longer a valid option
          const safeVal = spec.options.includes(String(currentValue)) ? String(currentValue) : (spec.options[0] ?? '');
          dropdown
            .setValue(safeVal)
            .onChange(v => { this.values[key] = v; });
        });
        break;

      default: // string
        setting.addText(text =>
          text
            .setValue(String(currentValue))
            .onChange(v => { this.values[key] = v; }));
        break;
    }

    this.renderFieldError(setting, this.pageErrors[key]);
  }

  /**
   * Injects a styled error paragraph immediately after `setting`'s row element.
   * Does nothing when `error` is `undefined`.
   *
   * @param setting - The `Setting` row to attach the error to.
   * @param error - The error message to display, or `undefined` for no error.
   */
  protected renderFieldError(setting: Setting, error: string | undefined) {
    if (!error) return;
    const el = document.createElement('p');
    el.textContent = error;
    el.style.color = 'var(--text-error)';
    el.style.fontSize = 'var(--font-ui-small)';
    el.style.margin = '-8px 8px 8px';
    el.style.textAlign = 'right';
    setting.settingEl.insertAdjacentElement('afterend', el);
  }

  /**
   * Renders the Back / Next / confirm navigation bar at the bottom of the page.
   *
   * - "← Back" is shown on all pages after the first.
   * - "Next →" is shown on non-final pages; validates the current param page
   *   before advancing, re-rendering with errors if validation fails.
   * - The confirm button (labelled by {@link finalButtonLabel}) is shown on the
   *   final page and delegates to {@link onFinalAction}.
   */
  protected renderNav() {
    const nav = new Setting(this.contentEl);

    if (this.currentPage > 0) {
      nav.addButton(btn => btn
        .setButtonText('← Back')
        .onClick(() => {
          this.pageErrors = {};
          this.currentPage--;
          this.renderCurrentPage();
        }));
    }

    if (!this.isOnFinalPage) {
      nav.addButton(btn => btn
        .setButtonText('Next →')
        .setCta()
        .onClick(() => {
          // Validate before advancing; re-render with inline errors on failure
          const errors = this.validateParamPage(this.paramPages[this.currentPage]!);
          if (Object.keys(errors).length > 0) {
            this.pageErrors = errors;
            this.renderCurrentPage();
            return;
          }
          this.pageErrors = {};
          this.currentPage++;
          this.renderCurrentPage();
        }));
    } else {
      nav.addButton(btn => btn
        .setButtonText(this.finalButtonLabel)
        .setCta()
        .onClick(() => this.onFinalAction()));
    }
  }
}
