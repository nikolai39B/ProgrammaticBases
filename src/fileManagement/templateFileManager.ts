import { App } from 'obsidian';
import { ExternalSource } from 'settings';
import { BaseBuilder } from 'bases/baseBuilder';
import { BaseConfig } from 'bases/baseConfig';
import { TemplateSource, VaultTemplateSource } from 'bases/templateSource';
import { BaseFileManager } from 'fileManagement/baseFileManager';
import { VaultDeserializer } from 'fileManagement/vaultDeserializer';
import { ViewRegistry } from 'views/viewRegistry';

/**
 * Handles the "template → BaseConfig → .base file" pipeline.
 * Accepts either a {@link VaultTemplateSource} (vault-relative path) or a
 * {@link PluginTemplateSource} (qualified "sourceName:templateName" ref).
 * Stamps `pb-metadata.template` with the template ref so the base can be
 * re-applied later via the update command.
 */
export class TemplateFileManager {
  constructor(
    private readonly app: App,
    private readonly fileManager: BaseFileManager,
    private readonly viewRegistry: ViewRegistry,
    private readonly getSources: () => Map<string, ExternalSource>,
    private readonly getComponentsFolder: () => string,
  ) {}

  /**
   * Deserializes `source`, stamps metadata, and creates a new .base file.
   * Throws if the output file already exists.
   */
  async createBaseFromTemplate(source: TemplateSource, outputPath: string): Promise<void> {
    const config = await this.loadTemplate(source);
    await this.fileManager.createBase(config, outputPath);
  }

  /**
   * Deserializes `source`, stamps metadata, and writes a .base file.
   * Overwrites if the file already exists.
   */
  async writeBaseFromTemplate(source: TemplateSource, outputPath: string): Promise<void> {
    const config = await this.loadTemplate(source);
    await this.fileManager.writeBase(config, outputPath);
  }

  private async loadTemplate(source: TemplateSource): Promise<BaseConfig> {
    const sources = this.getSources();
    const deserializer = new VaultDeserializer(this.app, sources, this.getComponentsFolder());

    let raw: unknown;
    if (source instanceof VaultTemplateSource) {
      try {
        raw = await deserializer.deserialize(source.path);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.startsWith('File not found:')) {
          throw new Error(
            `Template file not found: "${source.path}". If you moved your bases folder, update the path in pb-metadata.template.`
          );
        }
        throw e;
      }
    } else {
      const externalSource = sources.get(source.sourceName);
      if (!externalSource) throw new Error(`Unknown template source: "${source.sourceName}"`);
      const content = externalSource.templates?.[source.templateName];
      if (!content) throw new Error(`Template "${source.templateName}" not found in source "${source.sourceName}"`);
      raw = await deserializer.deserializeContent(content, source.toRef());
    }

    const config = BaseConfig.deserialize(raw as Record<string, unknown>, this.viewRegistry);
    return new BaseBuilder(config, this.viewRegistry)
      .setMetadata({ template: source.toRef() })
      .build();
  }
}
