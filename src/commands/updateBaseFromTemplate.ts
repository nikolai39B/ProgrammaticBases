import * as yaml from 'js-yaml';
import { App, Command, Modal, Notice, Setting } from 'obsidian';
import ProgrammaticBases from 'main';
import { BaseMetadataUtils } from 'bases/baseMetadata';

/** Returns the Obsidian `Command` object for the "Update base from template" command. */
export function updateBaseFromTemplateCommand(plugin: ProgrammaticBases): Command {
  return {
    // Command id and name
    id: 'update-base-from-template',
    name: 'Update base from template',

    // Command invoked callback
    callback: async () => {
      // Get the active file's content
      const activeFile = plugin.app.workspace.getActiveFile();
      if (!activeFile || activeFile.extension !== 'base') {
        new Notice('No .base file is currently open.');
        return;
      }
      const content = await plugin.app.vault.read(activeFile);

      // Extract the metadata from the file's raw YAML
      const raw = yaml.load(content) as Record<string, unknown>;
      const metaRaw = raw[BaseMetadataUtils.KEY] as Record<string, unknown> | undefined;

      // Extract the template path from the metadata
      const templatePath = metaRaw ? BaseMetadataUtils.deserialize(metaRaw).template : undefined;
      if (!templatePath) {
        new Notice('This base has no template stored in its metadata.');
        return;
      }

      // Confirm the update with the user
      new ConfirmUpdateModal(plugin.app, activeFile.name, templatePath, async () => {
        try {
          await plugin.templateFileIO.writeBaseFromStoredRef(templatePath, activeFile.path);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          new Notice(`Failed to update base: ${msg}`, 0);
        }
      }).open();
    },
  };
}

// ── Confirm update modal ─────────────────────────────────────────────────────

class ConfirmUpdateModal extends Modal {
  constructor(
    app: App,
    private fileName: string,
    private templatePath: string,
    private onConfirm: () => Promise<void>,
  ) {
    super(app);
  }

  onOpen() {
    this.titleEl.setText('Update base from template');

    this.contentEl.createEl('p', {
      text: `This will overwrite "${this.fileName}" with the template at "${this.templatePath}". This cannot be undone.`,
    });

    new Setting(this.contentEl)
      .addButton(btn => btn
        .setButtonText('Update')
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
