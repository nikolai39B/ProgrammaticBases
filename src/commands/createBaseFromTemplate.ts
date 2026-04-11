import { App, Command, Modal, Notice, Setting, SuggestModal, TFile, TFolder, normalizePath } from 'obsidian';
import ProgrammaticBases from 'main';
import { PluginTemplateSource, TemplateSource, VaultTemplateSource } from 'bases/templateSource';

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

    // Collect plugin-registered templates, flattened from all sources and filtered by query
    const pluginTemplates: TemplateSource[] = [];
    for (const [sourceName, externalSource] of this.plugin.allSources) {
      for (const templateName of Object.keys(externalSource.templates ?? {})) {
        if (`${sourceName}:${templateName}`.toLowerCase().includes(q)) {
          pluginTemplates.push(new PluginTemplateSource(sourceName, templateName));
        }
      }
    }

    // Vault templates appear first, followed by plugin-registered templates
    return [...vaultTemplates, ...pluginTemplates];
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
   * Opens the output path modal for the chosen template.
   *
   * @param source - The template source the user selected.
   */
  onChooseSuggestion(source: TemplateSource) {
    new OutputPathModal(this.app, this.plugin, source).open();
  }
}

// ── Step 2: confirm output path ──────────────────────────────────────────────

/**
 * Step 2 modal: prompts the user to confirm (or change) the vault-relative output
 * path for the new `.base` file.  Defaults to the folder of the currently active
 * file, with the template name as the filename.  Advances to
 * {@link ConfirmOverwriteModal} if the target path already exists.
 */
export class OutputPathModal extends Modal {
  private outputPath: string;

  /**
   * @param app - The Obsidian app instance.
   * @param plugin - The loaded `ProgrammaticBases` plugin instance.
   * @param template - The template source selected in the previous step.
   */
  constructor(app: App, private plugin: ProgrammaticBases, private template: TemplateSource) {
    super(app);

    // Default output path: folder of the active file + template name (or just the name if no file is open)
    const activeFile = app.workspace.getActiveFile();
    const folder = activeFile?.parent?.path ?? '';
    const name = template instanceof VaultTemplateSource ? template.file.basename : template.templateName;
    this.outputPath = folder ? normalizePath(`${folder}/${name}`) : name;
  }

  /** Renders the output path text field and the Create button. */
  onOpen() {
    this.titleEl.setText('Create base from template');

    // Text field pre-populated with the default path; syncs to this.outputPath on every keystroke
    new Setting(this.contentEl)
      .setName('Output path')
      .setDesc('Vault-relative path for the new .base file.')
      .addText(text => {
        text.inputEl.style.width = '100%';
        text
          .setValue(this.outputPath)
          .onChange(value => { this.outputPath = value.trim(); });
      });

    // Primary action button that triggers the write
    new Setting(this.contentEl)
      .addButton(btn => btn
        .setButtonText('Create')
        .setCta()
        .onClick(() => this.create()));
  }

  /** Cleans up the modal DOM on close. */
  onClose() {
    this.contentEl.empty();
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
        ? this.plugin.templateFileManager.writeBaseFromTemplate(this.template, this.outputPath)
        : this.plugin.templateFileManager.createBaseFromTemplate(this.template, this.outputPath));

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
