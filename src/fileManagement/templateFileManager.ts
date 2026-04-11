import * as yaml from 'js-yaml';
import { App } from 'obsidian';
import { ExternalSource } from 'settings';
import { BaseBuilder } from 'bases/baseBuilder';
import { BaseConfig } from 'bases/baseConfig';
import { TemplateSource, VaultTemplateSource } from 'bases/templateSource';
import {
  HarvestedParams,
  ResolvedParams,
  mergeHarvestedParams,
  parseParamSpecs,
} from 'bases/templateParams';
import { BaseFileManager } from 'fileManagement/baseFileManager';
import { VaultDeserializer } from 'fileManagement/vaultDeserializer';
import { ViewRegistry } from 'views/viewRegistry';

/**
 * Handles the "template → BaseConfig → .base file" pipeline.
 * Accepts either a {@link VaultTemplateSource} (vault-relative path) or a
 * {@link PluginTemplateSource} (qualified "sourceName:templateName" ref).
 * Stamps `pb-metadata.template` with the template ref so the base can be
 * re-applied later via the update command.
 *
 * Templates use an optional `metadata:` / `content:` wrapper format. If present,
 * `metadata.params` declares the parameters the template accepts; `content:` is
 * the actual base YAML. Without the wrapper the whole file is treated as content.
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
   * Pass 1: reads a template's raw YAML and harvests all param declarations
   * from `metadata.params` and from every nested component's `metadata.params`.
   *
   * @param source - The template source to inspect.
   * @returns All discovered params, keyed by name with sources accumulated.
   */
  async readParamSpecsFromTemplate(source: TemplateSource): Promise<HarvestedParams> {
    const { rawOuter, contentStr, id } = await this.readRawTemplate(source);

    // Collect template-level params (sourcePath "" = declared at template level)
    const harvested: HarvestedParams = {};
    if (rawOuter && typeof rawOuter === 'object' && !Array.isArray(rawOuter)) {
      const metaRaw = (rawOuter as Record<string, unknown>)['metadata'];
      if (metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)) {
        const specs = parseParamSpecs((metaRaw as Record<string, unknown>)['params']);
        mergeHarvestedParams(harvested, specs, '');
      }
    }

    // Harvest component-level params via Pass 1
    if (contentStr) {
      const deserializer = new VaultDeserializer(
        this.app,
        this.getSources(),
        this.getComponentsFolder(),
      );
      const componentParams = await deserializer.harvestParams(contentStr, id);
      for (const [name, entry] of Object.entries(componentParams)) {
        for (const src of entry.sources) {
          mergeHarvestedParams(harvested, { [name]: entry.spec }, src);
        }
      }
    }

    return harvested;
  }

  /**
   * Deserializes `source`, stamps metadata, and creates a new .base file.
   * Throws if the output file already exists.
   *
   * @param source - The template source to apply.
   * @param outputPath - Vault-relative output path.
   * @param resolvedParams - User-supplied param values from the modal.
   */
  async createBaseFromTemplate(
    source: TemplateSource,
    outputPath: string,
    resolvedParams: ResolvedParams = {},
  ): Promise<void> {
    const config = await this.loadTemplate(source, resolvedParams);
    await this.fileManager.createBase(config, outputPath);
  }

  /**
   * Deserializes `source`, stamps metadata, and writes a .base file.
   * Overwrites if the file already exists.
   *
   * @param source - The template source to apply.
   * @param outputPath - Vault-relative output path.
   * @param resolvedParams - User-supplied param values from the modal.
   */
  async writeBaseFromTemplate(
    source: TemplateSource,
    outputPath: string,
    resolvedParams: ResolvedParams = {},
  ): Promise<void> {
    const config = await this.loadTemplate(source, resolvedParams);
    await this.fileManager.writeBase(config, outputPath);
  }

  /**
   * Pass 2: deserializes a template source into a fully-resolved {@link BaseConfig},
   * with `!exp`/`!fnc` evaluated against the supplied params.
   * Stamps `pb-metadata.template` and `pb-metadata.params` on the result.
   *
   * Public so external scripts can call it directly.
   *
   * @param source - The template source to load.
   * @param resolvedParams - Flat param map from the modal (or stored in pb-metadata).
   */
  async loadTemplate(
    source: TemplateSource,
    resolvedParams: ResolvedParams = {},
  ): Promise<BaseConfig> {
    const sources = this.getSources();
    const { contentStr, id } = await this.readRawTemplate(source);

    const deserializer = new VaultDeserializer(
      this.app,
      sources,
      this.getComponentsFolder(),
      resolvedParams,
    );

    let raw: unknown;
    if (source instanceof VaultTemplateSource) {
      try {
        // Use deserializeContent with the extracted content string
        if (contentStr !== null) {
          raw = await deserializer.deserializeContent(contentStr, id);
        } else {
          raw = await deserializer.deserialize(source.path);
        }
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
      // Plugin templates may also use the wrapper format
      const pluginRaw = yaml.load(content) as Record<string, unknown> | null;
      const pluginContent = (pluginRaw && 'content' in pluginRaw)
        ? yaml.dump((pluginRaw as Record<string, unknown>)['content'])
        : content;
      raw = await deserializer.deserializeContent(pluginContent, source.toRef());
    }

    const config = BaseConfig.deserialize(raw as Record<string, unknown>, this.viewRegistry);
    const hasParams = Object.keys(resolvedParams).length > 0;
    return new BaseBuilder(config, this.viewRegistry)
      .setMetadata({
        template: source.toRef(),
        ...(hasParams ? { params: resolvedParams } : {}),
      })
      .build();
  }

  /**
   * Reads a template source and returns its raw outer YAML object,
   * the content string for Pass 1/2, and a stable id.
   */
  private async readRawTemplate(source: TemplateSource): Promise<{
    rawOuter: unknown;
    contentStr: string | null;
    id: string;
  }> {
    if (source instanceof VaultTemplateSource) {
      const file = this.app.vault.getFileByPath(source.path);
      if (!file) return { rawOuter: null, contentStr: null, id: source.path };
      const text = await this.app.vault.read(file);
      const rawOuter = yaml.load(text) as Record<string, unknown> | null;
      // If wrapper format: extract content as re-serialized YAML string
      if (rawOuter && typeof rawOuter === 'object' && 'content' in rawOuter) {
        const contentStr = yaml.dump((rawOuter as Record<string, unknown>)['content'], { lineWidth: -1 });
        return { rawOuter, contentStr, id: source.path };
      }
      // Legacy format: the whole file is content
      return { rawOuter, contentStr: text, id: source.path };
    } else {
      const sources = this.getSources();
      const externalSource = sources.get(source.sourceName);
      const content = externalSource?.templates?.[source.templateName] ?? null;
      if (!content) return { rawOuter: null, contentStr: null, id: source.toRef() };
      const rawOuter = yaml.load(content) as Record<string, unknown> | null;
      if (rawOuter && typeof rawOuter === 'object' && 'content' in rawOuter) {
        const contentStr = yaml.dump((rawOuter as Record<string, unknown>)['content'], { lineWidth: -1 });
        return { rawOuter, contentStr, id: source.toRef() };
      }
      return { rawOuter, contentStr: content, id: source.toRef() };
    }
  }
}
