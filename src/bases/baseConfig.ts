// baseConfig.ts

import { BaseConfigOptions } from './baseConfigOptions';
import { FilterGroup } from 'primitives/filter';
import { Formula } from 'primitives/formula';
import { PropertyDisplay } from 'primitives/propertyDisplay';
import { ViewConfig } from 'views/viewConfig';
import * as yaml from 'js-yaml';
import { SerializationUtils } from 'utils/serializationUtils';
import { ViewRegistry } from 'views/viewRegistry';

/**
 * Represents the top-level configuration for a database or collection,
 * encompassing filters, formulas, property display names, and views.
 * Serializes to a YAML string suitable for storage or export.
 */
export class BaseConfig {
  /** The list of views defined within this configuration. */
  private _views: ViewConfig[];
  get views(): ViewConfig[] { return this._views; }

  /** The configuration options for this base config. */
  private _options: BaseConfigOptions;
  get options(): BaseConfigOptions { return this._options; }
  

  /**
   * Creates a new {@link BaseConfig} instance.
   *
   * @param options - The base configuration options.
   * @throws {Error} If no views are provided.
   */
  constructor(views: ViewConfig[], options: BaseConfigOptions) {
    if (views.length === 0) {
      throw new Error('Base must have at least one view');
    }
    this._views = views;
    this._options = options;
  }


  /** An optional top-level filter group applied across the entire configuration. */
  get filters(): FilterGroup | undefined { return this._options.filters; }

  /** An optional list of formulas available within this configuration. */
  get formulas(): Formula[] | undefined { return this._options.formulas; }

  /**
   * An optional list of properties with their display names. Each entry overrides 
   * how a property is labeled in the UI.
   */
  get properties(): PropertyDisplay[] | undefined { return this._options.properties; }


  /**
   * Serializes this configuration to a plain object.
   *
   * The output structure is as follows:
   * - `views` — an array of serialized view configurations.
   * - `filters` — the serialized top-level filter group, if present.
   * - `formulas` — an array of serialized formula objects, if any formulas are defined.
   * - `properties` — an array of serialized property display objects, if any properties are defined.
   *
   * @returns A plain object representing the full configuration.
   */
  serialize(): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
  
    // Serialize attributes
    obj.views = this.views.map(v => v.serialize());
    if (this.filters) {
      obj.filters = this.filters.serialize();
    }
    if (this.formulas && this.formulas.length > 0) {
      obj.formulas = SerializationUtils.serializeRecord(this.formulas, f => f.serialize());
    }
    if (this.properties && this.properties.length > 0) {
      obj.properties = SerializationUtils.serializeRecord(this.properties, p => p.serialize());
    }
  
    return obj;
  }

  /**
   * Deserializes a plain object into a {@link BaseConfig} instance.
   *
   * @param raw - The raw object to deserialize. Expected to contain:
   *   - `views` — an array of serialized view objects.
   *   - `filters` — a serialized filter group, if present.
   *   - `formulas` — an array of serialized formula objects, if present.
   *   - `properties` — an array of serialized property display objects, if present.
   * @param viewRegistry - The registry used to deserialize each view object
   *   into its corresponding view instance.
   *
   * @returns The deserialized {@link BaseConfig} instance.
   */
  static deserialize(raw: Record<string, unknown>, viewRegistry: ViewRegistry): BaseConfig {
    const views = (raw.views as Record<string, unknown>[]).map(v => viewRegistry.deserialize(v));
  
    const filters = raw.filters ?
      FilterGroup.deserialize(raw.filters as Record<string, unknown>) :
      undefined;
  
    const formulas = raw.formulas ?
      SerializationUtils.deserializeRecord<Formula>(
        raw.formulas as Record<string, unknown>,
        Formula.deserialize) :
      undefined;
  
    const properties = raw.properties ?
      SerializationUtils.deserializeRecord<PropertyDisplay>(
        raw.properties as Record<string, unknown>,
        PropertyDisplay.deserialize) :
      undefined;
  
    return new BaseConfig(views, { filters, formulas, properties });
  }
}