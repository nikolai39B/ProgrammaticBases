import { App, Command, Modal, Notice, Setting, SuggestModal, TFile, TFolder, normalizePath } from 'obsidian';
import ProgrammaticBases from 'main';
import { QualifiedTemplateSource, TemplateSource } from 'bases/templateSource';
import { FolderSuggest } from 'settings';
import { HarvestedParams } from 'bases/templateParams';
import { ParamConfigModal } from 'commands/paramConfigModal';

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
 * advances to {@link TemplateConfigurationModal}.
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
          .map(f => this.plugin.templateSourceResolver.sourceFromFile(f, 'base'))
      : [];

    // Collect qualified-source templates, flattened from all sources and filtered by query
    const qualifiedTemplates: TemplateSource[] = [];
    for (const [sourceName, qualifiedSource] of this.plugin.allSources) {
      for (const templateName of Object.keys(qualifiedSource.templates ?? {})) {
        if (`${sourceName}:${templateName}`.toLowerCase().includes(q)) {
          qualifiedTemplates.push(new QualifiedTemplateSource(sourceName, templateName));
        }
      }
    }

    // Vault templates appear first, followed by qualified-source templates
    return [...vaultTemplates, ...qualifiedTemplates];
  }

  /**
   * Renders a suggestion item showing the template source ref.
   *
   * @param source - The template source to render.
   * @param el - The list-item element provided by Obsidian.
   */
  renderSuggestion(source: TemplateSource, el: HTMLElement) {
    el.setText(source.toRef());
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
export class TemplateConfigurationModal extends ParamConfigModal {
  private outputFolder: string;
  private outputName: string;

  constructor(
    app: App,
    plugin: ProgrammaticBases,
    template: TemplateSource,
    harvested: HarvestedParams,
  ) {
    super(app, plugin, template, harvested);

    // Default output location: active file's folder, template name as filename
    const activeFile = app.workspace.getActiveFile();
    this.outputFolder = activeFile?.parent?.path ?? '';
    this.outputName = template.toName();
  }

  protected get totalPages(): number { return this.paramPages.length + 1; }
  protected get isOnFinalPage(): boolean { return this.currentPage === this.paramPages.length; }
  protected get finalButtonLabel(): string { return 'Create'; }
  protected get modalTitle(): string { return 'Create base from template'; }

  private get outputPath(): string {
    return this.outputFolder
      ? normalizePath(`${this.outputFolder}/${this.outputName}`)
      : this.outputName;
  }

  protected renderFinalContent() {
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
  }

  protected onFinalAction() {
    const errors = this.validateOutputPage();
    if (Object.keys(errors).length > 0) {
      this.pageErrors = errors;
      this.renderCurrentPage();
      return;
    }
    this.pageErrors = {};
    this.create();
  }

  private validateOutputPage(): Record<string, string> {
    if (!this.outputName) return { outputName: 'Required' };
    return {};
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
