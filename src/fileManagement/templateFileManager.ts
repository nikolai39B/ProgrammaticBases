import { App } from 'obsidian';
import { ExternalSource } from 'settings';
import { BaseBuilder } from 'bases/baseBuilder';
import { BaseConfig } from 'bases/baseConfig';
import { PluginTemplateSource, TemplateSource, VaultTemplateSource } from 'bases/templateSource';
import {
  HarvestedParams,
  ResolvedParams,
} from 'bases/templateParams';
import { BaseFileManager } from 'fileManagement/baseFileManager';
import { VaultDeserializer } from 'fileManagement/vaultDeserializer';
import { ViewRegistry } from 'views/viewRegistry';

/**
 * Orchestrates the "template → BaseConfig → .base file" pipeline.
 *
 * Accepts either a {@link VaultTemplateSource} (vault-relative YAML file) or a
 * `PluginTemplateSource` (qualified `"sourceName:templateName"` ref registered
 * by an external plugin).
 *
 * **Template file format**: `pb-metadata` (optional) at the top level declares typed
 * parameters in `pb-metadata.params`. All other top-level keys are the base YAML content.
 * Files with no `pb-metadata` key are also valid (treated as plain base YAML).
 *
 * Templates are treated the same as components — vault templates are resolved by path
 * directly through {@link VaultDeserializer}; plugin templates supply their content string.
 *
 * **Two-pass loading:**
 * - Pass 1 (`readParamSpecsFromTemplate`): resolves `!sub` only, harvests
 *   `pb-metadata.params` from the template and every transitively included
 *   component, and returns the merged {@link HarvestedParams} so the UI can
 *   prompt the user for values.
 * - Pass 2 (`loadTemplate`): resolves `!sub` and evaluates `!exp`/`!fnc`
 *   against the user-supplied {@link ResolvedParams}, then stamps
 *   `pb-metadata.template` (and optionally `pb-metadata.params`) on the result.
 *
 * After loading, the resulting {@link BaseConfig} is written to the vault via
 * {@link BaseFileManager}.
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
   * Pass 1: harvests all param declarations from `pb-metadata.params` at the
   * template level and from every nested component's `pb-metadata.params`.
   *
   * @param source - The template source to inspect.
   * @returns All discovered params keyed by name, with per-source metadata accumulated.
   */
  async readParamSpecsFromTemplate(source: TemplateSource): Promise<HarvestedParams> {
    const deserializer = new VaultDeserializer(
      this.app,
      this.getSources(),
      this.getComponentsFolder(),
    );

    if (source instanceof VaultTemplateSource) {
      return deserializer.collectFileParams(source.path);
    } else {
      const content = this.pluginTemplateContent(source);
      if (content === null) return {};
      return deserializer.collectContentParams(content, source.toRef());
    }
  }

  /**
   * Deserializes `source` and creates a new `.base` file at `outputPath`.
   *
   * @param source - The template source to apply.
   * @param outputPath - Vault-relative output path (`.base` extension appended if absent).
   * @param resolvedParams - Flat param map collected from the user by the modal.
   * @throws If the output file already exists.
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
   * Deserializes `source` and writes a `.base` file at `outputPath`,
   * overwriting any existing file.
   *
   * @param source - The template source to apply.
   * @param outputPath - Vault-relative output path (`.base` extension appended if absent).
   * @param resolvedParams - Flat param map collected from the user or read from `pb-metadata`.
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
   * evaluating `!exp`/`!fnc` tags against the supplied params.
   *
   * Stamps `pb-metadata.template` on the result so the base can later be
   * re-applied via the "Update base from template" command. Also stamps
   * `pb-metadata.params` when `resolvedParams` is non-empty, so re-application
   * can replay the same values without re-prompting the user.
   *
   * Public so external scripts can call it directly to get a {@link BaseConfig}
   * without immediately writing a file.
   *
   * @param source - The template source to load.
   * @param resolvedParams - Flat param map from the modal or stored in `pb-metadata`.
   * @returns A fully built {@link BaseConfig} with metadata stamped.
   * @throws A user-friendly message if the vault file has been moved or renamed.
   * @throws If the plugin source name or template name is not registered.
   */
  async loadTemplate(
    source: TemplateSource,
    resolvedParams: ResolvedParams = {},
  ): Promise<BaseConfig> {
    const deserializer = new VaultDeserializer(
      this.app,
      this.getSources(),
      this.getComponentsFolder(),
      resolvedParams,
    );

    let raw: unknown;
    if (source instanceof VaultTemplateSource) {
      try {
        raw = await deserializer.deserializeFile(source.path);
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
      const content = this.pluginTemplateContent(source);
      if (content === null) throw new Error(`Template "${source.templateName}" not found in source "${source.sourceName}"`);
      raw = await deserializer.deserializeContent(content, source.toRef());
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

  /** Looks up a plugin template's content string, or null if not registered. */
  private pluginTemplateContent(source: PluginTemplateSource): string | null {
    return this.getSources().get(source.sourceName)?.templates?.[source.templateName] ?? null;
  }
}
