// baseConfig.ts

import { FilterGroup, Formula } from './baseTypes';
import { ViewConfig } from './viewConfig';
import { BaseConfigOptions } from './baseConfigOptions';
import * as yaml from 'js-yaml';

/**
 * Represents the top-level configuration for a database or collection,
 * encompassing filters, formulas, property display names, and views.
 * Serializes to a YAML string suitable for storage or export.
 */
export class BaseConfig {
  /** The configuration options for this base config. */
  protected options: BaseConfigOptions;

  /**
   * Creates a new {@link BaseConfig} instance.
   *
   * @param options - The base configuration options.
   * @throws {Error} If no views are provided.
   */
  constructor(options: BaseConfigOptions) {
    if (options.views.length === 0) {
      throw new Error('Base must have at least one view');
    }
    this.options = options;
  }

  /** The list of views defined within this configuration. */
  get views(): ViewConfig[] { return this.options.views; }

  /** An optional top-level filter group applied across the entire configuration. */
  get filters(): FilterGroup | undefined { return this.options.filters; }

  /** An optional list of formulas available within this configuration. */
  get formulas(): Formula[] | undefined { return this.options.formulas; }

  /**
   * An optional map of serialized property keys to their display names.
   * Each entry overrides how a property is labeled in the UI.
   */
  get properties(): Map<string, string> | undefined { return this.options.properties; }

  /**
   * Serializes this configuration to a YAML string.
   *
   * The output structure is as follows:
   * - `filters` — the serialized top-level filter group, if present.
   * - `formulas` — a flat record of formula name to content, if any formulas are defined.
   * - `properties` — a record of serialized property key to `{ displayName }`, if any properties are defined.
   * - `views` — an array of serialized view configurations.
   *
   * @returns A YAML string representing the full configuration.
   */
  serialize(): string {
    const obj: Record<string, unknown> = {};

    // top-level filter group
    if (this.filters) {
      obj.filters = this.filters.serialize();
    }

    // flatten formulas into a single name → content record
    if (this.formulas && this.formulas.length > 0) {
      const formulas: Record<string, string> = {};
      for (const formula of this.formulas) {
        Object.assign(formulas, formula.serialize());
      }
      obj.formulas = formulas;
    }

    // flatten properties into serializedProperty → { displayName } record
    if (this.properties && this.properties.size > 0) {
      const properties: Record<string, { displayName: string }> = {};
      this.properties.forEach((displayName, serializedProperty) => {
        properties[serializedProperty] = { displayName };
      });
      obj.properties = properties;
    }

    // serialize each view and collect into array
    obj.views = this.views.map(v => v.serialize());

    return yaml.dump(obj, { lineWidth: -1 });
  }
}