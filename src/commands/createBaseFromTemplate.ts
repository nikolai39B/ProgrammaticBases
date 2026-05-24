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
      const sources = [...plugin.allSources.values()];
      const hasPluginTemplates = sources.some(s => s.templates && Object.keys(s.templates).length > 0);

      // If there's no templates, notify and return
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
  /**
   * @param app - The Obsidian app instance.
   * @param plugin - The loaded plugin, used to access settings, sources, and the evaluator.
   */
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
   * Called by Obsidian when the user selects a template. Delegates to
   * {@link openConfigModal} so this override can stay sync (base class expects void).
   */
  onChooseSuggestion(source: TemplateSource) {
    void this.openConfigModal(source);
  }

  /**
   * Collects params from the selected template then opens {@link TemplateConfigurationModal}.
   * Errors are surfaced to the user via a Notice rather than propagating up.
   */
  private async openConfigModal(source: TemplateSource) {
    try {
      const harvested = await this.plugin.templateEvaluator.collectTemplateParams(source);
      new TemplateConfigurationModal(this.app, this.plugin, source, harvested).open();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Failed to load template: ${msg}`);
    }
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

  /**
   * @param app - The Obsidian app instance.
   * @param plugin - The loaded plugin, used to write the output file.
   * @param template - The template source selected in {@link TemplatePicker}.
   * @param harvested - Param specs collected from the template and its components.
   */
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

  /** Total pages = one per param source + the output location page. */
  protected get totalPages(): number { return this.paramPages.length + 1; }

  /** True when the user is on the output location page (last page). */
  protected get isOnFinalPage(): boolean { return this.currentPage === this.paramPages.length; }

  /** Label for the primary action button on the final page. */
  protected get finalButtonLabel(): string { return 'Create'; }

  /** Title displayed in the modal header. */
  protected get modalTitle(): string { return 'Create base from template'; }

  /**
   * The resolved vault-relative output path, combining folder and filename.
   * When no folder is set, returns just the filename.
   */
  private get outputPath(): string {
    return this.outputFolder
      ? normalizePath(`${this.outputFolder}/${this.outputName}`)
      : this.outputName;
  }

  /**
   * Renders the output location page: folder suggester and filename input.
   * Inline validation errors are displayed below the filename field.
   */
  protected renderFinalContent() {
    // Progress indicator at the top of the page
    this.contentEl.createEl('p', {
      text: `Step ${this.currentPage + 1} of ${this.totalPages}`,
      cls: 'setting-item-description',
    });

    // Folder field — pre-filled with the active file's parent folder (or empty for vault root)
    // FolderSuggest wires up autocomplete so the user can search existing vault folders
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

    // File name field — pre-filled with the template name, editable by the user
    // renderFieldError shows an inline error below this field if validation fails
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

  /**
   * Called when the user clicks "Create" on the output location page.
   * Validates the output name; if valid, proceeds to {@link create}.
   */
  protected onFinalAction() {
    const errors = this.validateOutputPage();
    if (Object.keys(errors).length > 0) {
      this.pageErrors = errors;
      this.renderCurrentPage();
      return;
    }
    this.pageErrors = {};
    // Not awaited — create() handles its own errors via Notice and closes the modal on success
    void this.create();
  }

  /**
   * Validates the output location page fields.
   *
   * @returns A map of field name → error message for any invalid fields,
   *   or `{}` if all fields are valid.
   */
  private validateOutputPage(): Record<string, string> {
    if (!this.outputName) return { outputName: 'Required' };
    return {};
  }

  /**
   * Wraps {@link ConfirmOverwriteModal} in a Promise so `create` can await the
   * user's decision rather than using a callback.
   *
   * Resolves `true` if the user confirms, `false` if they cancel or dismiss.
   */
  private confirmOverwrite(resolvedPath: string): Promise<boolean> {
    return new Promise(resolve => {
      new ConfirmOverwriteModal(
        this.app,
        resolvedPath,
        () => resolve(true),
        () => resolve(false),
      ).open();
    });
  }

  /**
   * Evaluates the template and writes the output file.
   *
   * If the target path already exists, awaits the user's confirmation via
   * {@link ConfirmOverwriteModal} before proceeding. Aborts silently if the
   * user cancels or dismisses.
   */
  private async create() {
    try {
      // Normalise the path — append .base if the user didn't type an extension
      const hasExtension = /\.[^/\\]+$/.test(this.outputPath);
      const resolvedPath = normalizePath(hasExtension ? this.outputPath : `${this.outputPath}.base`);

      // If the file already exists, pause until the user decides
      const fileExists = this.app.vault.getAbstractFileByPath(resolvedPath) !== null;
      if (fileExists) {
        const confirmed = await this.confirmOverwrite(resolvedPath);
        if (!confirmed) return;
      }

      await this.plugin.templateFileIO.writeBaseFromTemplate(this.template, this.outputPath, this.values);
      new Notice(`${fileExists ? 'Overwrote' : 'Created'} ${this.outputPath}.base`);
      this.close();
    } catch (e) {
      // Surface the error to the user without closing the modal, so they can correct it
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
  /**
   * @param app - The Obsidian app instance.
   * @param path - The vault-relative path that already exists, shown in the prompt.
   * @param onConfirm - Callback invoked when the user clicks "Overwrite".
   * @param onCancel - Callback invoked when the user clicks "Cancel" or dismisses.
   */
  constructor(
    app: App,
    private path: string,
    private onConfirm: () => void,
    private onCancel: () => void,
  ) {
    super(app);
  }

  /** Renders the confirmation prompt and Overwrite / Cancel buttons. */
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
        .onClick(() => {
          this.close();
          this.onCancel();
        }));
  }

  /** Clears the modal content on close to prevent DOM leaks. */
  onClose() {
    this.contentEl.empty();
  }
}
