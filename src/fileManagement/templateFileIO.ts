// templateFileIO.ts

import * as yaml from 'js-yaml';
import { ResolvedParams } from 'bases/templateParams';
import { TemplateSource } from 'bases/templateSource';
import { TemplateSourceResolver } from 'bases/templateSource';
import { BaseFileIO } from 'fileManagement/baseFileIO';
import { TemplateEvaluator } from 'fileManagement/templateEvaluator';

/**
 * Evaluates a template source into a {@link BaseConfig} and writes it to a
 * `.base` file. Delegates evaluation to {@link TemplateEvaluator} and file
 * I/O to {@link BaseFileIO}.
 */
export class TemplateFileIO {
  constructor(
    private readonly baseFileIO: BaseFileIO,
    private readonly resolver: TemplateSourceResolver,
    private readonly evaluator: TemplateEvaluator,
  ) {}

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
    const config = await this.evaluator.evaluateTemplate(source, resolvedParams);
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
    const config = await this.evaluator.evaluateTemplate(source, resolvedParams);
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
