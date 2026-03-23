// baseBuilder.ts

import { FilterGroup, Formula, Property } from '../config/baseTypes';
import { BaseConfig } from '../config/baseConfig';
import { BaseConfigOptions } from '../config/baseConfigOptions';
import { ViewConfigBuilder } from './viewConfigBuilder';
import { builderFactory } from '../config/viewConfigVisitor'

// ─── Base View Builder ───────────────────────────────────────────────────────

/**
 * Builder for constructing a {@link BaseConfig} instance.
 * Accumulates top-level configuration options and a list of view builders,
 * then assembles them into a {@link BaseConfig} on {@link build}.
 */
export class BaseBuilder {
  
  // ── Attributes

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


  // ── Constructor

  /**
   * Creates a new {@link BaseBuilder} instance.
   * If an existing {@link BaseConfigOptions} is provided, its properties are
   * copied and its views are reconstructed as {@link ViewConfigBuilder} instances
   * via the visitor pattern, enabling further modification before rebuilding.
   *
   * @param existing - Optional existing configuration to initialize from.
   */
  constructor(existing?: BaseConfigOptions) {
    if (existing) {
      const { views, ...rest } = existing;
      this.options = { ...rest };
      this.viewBuilders = views?.map(v => v.accept(builderFactory)) ?? [];
    }
  }


  // ── Mutators

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
  

  // ── Build

  /**
   * Validates the accumulated options without constructing the config.
   * Throws early if the configuration is known to be invalid,
   * avoiding the need to call {@link build} just to check validity.
   *
   * Currently checks that at least one view builder has been added,
   * mirroring the constraint enforced by {@link BaseConfig}.
   *
   * @throws {Error} If no views have been added.
   */
  protected validate(): void {
    if (this.viewBuilders.length === 0) {
      throw new Error('Base must have at least one view');
    }
  }

  /**
   * Validates the accumulated options and builds a {@link BaseConfig}.
   * All added view builders are built and included as views in the result.
   *
   * @returns The constructed {@link BaseConfig}.
   * @throws {Error} If no views have been added.
   */
  build(): BaseConfig {
    this.validate();
    return new BaseConfig({
      ...this.options,
      views: this.viewBuilders.map(v => v.build()),
    });
  }
}