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
   * Reads the template's param specs and opens {@link OutputPathModal}, which
   * collects any params and the output path in a single step.
   *
   * @param source - The template source the user selected.
   */
  async onChooseSuggestion(source: TemplateSource) {
    const harvested = await this.plugin.templateFileIO.readParamSpecsFromTemplate(source);
    new OutputPathModal(this.app, this.plugin, source, harvested).open();
  }
}

// ── Step 2: collect params + confirm output path ─────────────────────────────

/**
 * Single modal that collects template parameters (if any) and the vault-relative
 * output path for the new `.base` file.  Param fields are rendered first; the
 * output path field appears at the bottom.  Defaults to the folder of the
 * currently active file with the template name as the filename.
 *
 * Advances to {@link ConfirmOverwriteModal} if the target path already exists.
 */
export class OutputPathModal extends Modal {
  private outputFolder: string;
  private outputName: string;
  private values: ResolvedParams = {};

  /**
   * @param app - The Obsidian app instance.
   * @param plugin - The loaded `ProgrammaticBases` plugin instance.
   * @param template - The template source selected in the previous step.
   * @param harvested - All params discovered across the template and its components.
   */
  constructor(
    app: App,
    private plugin: ProgrammaticBases,
    private template: TemplateSource,
    private harvested: HarvestedParams,
  ) {
    super(app);

    // Default: folder from the active file, name from the template
    const activeFile = app.workspace.getActiveFile();
    this.outputFolder = activeFile?.parent?.path ?? '';
    this.outputName = template instanceof VaultTemplateSource ? template.file.basename : template.templateName;

    // Pre-fill defaults and fan out to all source-scoped keys
    for (const [paramName, entry] of Object.entries(harvested)) {
      const defaultVal = entry.spec.default ?? (entry.spec.type === 'boolean' ? false : '');
      this.setParamValue(paramName, entry, defaultVal as ParamValue);
    }
  }

  /** Combines outputFolder and outputName into a single vault-relative path. */
  private get outputPath(): string {
    return this.outputFolder
      ? normalizePath(`${this.outputFolder}/${this.outputName}`)
      : this.outputName;
  }

  /** Renders param fields (if any), the output location fields, and action buttons. */
  onOpen() {
    this.titleEl.setText('Create base from template');

    // Param fields come first
    for (const [name, entry] of Object.entries(this.harvested)) {
      this.renderParamSetting(name, entry);
    }

    // Folder field with autocomplete
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

    // File name field (no extension needed — .base is appended automatically)
    new Setting(this.contentEl)
      .setName('File name')
      .addText(text => {
        text.inputEl.style.width = '100%';
        text
          .setValue(this.outputName)
          .onChange(value => { this.outputName = value.trim(); });
      });

    // Action buttons
    new Setting(this.contentEl)
      .addButton(btn => btn
        .setButtonText('Create')
        .setCta()
        .onClick(() => this.create()))
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close()));
  }

  /** Cleans up the modal DOM on close. */
  onClose() {
    this.contentEl.empty();
  }

  /**
   * Renders a single param as an Obsidian Setting row with the appropriate control.
   * Multi-source params include a "Split" button to allow per-source overrides.
   */
  private renderParamSetting(name: string, entry: HarvestedParam, splitSourcePath?: string) {
    const isRoot = splitSourcePath === undefined;
    const label = isRoot ? (entry.spec.label ?? name) : splitSourcePath;
    const currentValue = isRoot
      ? (this.values[name] ?? '')
      : (this.values[`${splitSourcePath}>${name}`] ?? this.values[name] ?? '');

    const setting = new Setting(this.contentEl).setName(label);

    const namedSources = entry.sources.filter(s => s !== '');
    if (isRoot && namedSources.length > 1) {
      setting.setDesc(`Sources: ${namedSources.join(', ')}`);
    }

    switch (entry.spec.type) {
      case 'boolean':
        setting.addToggle(toggle =>
          toggle
            .setValue(Boolean(currentValue))
            .onChange(v => this.setParamValue(name, entry, v, isRoot ? undefined : splitSourcePath)));
        break;

      case 'folder':
        setting.addText(text => {
          new FolderSuggest(this.app, text.inputEl);
          text
            .setValue(String(currentValue))
            .onChange(v => this.setParamValue(name, entry, v.trim(), isRoot ? undefined : splitSourcePath));
        });
        break;

      case 'number':
        setting.addText(text =>
          text
            .setValue(String(currentValue))
            .onChange(v => {
              const n = parseFloat(v);
              if (!isNaN(n)) this.setParamValue(name, entry, n, isRoot ? undefined : splitSourcePath);
            }));
        break;

      default: // string, date, datetime
        setting.addText(text =>
          text
            .setValue(String(currentValue))
            .onChange(v => this.setParamValue(name, entry, v, isRoot ? undefined : splitSourcePath)));
        break;
    }

    // Show Split button only when multiple named (component-level) sources declare this param
    if (isRoot && namedSources.length > 1) {
      setting.addButton(btn =>
        btn.setButtonText('Split').onClick(() => {
          // Remove the merged-value setting and replace with per-source inputs
          setting.settingEl.remove();
          for (const src of entry.sources) {
            this.renderParamSetting(name, entry, src);
          }
        }));
    }
  }

  /**
   * Writes a param value into `this.values`, fanning it out to all source-scoped
   * keys when `splitSourcePath` is undefined (merged mode).
   */
  private setParamValue(
    name: string,
    entry: HarvestedParam,
    value: ParamValue,
    splitSourcePath?: string,
  ) {
    if (splitSourcePath !== undefined) {
      // Split mode: write only the specific source-scoped key
      this.values[`${splitSourcePath}>${name}`] = value;
    } else {
      // Merged mode: fan out to all source-scoped keys and the template-level key
      for (const src of entry.sources) {
        if (src === '') {
          this.values[name] = value;
        } else {
          this.values[`${src}>${name}`] = value;
        }
      }
      // Also write a plain key as a fallback for template-level declarations
      if (!entry.sources.includes('')) {
        this.values[name] = value;
      }
    }
  }

  /**
   * Deserializes the template, writes the `.base` file, and shows a notice.
   * If the file already exists and `overwrite` is false, opens
   * {@link ConfirmOverwriteModal} instead of writing.
   *
   * @param overwrite - When true, calls `writeBaseFromTemplate` (upsert) instead
   *   of `createBaseFromTemplate` (throws on existing file).
   * @throws Will surface any vault I/O errors as an Obsidian Notice.
   */
  private async create(overwrite = false) {
    try {
      // Check if the file already exists
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
