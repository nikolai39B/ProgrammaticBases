import { App, Command, Modal, Notice, Setting, SuggestModal, TFile, TFolder, normalizePath } from 'obsidian';
import ProgrammaticBases from 'main';
import { ExternalTemplateSource, TemplateSource, VaultTemplateSource } from 'bases/templateSource';
import { FolderSuggest } from 'settings';
import {
  HarvestedParam,
  HarvestedParams,
  ParamValue,
  ResolvedParams,
} from 'bases/templateParams';

/**
 * Returns the human-readable display name for a template source.
 * Vault templates show the file basename; plugin templates show `sourceName:templateName`.
 *
 * @param source - The template source to describe.
 * @returns A display string suitable for showing in the suggestion list.
 */
function templateDisplayName(source: TemplateSource, basesFolder: string): string {
  if (source instanceof VaultTemplateSource) {
    const prefix = basesFolder ? `${basesFolder}/` : '';
    const relative = source.path.startsWith(prefix) ? source.path.slice(prefix.length) : source.path;
    return relative.replace(/\.[^.]+$/, '');
  }
  return source.toRef();
}

/**
 * Builds and returns the Obsidian `Command` for "Create base from template".
 * The command opens {@link TemplatePicker} when at least one template source is
 * available; otherwise it shows a notice guiding the user to configure one.
 *
 * @param plugin - The loaded `ProgrammaticBases` plugin instance.
 * @returns An Obsidian `Command` object ready to be registered.
 */
export function createBaseFromTemplateCommand(plugin: ProgrammaticBases): Command {
  return {
    id: 'create-base-from-template',
    name: 'Create base from template',
    callback: () => {
      // Guard: require at least one usable template source before opening the picker
      const hasVaultFolder = plugin.app.vault.getFolderByPath(plugin.settings.basesFolder) instanceof TFolder;
      const hasPluginTemplates = [...plugin.allSources.values()].some(s => s.templates && Object.keys(s.templates).length > 0);
      if (!hasVaultFolder && !hasPluginTemplates) {
        new Notice('No templates found. Configure a bases folder in settings or install a template plugin.');
        return;
      }
      // At least one source exists — open the template picker
      new TemplatePicker(plugin.app, plugin).open();
    },
  };
}

// ── Step 1: pick a template ──────────────────────────────────────────────────

/**
 * Step 1 modal: lets the user search and select a template from all available
 * sources (vault folder and plugin-registered templates).  On selection it
 * advances to {@link OutputPathModal}.
 */
export class TemplatePicker extends SuggestModal<TemplateSource> {
  constructor(app: App, private plugin: ProgrammaticBases) {
    super(app);
    this.setPlaceholder('Choose a base template…');
  }

  /**
   * Returns all available templates (vault + plugin-registered) filtered by query.
   *
   * @param query - The current text the user has typed in the search box.
   * @returns Matching `TemplateSource` entries, vault templates first.
   */
  getSuggestions(query: string): TemplateSource[] {
    const q = query.toLowerCase();

    // Collect YAML files from the configured vault folder, filtered by query
    const folder = this.app.vault.getFolderByPath(this.plugin.settings.basesFolder);
    const vaultTemplates: TemplateSource[] = (folder instanceof TFolder)
      ? folder.children
          .filter((f): f is TFile => f instanceof TFile && f.extension === 'yaml')
          .filter(f => f.basename.toLowerCase().includes(q))
          .map(f => new VaultTemplateSource(f))
      : [];

    // Collect external-source templates, flattened from all sources and filtered by query
    const externalTemplates: TemplateSource[] = [];
    for (const [sourceName, externalSource] of this.plugin.allSources) {
      for (const templateName of Object.keys(externalSource.templates ?? {})) {
        if (`${sourceName}:${templateName}`.toLowerCase().includes(q)) {
          externalTemplates.push(new ExternalTemplateSource(sourceName, templateName));
        }
      }
    }

    // Vault templates appear first, followed by plugin-registered templates
    return [...vaultTemplates, ...externalTemplates];
  }

  /**
   * Renders a suggestion item showing the template display name.
   *
   * @param source - The template source to render.
   * @param el - The list-item element provided by Obsidian.
   */
  renderSuggestion(source: TemplateSource, el: HTMLElement) {
    el.setText(templateDisplayName(source, this.plugin.settings.basesFolder));
  }

  /**
   * Reads the template's param specs and opens {@link TemplateConfigurationModal}.
   *
   * @param source - The template source the user selected.
   */
  async onChooseSuggestion(source: TemplateSource) {
    const harvested = await this.plugin.templateEvaluator.collectParams(source);
    new TemplateConfigurationModal(this.app, this.plugin, source, harvested).open();
  }
}

// ── Step 2: configure template ───────────────────────────────────────────────

/** One page of params scoped to a single source (template or component). */
interface ParamPage {
  /** Empty string for template-level params; component path otherwise. */
  sourcePath: string;
  /** All params declared by this source, in discovery order. */
  params: [string, HarvestedParam][];
}

/**
 * Multi-page modal that walks the user through each param source in turn,
 * then finishes on an output-location page where the "Create" button lives.
 *
 * Page sequence:
 *   0..N-1  One page per source that declared at least one param
 *           (template first `""`, then components in discovery order)
 *   N       Output location — always the last page; "Create" button lives here
 *
 * Advances to {@link ConfirmOverwriteModal} if the target path already exists.
 */
export class TemplateConfigurationModal extends Modal {
  private currentPage = 0;
  private readonly paramPages: ParamPage[];
  private outputFolder: string;
  private outputName: string;
  private readonly values: ResolvedParams = {};
  private pageErrors: Record<string, string> = {};

  constructor(
    app: App,
    private readonly plugin: ProgrammaticBases,
    private readonly template: TemplateSource,
    harvested: HarvestedParams,
  ) {
    super(app);

    // Default output location: active file's folder, template name as filename
    const activeFile = app.workspace.getActiveFile();
    this.outputFolder = activeFile?.parent?.path ?? '';
    this.outputName = template instanceof VaultTemplateSource ? template.file.basename : template.templateName;

    // Build one page per unique source, preserving discovery order
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

    // Pre-fill defaults into per-source scoped keys using each source's own spec
    for (const [paramName, entry] of Object.entries(harvested)) {
      for (const [src, spec] of Object.entries(entry.specs)) {
        let defaultVal: ParamValue;
        if (spec.default !== undefined) {
          defaultVal = spec.default;
        } else if (spec.type === 'boolean') {
          defaultVal = false;
        } else if (spec.type === 'enum') {
          defaultVal = spec.options[0] ?? '';
        } else {
          defaultVal = '';
        }
        const key = src ? `${src}>${paramName}` : paramName;
        this.values[key] = defaultVal as ParamValue;
      }
    }
  }

  private get outputPath(): string {
    return this.outputFolder
      ? normalizePath(`${this.outputFolder}/${this.outputName}`)
      : this.outputName;
  }

  /** Total pages = param pages + 1 output-location page. */
  private get totalPages(): number {
    return this.paramPages.length + 1;
  }

  private get isOnOutputPage(): boolean {
    return this.currentPage === this.paramPages.length;
  }

  onOpen() {
    this.titleEl.setText('Create base from template');
    this.renderCurrentPage();
  }

  onClose() {
    this.contentEl.empty();
  }

  private renderCurrentPage() {
    this.contentEl.empty();
    if (!this.isOnOutputPage) {
      this.renderParamPage(this.paramPages[this.currentPage]!);
    } else {
      this.renderOutputPage();
    }
  }

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

    this.renderNav();
  }

  private renderOutputPage() {
    this.contentEl.createEl('p', {
      text: `Step ${this.currentPage + 1} of ${this.totalPages}`,
      cls: 'setting-item-description',
    });

    new Setting(this.contentEl)
      .setName('Folder')
      .setDesc('Vault-relative folder for the new .base file.')
      .addText(text => {
        text.inputEl.style.width = '100%';
        new FolderSuggest(this.app, text.inputEl);
        text
          .setValue(this.outputFolder)
          .onChange(value => { this.outputFolder = value.trim(); });
      });

    const fileNameSetting = new Setting(this.contentEl)
      .setName('File name')
      .addText(text => {
        text.inputEl.style.width = '100%';
        text
          .setValue(this.outputName)
          .onChange(value => { this.outputName = value.trim(); });
      });
    this.renderFieldError(fileNameSetting, this.pageErrors['outputName']);

    this.renderNav();
  }

  /** Validates all required fields and number ranges on a param page.
   *  Returns errors keyed by the field's value key. */
  private validateParamPage(page: ParamPage): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const [name, entry] of page.params) {
      const spec = entry.specs[page.sourcePath]!;
      const key = page.sourcePath ? `${page.sourcePath}>${name}` : name;
      const value = this.values[key];

      if (spec.type !== 'boolean' && !spec.optional && (value === '' || value === undefined)) {
        errors[key] = 'Required';
        continue;
      }

      if (spec.type === 'number' && typeof value === 'number') {
        if (spec.min !== undefined && value < spec.min)
          errors[key] = `Must be at least ${spec.min}`;
        else if (spec.max !== undefined && value > spec.max)
          errors[key] = `Must be at most ${spec.max}`;
      }
    }
    return errors;
  }

  private validateOutputPage(): Record<string, string> {
    if (!this.outputName) return { outputName: 'Required' };
    return {};
  }

  /** Renders a single param field scoped to the given source. */
  private renderField(name: string, entry: HarvestedParam, sourcePath: string) {
    const spec = entry.specs[sourcePath]!;
    const key = sourcePath ? `${sourcePath}>${name}` : name;
    const currentValue = this.values[key] ?? '';

    const setting = new Setting(this.contentEl).setName(spec.label ?? name);

    // Build hint text: (optional, min X, max Y)
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

  private renderFieldError(setting: Setting, error: string | undefined) {
    if (!error) return;
    const el = document.createElement('p');
    el.textContent = error;
    el.style.color = 'var(--text-error)';
    el.style.fontSize = 'var(--font-ui-small)';
    el.style.margin = '-8px 8px 8px';
    el.style.textAlign = 'right';
    setting.settingEl.insertAdjacentElement('afterend', el);
  }

  /** Renders Back / Next / Create buttons for the current page. */
  private renderNav() {
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

    if (!this.isOnOutputPage) {
      nav.addButton(btn => btn
        .setButtonText('Next →')
        .setCta()
        .onClick(() => {
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
        .setButtonText('Create')
        .setCta()
        .onClick(() => {
          const errors = this.validateOutputPage();
          if (Object.keys(errors).length > 0) {
            this.pageErrors = errors;
            this.renderCurrentPage();
            return;
          }
          this.pageErrors = {};
          this.create();
        }));
    }
  }

  private async create(overwrite = false) {
    try {
      if (!overwrite) {
        const hasExtension = /\.[^/\\]+$/.test(this.outputPath);
        const resolvedPath = normalizePath(hasExtension ? this.outputPath : `${this.outputPath}.base`);
        if (this.app.vault.getAbstractFileByPath(resolvedPath) !== null) {
          new ConfirmOverwriteModal(this.app, resolvedPath, () => this.create(true)).open();
          return;
        }
      }

      await (overwrite
        ? this.plugin.templateFileIO.writeBaseFromTemplate(this.template, this.outputPath, this.values)
        : this.plugin.templateFileIO.createBaseFromTemplate(this.template, this.outputPath, this.values));

      new Notice(`${overwrite ? 'Overwrote' : 'Created'} ${this.outputPath}.base`);
      this.close();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Failed to create base: ${msg}`, 0);
    }
  }
}

// ── Step 3: confirm overwrite ────────────────────────────────────────────────

/**
 * Step 3 modal (conditional): shown only when the target path already exists.
 * Asks the user to confirm before overwriting.
 */
export class ConfirmOverwriteModal extends Modal {
  constructor(app: App, private path: string, private onConfirm: () => void) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText('File already exists');

    this.contentEl.createEl('p', {
      text: `"${this.path}" already exists. Do you want to overwrite it?`
    });

    new Setting(this.contentEl)
      .addButton(btn => btn
        .setButtonText('Overwrite')
        .setWarning()
        .onClick(() => {
          this.close();
          this.onConfirm();
        }))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close()));
  }

  onClose() {
    this.contentEl.empty();
  }
}
