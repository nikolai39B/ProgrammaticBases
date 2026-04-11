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
 * Orchestrates the "template → BaseConfig → .base file" pipeline.
 *
 * Accepts either a {@link VaultTemplateSource} (vault-relative YAML file) or a
 * `PluginTemplateSource` (qualified `"sourceName:templateName"` ref registered
 * by an external plugin).
 *
 * **Template file format** — two variants are supported:
 * - *Wrapper format*: top-level keys `pb-metadata` and `pb-content`. `pb-metadata.params`
 *   declares typed parameters; `pb-content` holds the actual base YAML.
 * - *Legacy format*: the whole file is treated as the base YAML (no wrapper).
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
   * Pass 1: reads a template's YAML and harvests all param declarations from
   * `pb-metadata.params` at the template level and from every nested component's
   * `pb-metadata.params`.
   *
   * This is called before showing the param-collection modal so the UI knows
   * which params to prompt for and which sources they come from.
   *
   * @param source - The template source to inspect.
   * @returns All discovered params keyed by name, with per-source metadata accumulated.
   */
  async readParamSpecsFromTemplate(source: TemplateSource): Promise<HarvestedParams> {
    const { rawOuter, contentStr, id } = await this.readRawTemplate(source);

    // Collect params declared directly on the template (sourcePath "" = template level).
    const harvested: HarvestedParams = {};
    if (rawOuter && typeof rawOuter === 'object' && !Array.isArray(rawOuter)) {
      const metaRaw = (rawOuter as Record<string, unknown>)['pb-metadata'];
      if (metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)) {
        const specs = parseParamSpecs((metaRaw as Record<string, unknown>)['params']);
        mergeHarvestedParams(harvested, specs, '');
      }
    }

    // Walk all transitively included components via Pass 1 to discover their params.
    // Each component's params are merged with its source path so the modal can
    // show where each param originates and offer per-source overrides.
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
    const sources = this.getSources();
    const { contentStr, id } = await this.readRawTemplate(source);

    // Pass resolvedParams to the deserializer so !exp/!fnc tags can access them.
    const deserializer = new VaultDeserializer(
      this.app,
      sources,
      this.getComponentsFolder(),
      resolvedParams,
    );

    let raw: unknown;
    if (source instanceof VaultTemplateSource) {
      try {
        // contentStr is the original vault text (wrapper or legacy). The deserializer
        // applies the full schema and calls unwrapContent to strip pb-content after parsing,
        // so custom tags inside pb-content are evaluated correctly.
        if (contentStr !== null) {
          raw = await deserializer.deserializeContent(contentStr, id);
        } else {
          // File was found by getFileByPath — fall back to path-based deserialization.
          raw = await deserializer.deserialize(source.path);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Surface a user-friendly message for the common "moved the bases folder" case.
        if (msg.startsWith('File not found:')) {
          throw new Error(
            `Template file not found: "${source.path}". If you moved your bases folder, update the path in pb-metadata.template.`
          );
        }
        throw e;
      }
    } else {
      // Plugin template: contentStr comes from readRawTemplate which already
      // resolved the source lookup; a null contentStr means the template is gone.
      if (!contentStr) throw new Error(`Template "${source.templateName}" not found in source "${source.sourceName}"`);
      raw = await deserializer.deserializeContent(contentStr, source.toRef());
    }

    // Stamp pb-metadata.template so "Update base from template" can find the source later.
    // Only stamp pb-metadata.params when non-empty to keep the file clean for param-free templates.
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
   * Reads the raw text of a template source and pre-parses it with a permissive
   * schema to detect the `pb-metadata` / `pb-content` wrapper format.
   *
   * Returns three values consumed by the two public passes:
   * - `rawOuter`: the top-level parsed object (noop tags replaced with `null`),
   *   used only to read `pb-metadata.params` — never passed to the real deserializer.
   * - `contentStr`: the original source text (vault file or plugin string),
   *   passed verbatim to {@link VaultDeserializer} so the full schema evaluates
   *   custom tags correctly.
   * - `id`: a stable identifier used for circular-reference detection.
   *
   * The permissive noop schema is necessary because `!sub`/`!exp`/`!fnc` tags
   * inside `pb-content` would otherwise throw unknown-tag errors before we even
   * know whether the file uses the wrapper format.
   *
   * @param source - The template source to read.
   * @returns `{ rawOuter, contentStr, id }` — `contentStr` is `null` if the file does not exist.
   */
  private async readRawTemplate(source: TemplateSource): Promise<{
    rawOuter: unknown;
    contentStr: string | null;
    id: string;
  }> {
    // Build a schema that accepts !sub/!exp/!fnc as no-ops so yaml.load doesn't
    // throw before we can inspect the top-level keys.
    const noopTag = (name: string) => new yaml.Type(name, {
      kind: 'scalar', resolve: () => true, construct: () => null,
    });
    const safeSchema = yaml.CORE_SCHEMA.extend([noopTag('!sub'), noopTag('!exp'), noopTag('!fnc')]);

    if (source instanceof VaultTemplateSource) {
      const file = this.app.vault.getFileByPath(source.path);
      if (!file) return { rawOuter: null, contentStr: null, id: source.path };
      const text = await this.app.vault.read(file);
      const rawOuter = yaml.load(text, { schema: safeSchema }) as Record<string, unknown> | null;
      // Always return the original text as contentStr. The real deserializer will
      // call unwrapContent after applying the full schema, preserving custom tags.
      return { rawOuter, contentStr: text, id: source.path };
    } else {
      const sources = this.getSources();
      const externalSource = sources.get(source.sourceName);
      const content = externalSource?.templates?.[source.templateName] ?? null;
      if (!content) return { rawOuter: null, contentStr: null, id: source.toRef() };
      const rawOuter = yaml.load(content, { schema: safeSchema }) as Record<string, unknown> | null;
      return { rawOuter, contentStr: content, id: source.toRef() };
    }
  }
}
