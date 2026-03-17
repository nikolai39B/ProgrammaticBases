// baseBuilder.ts

import { FilterGroup, Formula, Property } from '../types/baseTypes';
import { BaseConfig } from '../types/baseConfig';
import { BaseConfigOptions } from '../types/baseConfigOptions';
import { ViewConfigBuilder } from './viewConfigBuilder';

/**
 * Builder for constructing a {@link BaseConfig} instance.
 * Accumulates top-level configuration options and a list of view builders,
 * then assembles them into a {@link BaseConfig} on {@link build}.
 */
export class BaseBuilder {
  /**
   * The accumulated base configuration options.
   * Views are stored separately as builders and resolved during {@link build}.
   */
  protected options: Partial<Omit<BaseConfigOptions, 'views'>> = {};

  /**
   * The list of view builders added to this configuration.
   * Each builder is resolved to a view config during {@link build}.
   */
  private viewBuilders: ViewConfigBuilder[] = [];

  /**
   * Sets the top-level filter group for this configuration.
   * Replaces any previously set filter.
   *
   * @param filters - The filter group to apply.
   * @returns The builder instance for chaining.
   */
  setFilter(filters: FilterGroup): this {
    this.options.filters = filters;
    return this;
  }

  /**
   * Adds a formula to this configuration.
   * Initializes the formulas list if it does not exist yet.
   *
   * @param formula - The formula to add.
   * @returns The builder instance for chaining.
   */
  addFormula(formula: Formula): this {
    this.options.formulas ??= [];
    this.options.formulas.push(formula);
    return this;
  }

  /**
   * Adds a property with an associated display name to this configuration.
   * Initializes the properties map if it does not exist yet.
   *
   * @param property - The property to register.
   * @param displayName - The human-readable display name for the property.
   * @returns The builder instance for chaining.
   */
  addProperty(property: Property, displayName: string): this {
    this.options.properties ??= new Map();
    this.options.properties.set(property.serialize(), displayName);
    return this;
  }

  /**
   * Adds a view builder to this configuration.
   * Each added builder will be built and included as a view during {@link build}.
   *
   * @param view - The view builder to add.
   * @returns The builder instance for chaining.
   */
  addView(view: ViewConfigBuilder): this {
    this.viewBuilders.push(view);
    return this;
  }

  /**
   * Builds and returns a {@link BaseConfig} from the accumulated options.
   * All added view builders are built before being passed to the config.
   *
   * @returns The constructed {@link BaseConfig}.
   * @throws {Error} If no views have been added.
   */
  build(): BaseConfig {
    return new BaseConfig({
      ...this.options,
      views: this.viewBuilders.map(v => v.build()),
    });
  }
}