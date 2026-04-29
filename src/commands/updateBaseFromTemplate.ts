import * as yaml from 'js-yaml';
import { Notice, Command } from 'obsidian';
import ProgrammaticBases from 'main';
import { BaseMetadataUtils } from 'bases/baseMetadata';
import { HarvestedParams, ResolvedParams } from 'bases/templateParams';
import { TemplateSource } from 'bases/templateSource';
import { ParamConfigModal } from 'commands/paramConfigModal';

/** Returns the Obsidian `Command` object for the "Update base from template" command. */
export function updateBaseFromTemplateCommand(plugin: ProgrammaticBases): Command {
  return {
    id: 'update-base-from-template',
    name: 'Update base from template',
    callback: async () => {
      // Get the active file and validate that it's a base
      const activeFile = plugin.app.workspace.getActiveFile();
      if (!activeFile || activeFile.extension !== 'base') {
        new Notice('No .base file is currently open.');
        return;
      }

      // Load the base yaml
      const content = await plugin.app.vault.read(activeFile);
      const raw = yaml.load(content, { schema: yaml.CORE_SCHEMA }) as Record<string, unknown>;

      // Deserialize the metadata to get the template file ref
      const metaRaw = raw[BaseMetadataUtils.KEY] as Record<string, unknown> | undefined;
      const meta = metaRaw ? BaseMetadataUtils.deserialize(metaRaw) : undefined;
      if (!meta?.template) {
        new Notice('This base has no template stored in its metadata.');
        return;
      }

      // Parse the ref to get the source
      const source = plugin.templateSourceResolver.parseRef(meta.template, 'base');

      // Get the parameters from the template
      const harvested = await plugin.templateEvaluator.collectParams(source);

      // Create the modal
      new UpdateConfigurationModal(
        plugin.app,
        plugin,
        source,
        harvested,
        meta.params ?? {},
        activeFile.path,
      ).open();
    },
  };
}

// ── Update configuration modal ───────────────────────────────────────────────

/**
 * Multi-page param modal for updating an existing base.
 *
 * Unlike {@link TemplateConfigurationModal}, there is no output-location page —
 * the file path is fixed. The "Update" button appears on the last param page
 * (or immediately if there are no params).
 */
export class UpdateConfigurationModal extends ParamConfigModal {
  constructor(
    app: ConstructorParameters<typeof ParamConfigModal>[0],
    plugin: ProgrammaticBases,
    template: TemplateSource,
    harvested: HarvestedParams,
    initialValues: ResolvedParams,
    private readonly fixedOutputPath: string,
  ) {
    super(app, plugin, template, harvested, initialValues);
  }

  //-- Attributes
  protected get totalPages(): number { return this.paramPages.length; }
  protected get isOnFinalPage(): boolean { return this.currentPage >= this.paramPages.length - 1; }
  protected get finalButtonLabel(): string { return 'Update'; }
  protected get modalTitle(): string { return 'Update base from template'; }

  // For claude: where is this called?
  protected renderFinalContent() {
    // Only reached when there are no param pages
    this.contentEl.createEl('p', {
      text: 'No parameters to configure.',
      cls: 'setting-item-description',
    });
  }

  // For claude: where is this called?
  protected onFinalAction() {
    this.update();
  }

  private async update() {
    try {
      // Attempt to update and write the base
      await this.plugin.templateFileIO.writeBaseFromTemplate(
        this.template,
        this.fixedOutputPath,
        this.values,
      );

      // Notify success
      new Notice(`Updated ${this.fixedOutputPath}`);
      this.close();
    } catch (e) {
      // Notify failure
      const msg = e instanceof Error ? e.message : String(e);
      new Notice(`Failed to update base: ${msg}`, 0);
    }
  }
}