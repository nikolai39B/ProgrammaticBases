// templateFileIO.ts

import * as yaml from 'js-yaml';
import { BaseBuilder } from 'bases/baseBuilder';
import { BaseConfig } from 'bases/baseConfig';
import { ResolvedParams, HarvestedParams } from 'bases/templateParams';
import { TemplateSource } from 'bases/templateSource';
import { TemplateSourceResolver } from 'bases/templateSource';
import { BaseFileIO } from 'fileManagement/baseFileIO';
import { TemplateEvaluator } from 'fileManagement/templateEvaluator';
import { ViewRegistry } from 'views/viewRegistry';

/**
 * Orchestrates the "template → BaseConfig → .base file" pipeline.
 *
 * Accepts either a {@link VaultTemplateSource} (vault-relative YAML file) or an
 * {@link ExternalTemplateSource} (qualified `"sourceName:templateName"` ref registered
 * by an external plugin).
 *
 * **Two-pass loading:**
 * - Pass 1 (`readParamSpecsFromTemplate`): resolves `!sub` only, harvests
 *   `pb-metadata.params` from the template and every transitively included
 *   component, and returns the merged {@link HarvestedParams} so the UI can
 *   prompt the user for values.
 * - Pass 2 (`evaluateTemplate`): resolves `!sub` and evaluates `!exp`/`!fnc`
 *   against the user-supplied {@link ResolvedParams}, then stamps
 *   `pb-metadata.template` (and optionally `pb-metadata.params`) on the result.
 *
 * File writes are delegated to {@link BaseFileIO}.
 */
export class TemplateFileIO {
  constructor(
    private readonly baseFileIO: BaseFileIO,
    private readonly getViewRegistry: () => ViewRegistry,
    private readonly resolver: TemplateSourceResolver,
    private readonly evaluator: TemplateEvaluator,
  ) {}

  /**
   * Pass 1: harvests all param declarations from `pb-metadata.params` at the
   * template level and from every nested component's `pb-metadata.params`.
   *
   * @param source - The template source to inspect.
   * @returns All discovered params keyed by name, with per-source metadata accumulated.
   */
  async readParamSpecsFromTemplate(source: TemplateSource): Promise<HarvestedParams> {
    return this.evaluator.collectParams(source);
  }

  /**
   * Evaluates `source` and creates a new `.base` file at `outputPath`.
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
    const config = await this.evaluateTemplate(source, resolvedParams);
    await this.baseFileIO.createBase(config, outputPath);
  }

  /**
   * Evaluates `source` and writes a `.base` file at `outputPath`,
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
    const config = await this.evaluateTemplate(source, resolvedParams);
    await this.baseFileIO.writeBase(config, outputPath);
  }

  /**
   * Updates a `.base` file from its stored template ref, re-applying the params
   * that were cached in `pb-metadata.params` at the last write. `overrideParams`
   * take priority over stored params — callers can partially or fully reconfigure.
   *
   * @param templateRef - The ref string stored in `pb-metadata.template`.
   * @param outputPath - Vault-relative path of the `.base` file to update.
   * @param overrideParams - Params to merge on top of the stored params (optional).
   */
  async writeBaseFromStoredRef(
    templateRef: string,
    outputPath: string,
    overrideParams: ResolvedParams = {},
  ): Promise<void> {
    const storedParams = await this.readStoredParams(outputPath);
    const mergedParams = { ...storedParams, ...overrideParams };
    const source = this.resolver.parseHeaderRef(templateRef);
    return this.writeBaseFromTemplate(source, outputPath, mergedParams);
  }

  /**
   * Pass 2: evaluates a template source into a fully-resolved {@link BaseConfig},
   * evaluating `!exp`/`!fnc` tags against the supplied params.
   *
   * Stamps `pb-metadata.template` on the result so the base can later be
   * re-applied via the "Update base from template" command. Also stamps
   * `pb-metadata.params` when `resolvedParams` is non-empty.
   *
   * Public so external scripts can call it directly to get a {@link BaseConfig}
   * without immediately writing a file.
   *
   * @param source - The template source to load.
   * @param resolvedParams - Flat param map from the modal or stored in `pb-metadata`.
   * @returns A fully built {@link BaseConfig} with metadata stamped.
   */
  async evaluateTemplate(
    source: TemplateSource,
    resolvedParams: ResolvedParams = {},
  ): Promise<BaseConfig> {
    const raw = await this.evaluator.evaluate(source, resolvedParams);
    const config = BaseConfig.deserialize(raw as Record<string, unknown>, this.getViewRegistry());
    const hasParams = Object.keys(resolvedParams).length > 0;
    return new BaseBuilder(config, this.getViewRegistry())
      .setMetadata({
        template: source.toRef(),
        ...(hasParams ? { params: resolvedParams } : {}),
      })
      .build();
  }

  /**
   * Reads the stored params from an existing `.base` file's `pb-metadata.params`.
   * Returns `{}` if the file does not exist or has no stored params.
   */
  private async readStoredParams(outputPath: string): Promise<ResolvedParams> {
    try {
      const config = await this.baseFileIO.readBase(outputPath);
      return config.metadata?.params ?? {};
    } catch {
      return {};
    }
  }
}
