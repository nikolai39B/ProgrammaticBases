// templateEvaluator.ts

import * as yaml from 'yaml';
import { App } from 'obsidian';
import { QualifiedSource } from 'settings';
import { BaseBuilder } from 'bases/baseBuilder';
import { BaseConfig } from 'bases/baseConfig';
import {
  HarvestedParams,
  ParamSpecs,
  ResolvedParams,
  buildScopedParams,
  mergeHarvestedParams,
  parseParamSpecs,
} from 'bases/templateParams';
import {
  TemplateSource,
  TemplateSourceResolver,
  VaultTemplateSource,
} from 'bases/templateSource';
import { ViewRegistry } from 'views/viewRegistry';

/**
 * Evaluates YAML template strings with custom tag resolution (`!sub`, `!exp`, `!fnc`).
 *
 * Files use an optional `pb-metadata:` wrapper. When present, `pb-metadata` is
 * stripped and all remaining top-level keys are used as the resolved value.
 *
 * **Two-pass usage:**
 * - Pass 1 (`collectParams`): resolves `!sub` only to collect all declared params
 *   from the template and every nested component. `!exp` is a no-op.
 * - Pass 2 (`evaluateTemplate`): resolves `!sub` and interpolates `!exp` placeholders with
 *   the user-supplied `resolvedParams`.
 *
 * Unqualified `!sub` refs (e.g. `!sub filter/isTask`) are resolved against the
 * vault components folder. Qualified `!sub` refs (e.g. `!sub task-base:filter/isTask`)
 * are resolved against the named qualified source.
 */
export class TemplateEvaluator {

  //-- Constructor

  /**
   * @param app - The Obsidian app instance, used to read vault files.
   * @param resolver - Parses ref strings into {@link TemplateSource} instances.
   * @param getSources - Returns the current map of registered qualified sources
   *   (other plugins that expose templates/components). Called lazily so the
   *   evaluator always sees the latest registrations.
   * @param getViewRegistry - Returns the current {@link ViewRegistry}, used when
   *   deserializing the evaluated template into a {@link BaseConfig}. Called
   *   lazily for the same reason as `getSources`.
   */
  constructor(
    private readonly app: App,
    private readonly resolver: TemplateSourceResolver,
    private readonly getSources: () => Map<string, QualifiedSource>,
    private readonly getViewRegistry: () => ViewRegistry,
  ) {}


  //-- Public API

  /**
   * Pass 1: resolves `!sub` only, harvesting `pb-metadata.params` from the
   * template and every transitively included component.
   *
   * @param source - The template source to harvest params from.
   * @returns All discovered params keyed by name, with per-source metadata accumulated.
   */
  async collectTemplateParams(source: TemplateSource): Promise<HarvestedParams> {

    // Recursively collect the params from the template
    const discoveredParams: HarvestedParams = {};
    await this.collectTemplateParamsInternal(source, new Set(), discoveredParams, '', false);
    
    return discoveredParams;
  }

  /**
   * Pass 2: evaluates a template into a fully-resolved {@link BaseConfig},
   * stamping `pb-metadata.template` (and optionally `pb-metadata.params`).
   *
   * This is a pure transformation — no files are written. Callers that also
   * need to write a `.base` file should use {@link TemplateFileIO} instead.
   *
   * @param source - The template source to evaluate.
   * @param resolvedParams - Flat param map from the modal or stored in `pb-metadata`.
   * @returns A fully built {@link BaseConfig} with metadata stamped.
   */
  async evaluateTemplate(
    source: TemplateSource,
    resolvedParams: ResolvedParams = {},
  ): Promise<BaseConfig> {

    // Evaulate the template source's content with the params
    const raw = await this.evaluateBaseContent(source, resolvedParams);
    
    // Deserialize the base
    const registry = this.getViewRegistry();
    const config = BaseConfig.deserialize(raw as Record<string, unknown>, registry);

    // Build the metadata
    const hasParams = Object.keys(resolvedParams).length > 0;
    const metadata = {
      // Template ref
      template: source.toRef(),

      // Params if available
      ...(hasParams ? { params: resolvedParams } : {}),
    };

    // Build the base
    return new BaseBuilder(config, registry)
      .setMetadata(metadata)
      .build();
  }


  //-- Content Resolution
  
  /**
   * Fetches the raw YAML string for a source.
   * For vault sources, reads the TFile directly.
   * For external sources, looks up the content in the registered sources map.
   *
   * @param source - The template source to read.
   * @param isComponent - When true, looks in `extSource.components`; otherwise `extSource.templates`.
   * @returns The raw YAML string for the source.
   * @throws If the vault file is not found, the qualified source is not registered,
   *   or the named template/component does not exist within the source.
   */
  private async resolveContent(source: TemplateSource, isComponent: boolean): Promise<string> {
    // Handle vault file sources
    if (source instanceof VaultTemplateSource) {
      // Get the file
      const file = this.app.vault.getFileByPath(source.path);
      if (!file) throw new Error(`File not found: ${source.path}`);

      // Read the file content
      return this.app.vault.read(file);
    }

    // Handle external sources
    const extSource = this.getSources().get(source.sourceName);
    if (!extSource) throw new Error(`Unknown source: "${source.sourceName}"`);

    // Get the content
    const content = isComponent
      ? extSource.components?.[source.templateName]
      : extSource.templates?.[source.templateName];
    if (!content) throw new Error(
      `${isComponent ? 'Component' : 'Template'} "${source.templateName}" not found in source "${source.sourceName}"`
    );

    return content;
  }


  //-- Param Harvesting

  /**
   * Core harvest function (Pass 1). Fetches content for `source`, reads
   * `pb-metadata.params`, then recurses into `!sub` components to collect
   * their params too. `!exp` is a no-op.
   *
   * @param source - The source to harvest params from.
   * @param visited - Refs already on the current call stack; used for cycle detection.
   * @param discoveredParams - Accumulator mutated in place as params are found.
   * @param sourcePath - Path of the current source, used to key harvested params
   *   and build child paths for nested `!sub` refs.
   * @param isComponent - When true, reads from the components folder/map; otherwise templates.
   * @returns The unwrapped, resolved YAML tree. The return value is used only to
   *   trigger recursive `!sub` resolution — it is discarded by the caller.
   * @throws If a circular `!sub` reference is detected.
   */
  private async collectTemplateParamsInternal(
    source: TemplateSource,
    visited: Set<string>,
    discoveredParams: HarvestedParams,
    sourcePath: string,
    isComponent: boolean,
  ): Promise<unknown> {

    // Validate against circular references
    const id = source.toRef();
    if (visited.has(id)) throw new Error(`Circular !sub reference detected: ${id}`);

    // Get the content
    const content = await this.resolveContent(source, isComponent);

    // Parse once with the harvest tags. !sub resolve callbacks return Promises
    // (not yet awaited), so pb-metadata is fully available as a plain object right
    // after yaml.parse returns. We extract params before resolvePromises runs the
    // !sub Promises — child component params merge during resolvePromises.
    //
    const customTags = this.buildYamlTagsForParamsCollection(new Set([...visited, id]), discoveredParams, sourcePath);
    const raw = yaml.parse(content, { customTags });

    // Extract params from pb-metadata and merge into the accumulator
    this.extractAndMergeParams(raw, sourcePath, discoveredParams);

    // Resolve all !sub promises, then strip pb-metadata from the result
    return this.unwrapContent(await this.resolvePromises(raw));
  }

  
  //-- Template Evaluation

  /**
   * Evaluates the root template source into a plain object ready for
   * {@link BaseConfig.deserialize}.
   *
   * - Takes no `visited` set — cycle detection is only meaningful for
   *   components; the root always starts fresh.
   * - Hardcodes `sourcePath: ''` — `!exp` params at the template level
   *   are always unscoped.
   * - Validates that the resolved value is a non-null, non-array object
   *   before casting, so callers receive a typed `Record<string, unknown>`
   *   rather than `unknown`.
   *
   * @param source - The root template source to evaluate.
   * @param resolvedParams - Flat param map passed to `!exp` interpolation.
   * @returns The unwrapped, fully resolved template object.
   * @throws If the template does not evaluate to a YAML mapping.
   */
  private async evaluateBaseContent(
    source: TemplateSource,
    resolvedParams: ResolvedParams,
  ): Promise<Record<string, unknown>> {
    const id = source.toRef();

    // Read the template file — `false` = not a component (looks in templates folder)
    const content = await this.resolveContent(source, false);

    // Seed the visited set with the root id so any !sub that refs the template
    // itself is caught immediately as a cycle
    const customTags = this.buildYamlTagsForEvaluation(new Set([id]), resolvedParams, '');
    const raw = yaml.parse(content, { customTags });

    // Resolve all !sub promises, then strip pb-metadata from the result
    const resolved = this.unwrapContent(await this.resolvePromises(raw));

    // A valid template must be a YAML mapping (object), not a scalar or sequence
    if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)) {
      throw new Error(`Template "${id}" must evaluate to a YAML object`);
    }

    return resolved as Record<string, unknown>;
  }

  /**
   * Evaluates a single component source into its resolved YAML value.
   *
   * Unlike {@link evaluateBaseContent}, the result may be any YAML value —
   * object, array, or scalar — since components can be inlined anywhere in
   * the template tree.
   *
   * @param source - The component source to evaluate.
   * @param visited - Refs already on the current call stack; used for cycle detection.
   * @param resolvedParams - Flat param map for the whole evaluation run.
   * @param sourcePath - Path of this component, used to scope `!exp` param lookups
   *   and build child paths for nested `!sub` refs.
   * @returns The unwrapped, fully resolved YAML value for this component.
   * @throws If a circular `!sub` reference is detected.
   */
  private async evaluateComponentContent(
    source: TemplateSource,
    visited: Set<string>,
    resolvedParams: ResolvedParams,
    sourcePath: string,
  ): Promise<unknown> {
    const id = source.toRef();
    if (visited.has(id)) throw new Error(`Circular !sub reference detected: ${id}`);

    // Read from the components folder/map
    const content = await this.resolveContent(source, true);

    const customTags = this.buildYamlTagsForEvaluation(new Set([...visited, id]), resolvedParams, sourcePath);
    const raw = yaml.parse(content, { customTags });

    return this.unwrapContent(await this.resolvePromises(raw));
  }


  //-- Tags

  /**
   * Builds the custom YAML tag handlers used during Pass 1 (param harvesting).
   *
   * - `!sub <ref>` — recurses into the referenced component to collect its
   *   `pb-metadata.params` declarations, accumulating them into `discoveredParams`.
   * - `!exp <template>` — no-op; returns `null` so the tree resolves cleanly
   *   without needing actual param values.
   *
   * @param visited - Refs already on the current call stack; passed down to
   *   detect cycles in `!sub` chains.
   * @param discoveredParams - Accumulator mutated as params are found across
   *   the template and its transitive components.
   * @param currentSourcePath - Source path of the file being parsed, used to
   *   key harvested params and build child paths for `!sub`.
   * @returns A tuple of `[subTag, expTag]` custom tag handlers for `yaml.parse`.
   */
  private buildYamlTagsForParamsCollection(
    visited: Set<string>,
    discoveredParams: HarvestedParams,
    currentSourcePath: string,
  ) {
    const subTag = {
      tag: '!sub',
      resolve: (ref: string) => {
        // Parse the reference into a template source
        const source = this.resolver.parseRef(ref, 'component');
        
        // Build the child path for param scoping and error messages
        const childPath = currentSourcePath ? `${currentSourcePath} > ${ref}` : ref;

        // Collect the component template's params
        return this.collectTemplateParamsInternal(source, visited, discoveredParams, childPath, true);
      },
    };
    // !exp is a no-op during harvest — return null so the tree resolves cleanly
    return [subTag, { tag: '!exp', resolve: () => null }];
  }

  /**
   * Builds the custom YAML tag handlers used during Pass 2 (evaluation).
   *
   * - `!sub <ref>` — inlines a component by recursively evaluating it and
   *   returning a Promise. `yaml.parse` places the Promise into the parsed
   *   tree; {@link resolvePromises} awaits the whole tree afterwards.
   * - `!exp <template>` — interpolates `{{paramName}}` placeholders using
   *   params scoped to `currentSourcePath`. Unresolved placeholders become
   *   empty strings.
   *
   * @param visited - Refs already on the current call stack; passed down
   *   to detect cycles in `!sub` chains.
   * @param resolvedParams - The flat param map for the whole evaluation run.
   * @param currentSourcePath - Source path of the file being parsed, used to
   *   scope param lookups in `!exp` and to build child paths for `!sub`.
   * @returns A tuple of `[subTag, expTag]` custom tag handlers for `yaml.parse`.
   */
  private buildYamlTagsForEvaluation(
    visited: Set<string>,
    resolvedParams: ResolvedParams,
    currentSourcePath: string,
  ) {
    // Build the !sub tag for component substitution
    const subTag = {
      tag: '!sub',
      resolve: (ref: string) => {
        // Parse the reference into a template source
        const source = this.resolver.parseRef(ref, 'component');
        
        // Build the child path for param scoping and error messages
        const childPath = currentSourcePath ? `${currentSourcePath} > ${ref}` : ref;

        // Evaluate the component template
        return this.evaluateComponentContent(source, visited, resolvedParams, childPath);
      },
    };

    // Build the !exp tag for inserting a param value
    const expTag = {
      tag: '!exp',
      resolve: (template: string): string => {
        // Narrow resolvedParams to keys relevant to this source
        const params = buildScopedParams(resolvedParams, currentSourcePath);

        // Replace every {{ key }} — missing keys silently become empty strings
        return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
          const val = params[key];
          return val !== undefined ? String(val) : '';
        });
      },
    };

    return [subTag, expTag];
  }


  //-- Utils

  /**
   * Reads `pb-metadata.params` from a freshly parsed YAML value and merges
   * the discovered specs into `discoveredParams`.
   *
   * Called during Pass 1 immediately after `yaml.parse`, before
   * `resolvePromises` awaits any `!sub` Promises — this ensures the current
   * source's params are captured synchronously before child components run.
   *
   * Non-object values and missing `pb-metadata`/`params` blocks are silently
   * ignored.
   *
   * @param raw - The raw parsed YAML value for the current source.
   * @param sourcePath - Path of the current source, used as the key when merging.
   * @param discoveredParams - Accumulator mutated in place with any found specs.
   */
  private extractAndMergeParams(
    raw: unknown,
    sourcePath: string,
    discoveredParams: HarvestedParams,
  ): void {
    // Only objects can have params
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;

    // Get the metadata if available
    const metaRaw = (raw as Record<string, unknown>)['pb-metadata'];
    if (!metaRaw || typeof metaRaw !== 'object' || Array.isArray(metaRaw)) return;

    // Get the params from the metadata
    const paramsRaw = (metaRaw as Record<string, unknown>)['params'];
    const specs: ParamSpecs = parseParamSpecs(paramsRaw);

    // Merge thios source's params into the full set of discovered params
    mergeHarvestedParams(discoveredParams, specs, sourcePath);
  }

  /**
   * Strips `pb-metadata` from the parsed object, then returns `pb-content` if
   * present, or the remaining keys otherwise.
   *
   * Templates and components may declare a `pb-metadata` block for params,
   * template refs, etc. This is always removed before the content is used.
   *
   * `pb-content` exists for components whose real value is a non-object (e.g.
   * an array or scalar) that cannot be co-located with `pb-metadata` at the
   * top level. When present, it is promoted and returned directly.
   *
   * Non-object values (scalars, arrays, null) are returned as-is — they cannot
   * carry `pb-metadata` and need no unwrapping.
   *
   * @param raw - The raw parsed YAML value to unwrap.
   * @returns The unwrapped content: `pb-content` value if present, remaining keys
   *   after stripping `pb-metadata`, or the original value if non-object.
   */
  private unwrapContent(raw: unknown): unknown {
    // Non-objects cannot carry pb-metadata and need no unwrapping
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return raw;
    }

    // Strip pb-metadata (destructuring a missing key is safe — rest is the whole object)
    const obj = raw as Record<string, unknown>;
    const { 'pb-metadata': _meta, ...rest } = obj;

    // If pb-content is present, the real value is wrapped inside it (used when
    // the component's content is a non-object that can't sit beside pb-metadata)
    return 'pb-content' in rest ? rest['pb-content'] : rest;
  }

  /**
   * Recursively awaits all Promises embedded in a parsed YAML tree.
   *
   * `!sub` tag resolvers return Promises rather than resolved values, because
   * `yaml.parse` is synchronous — it cannot await async work itself. Those
   * Promises are placed directly into the tree as values. This method walks
   * the tree afterwards, awaiting each one so the final result is a plain
   * value with no Promises remaining.
   *
   * Handles three cases:
   * - `Promise` — awaits it, then recurses on the resolved value (the resolved
   *   value may itself contain further Promises from nested `!sub` tags).
   * - `Array` — recurses on each element in parallel via `Promise.all`.
   * - `Object` — recurses on each value in parallel, then reassembles the object.
   * - Anything else (scalar, null) — returned as-is.
   *
   * @param value - The value to resolve, which may be a Promise, array, object, or scalar.
   * @returns The fully resolved value with all Promises replaced by their resolved values.
   */
  private async resolvePromises(value: unknown): Promise<unknown> {
    // Resolve promises directly
    if (value instanceof Promise) {
      return this.resolvePromises(await value);
    }

    // Resolve all promises in an array
    if (Array.isArray(value)) {
      return Promise.all(value.map(v => this.resolvePromises(v)));
    }

    // Resolve all entries in an object recursively
    if (value !== null && typeof value === 'object') {
      const entries = await Promise.all(
        Object.entries(value as Record<string, unknown>).map(
          async ([k, v]) => [k, await this.resolvePromises(v)] as const
        )
      );
      return Object.fromEntries(entries);
    }

    // Other values do not need resolving
    return value;
  }
}