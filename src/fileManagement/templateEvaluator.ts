// templateEvaluator.ts

import * as yaml from 'js-yaml';
import { App } from 'obsidian';
import { ExternalSource } from 'settings';
import {
  HarvestedParams,
  ParamSpecs,
  ResolvedParams,
  buildScopedParams,
  mergeHarvestedParams,
  parseParamSpecs,
} from 'bases/templateParams';
import {
  ExternalTemplateSource,
  TemplateSource,
  TemplateSourceResolver,
  VaultTemplateSource,
} from 'bases/templateSource';

/**
 * Evaluates YAML template strings with custom tag resolution (`!sub`, `!exp`, `!fnc`).
 *
 * Files use an optional `pb-metadata:` wrapper. When present, `pb-metadata` is
 * stripped and all remaining top-level keys are used as the resolved value.
 *
 * **Two-pass usage:**
 * - Pass 1 (`collectParams`): resolves `!sub` only to collect all declared params
 *   from the template and every nested component. `!exp`/`!fnc` are no-ops.
 * - Pass 2 (`evaluate`): resolves `!sub` and evaluates `!exp`/`!fnc` with the
 *   user-supplied `resolvedParams`.
 *
 * Unqualified `!sub` refs (e.g. `!sub filter/isTask`) are resolved against the
 * vault components folder via {@link TemplateSourceResolver.parseSubRef}.
 *
 * Qualified `!sub` refs (e.g. `!sub task-base:filter/isTask`) are resolved
 * against the named external source via {@link TemplateSourceResolver.parseSubRef}.
 */
export class TemplateEvaluator {
  constructor(
    private readonly app: App,
    private readonly resolver: TemplateSourceResolver,
    private readonly getSources: () => Map<string, ExternalSource>,
  ) {}

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Pass 1: resolves `!sub` only, harvesting `pb-metadata.params` from the
   * template and every transitively included component.
   *
   * @param source - The template source to harvest params from.
   * @returns All discovered params keyed by name, with per-source metadata accumulated.
   */
  async collectParams(source: TemplateSource): Promise<HarvestedParams> {
    const discoveredParams: HarvestedParams = {};
    await this.collectParamsFromSource(source, new Set(), discoveredParams, '', false);
    return discoveredParams;
  }

  /**
   * Pass 2: evaluates the template, resolving `!sub` and evaluating `!exp`/`!fnc`
   * against the supplied `resolvedParams`.
   *
   * @param source - The template source to evaluate.
   * @param resolvedParams - Flat param map from the modal or stored in `pb-metadata`.
   * @returns The fully resolved plain-object tree (pb-metadata stripped).
   */
  async evaluate(source: TemplateSource, resolvedParams: ResolvedParams = {}): Promise<unknown> {
    return this.evaluateResolved(source, new Set(), resolvedParams, '', false);
  }

  // ── Content resolution ──────────────────────────────────────────────────────

  /**
   * Fetches the raw YAML string for a source.
   * For vault sources, reads the TFile directly.
   * For external sources, looks up the content in the registered sources map.
   *
   * @param source - The template source to read.
   * @param isComponent - When true, looks in `extSource.components`; otherwise `extSource.templates`.
   */
  private async resolveContent(source: TemplateSource, isComponent: boolean): Promise<string> {
    // Handle vault file sources
    if (source instanceof VaultTemplateSource) {
      return this.app.vault.read(source.file);
    }

    // Otherwise, get the external source
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

  // ── Pass 1: harvesting ──────────────────────────────────────────────────────

  /**
   * Core harvest function (Pass 1). Fetches content for `source`, reads
   * `pb-metadata.params`, then recurses into `!sub` components to collect
   * their params too. `!exp`/`!fnc` are no-ops.
   */
  private async collectParamsFromSource(
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

    // Read metadata.params with a permissive schema so any !sub/!exp/!fnc
    // tags in the content block don't cause unknown-tag errors at this stage.
    const noopTag = (name: string) => new yaml.Type(name, {
      kind: 'scalar', resolve: () => true, construct: () => null,
    }); // Note for claude: can we resolve !sub tags to promises at this stage to avoid having to double yaml.load?
    const safeSchema = yaml.CORE_SCHEMA.extend([noopTag('!sub'), noopTag('!exp'), noopTag('!fnc')]);

    // Load the content as yaml
    const rawOuter = yaml.load(content, { schema: safeSchema }) as Record<string, unknown> | null;

    // If the yaml has a pb-metadata object, parse and merge the params into the tracking set
    if (rawOuter && typeof rawOuter === 'object' && !Array.isArray(rawOuter)) {
      const metaRaw = (rawOuter as Record<string, unknown>)['pb-metadata'];
      if (metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)) {
        const paramsRaw = (metaRaw as Record<string, unknown>)['params'];
        const specs: ParamSpecs = parseParamSpecs(paramsRaw);
        mergeHarvestedParams(discoveredParams, specs, sourcePath);
      }
    }

    // Re-parse the yaml, this time resolving !sub tags only to collect their params
    const schema = this.buildHarvestSchema(new Set([...visited, id]), discoveredParams, sourcePath);
    const raw = yaml.load(content, { schema });
    return this.resolvePromises(this.unwrapContent(raw));
  }

  private buildHarvestSchema(
    visited: Set<string>,
    discoveredParams: HarvestedParams,
    currentSourcePath: string,
  ): yaml.Schema {
    // Define the !sub tag
    const subTag = new yaml.Type('!sub', {
      kind: 'scalar',
      resolve: (data: unknown) => typeof data === 'string',
      construct: (ref: string) => {
        // Parse the ref
        const source = this.resolver.parseSubRef(ref);

        // Collect the params from the component
        const childPath = currentSourcePath ? `${currentSourcePath} > ${ref}` : ref;
        return this.collectParamsFromSource(source, visited, discoveredParams, childPath, true);
      },
    });

    // !exp and !fnc are no-ops during harvest — return null so the tree resolves cleanly
    const noopTag = (name: string) => new yaml.Type(name, {
      kind: 'scalar',
      resolve: (data: unknown) => typeof data === 'string',
      construct: () => null,
    });

    return yaml.CORE_SCHEMA.extend([subTag, noopTag('!exp'), noopTag('!fnc')]);
  }

  // ── Pass 2: evaluation ─────────────────────────────────────────────────

  /**
   * Core evaluation function (Pass 2). Fetches content for `source`, parses YAML
   * with the full custom schema, and recursively resolves all `!sub` tags and promises.
   * `!exp`/`!fnc` tags evaluate against `resolvedParams` scoped to `sourcePath`.
   */
  private async evaluateResolved(
    source: TemplateSource,
    visited: Set<string>,
    resolvedParams: ResolvedParams,
    sourcePath: string,
    isComponent: boolean,
  ): Promise<unknown> {
    const id = source.toRef();
    if (visited.has(id)) throw new Error(`Circular !sub reference detected: ${id}`);

    const content = await this.resolveContent(source, isComponent);
    const schema = this.buildSchema(new Set([...visited, id]), resolvedParams, sourcePath);
    const raw = yaml.load(content, { schema });
    return this.resolvePromises(this.unwrapContent(raw));
  }

  private buildSchema(
    visited: Set<string>,
    resolvedParams: ResolvedParams,
    currentSourcePath: string,
  ): yaml.Schema {
    const subTag = new yaml.Type('!sub', {
      kind: 'scalar',
      resolve: (data: unknown) => typeof data === 'string',
      construct: (ref: string) => {
        const source = this.resolver.parseSubRef(ref);
        const childPath = currentSourcePath ? `${currentSourcePath} > ${ref}` : ref;
        return this.evaluateResolved(source, visited, resolvedParams, childPath, true);
      },
    });

    const expTag = new yaml.Type('!exp', {
      kind: 'scalar',
      resolve: (data: unknown) => typeof data === 'string',
      construct: (expr: string): unknown => {
        const params = buildScopedParams(resolvedParams, currentSourcePath);
        try {
          return new Function('params', `return (${expr})`)(params);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(`!exp evaluation failed for "${expr}": ${msg}`);
        }
      },
    });

    const fncTag = new yaml.Type('!fnc', {
      kind: 'scalar',
      resolve: (data: unknown) => typeof data === 'string',
      construct: (body: string): unknown => {
        const params = buildScopedParams(resolvedParams, currentSourcePath);
        try {
          return new Function('params', body)(params);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          throw new Error(`!fnc evaluation failed: ${msg}`);
        }
      },
    });

    return yaml.CORE_SCHEMA.extend([subTag, expTag, fncTag]);
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  /**
   * Strips `pb-metadata` from the top-level parsed object, leaving only the
   * actual base/component content. If `pb-metadata` is not present, the object
   * is returned as-is.
   */
  private unwrapContent(raw: unknown): unknown {
    if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      if ('pb-metadata' in obj) {
        const { 'pb-metadata': _, ...rest } = obj;
        return rest;
      }
    }
    return raw;
  }

  private async resolvePromises(value: unknown): Promise<unknown> {
    if (value instanceof Promise) {
      return this.resolvePromises(await value);
    }
    if (Array.isArray(value)) {
      return Promise.all(value.map(v => this.resolvePromises(v)));
    }
    if (value !== null && typeof value === 'object') {
      const entries = await Promise.all(
        Object.entries(value as Record<string, unknown>).map(
          async ([k, v]) => [k, await this.resolvePromises(v)] as const
        )
      );
      return Object.fromEntries(entries);
    }
    return value;
  }
}