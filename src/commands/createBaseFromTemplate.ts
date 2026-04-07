import { App, Command, Modal, Notice, Setting, SuggestModal, TFile, TFolder, normalizePath } from 'obsidian';
import ProgrammaticBases from 'main';
import { VaultDeserializer } from 'fileManagement/vaultDeserializer';
import { BaseConfig } from 'bases/baseConfig';
import { BaseTemplate } from 'settings';

type TemplateOption =
  | { source: 'vault'; file: TFile }
  | { source: 'plugin'; template: BaseTemplate };

function templateName(opt: TemplateOption): string {
  return opt.source === 'vault' ? opt.file.basename : opt.template.name;
}

/** Returns the Obsidian `Command` object for the "Create base from template" command. */
export function createBaseFromTemplateCommand(plugin: ProgrammaticBases): Command {
  return {
    id: 'create-base-from-template',
    name: 'Create base from template',
    callback: () => {
      const hasVaultFolder = plugin.app.vault.getFolderByPath(plugin.settings.basesFolder) instanceof TFolder;
      const hasPluginTemplates = plugin.allBaseTemplates.length > 0;
      if (!hasVaultFolder && !hasPluginTemplates) {
        new Notice('No templates found. Configure a bases folder in settings or install a template plugin.');
        return;
      }
      new TemplatePicker(plugin.app, plugin).open();
    },
  };
}

// ── Step 1: pick a template ──────────────────────────────────────────────────

export class TemplatePicker extends SuggestModal<TemplateOption> {
  constructor(app: App, private plugin: ProgrammaticBases) {
    super(app);
    this.setPlaceholder('Choose a base template…');
  }

  /** Returns all available templates (vault + plugin-registered) filtered by query. */
  getSuggestions(query: string): TemplateOption[] {
    const q = query.toLowerCase();

    // Vault templates
    const folder = this.app.vault.getFolderByPath(this.plugin.settings.basesFolder);
    const vaultTemplates: TemplateOption[] = (folder instanceof TFolder)
      ? folder.children
          .filter((f): f is TFile => f instanceof TFile && f.extension === 'yaml')
          .filter(f => f.basename.toLowerCase().includes(q))
          .map(f => ({ source: 'vault', file: f }))
      : [];

    // Plugin-registered templates
    const pluginTemplates: TemplateOption[] = this.plugin.allBaseTemplates
      .filter(t => t.name.toLowerCase().includes(q))
      .map(t => ({ source: 'plugin', template: t }));

    return [...vaultTemplates, ...pluginTemplates];
  }

  /** Renders a suggestion item showing the template name and its source. */
  renderSuggestion(opt: TemplateOption, el: HTMLElement) {
    el.setText(templateName(opt));
    if (opt.source === 'plugin') {
      el.createSpan({ cls: 'suggestion-flair', text: opt.template.source });
    }
  }

  /** Opens the output path modal for the chosen template. */
  onChooseSuggestion(opt: TemplateOption) {
    new OutputPathModal(this.app, this.plugin, opt).open();
  }
}

// ── Step 2: confirm output path ──────────────────────────────────────────────

export class OutputPathModal extends Modal {
  private outputPath: string;

  constructor(app: App, private plugin: ProgrammaticBases, private template: TemplateOption) {
    super(app);

    const activeFile = app.workspace.getActiveFile();
    const folder = activeFile?.parent?.path ?? '';
    const name = templateName(template);
    this.outputPath = folder ? normalizePath(`${folder}/${name}`) : name;
  }

  /** Renders the output path text field and the Create button. */
  onOpen() {
    this.titleEl.setText('Create base from template');

    new Setting(this.contentEl)
      .setName('Output path')
      .setDesc('Vault-relative path for the new .base file.')
      .addText(text => {
        text.inputEl.style.width = '100%';
        text
          .setValue(this.outputPath)
          .onChange(value => { this.outputPath = value.trim(); });
      });

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

  /** Deserializes the template, writes the .base file, and shows a notice. */
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

      // Deserialize the template
      const deserializer = new VaultDeserializer(this.app, this.plugin.allComponentSources, this.plugin.allComponentsFolders);
      const raw = this.template.source === 'vault'
        ? await deserializer.deserialize(this.template.file.path)
        : await deserializer.deserializeContent(this.template.template.content, `${this.template.template.source}:${this.template.template.name}`);

      const config = BaseConfig.deserialize(raw as Record<string, unknown>, this.plugin.viewRegistry);

      await (overwrite
        ? this.plugin.fileManager.writeBase(config, this.outputPath)
        : this.plugin.fileManager.createBase(config, this.outputPath));

      new Notice(`${overwrite ? 'Overwrote' : 'Created'} ${this.outputPath}.base`);
      this.close();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Failed to create base: ${msg}`, 0);
    }
  }
}

// ── Step 3: confirm overwrite ────────────────────────────────────────────────

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
