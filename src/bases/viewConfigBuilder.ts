import { FilterGroup } from './filter';
import { Property } from './property';
import { PropertyOrder } from './propertyOrder';
import { ViewConfig } from './viewConfig';
import { ViewConfigOptions } from './viewConfigOptions';

// ─── Interface ───────────────────────────────────────────────────────────────

/**
 * Represents any builder capable of producing a {@link ViewConfig}.
 * Implemented structurally by all concrete view builder classes.
 */
export interface ViewConfigBuilder {

  // ── Build

  /**
   * Validates the accumulated options and builds the view configuration.
   *
   * @returns The constructed view configuration.
   * @throws {Error} If validation fails.
   */
  build(): ViewConfig;
}

// ─── Base View Builder ───────────────────────────────────────────────────────

/**
 * Abstract base class for all view configuration builders.
 * Accumulates shared view options and provides fluent setter methods.
 * Subclasses extend this with view-specific fields and implement {@link buildInternal}.
 *
 * @template T - The concrete {@link ViewConfigOptions} type this builder produces.
 */
export abstract class BaseViewBuilder<T extends ViewConfigOptions> implements ViewConfigBuilder {

  // ── Attributes

  /**
   * The accumulated view configuration options.
   * Subclasses narrow this type via `declare` to include their own fields.
   */
  protected options: Partial<T> = {} as Partial<T>;

  // ── Constructor

  /**
   * Creates a new builder instance.
   * If an existing {@link ViewConfigOptions} is provided, its fields are
   * shallow-copied into {@link options} to allow further modification before building.
   *
   * @param existing - Optional existing view configuration to initialize from.
   */
  constructor(existing?: T) {
    if (existing) {
      this.options = { ...existing };
    }
  }

  // ── Mutators

  /**
   * Sets the display name of the view.
   * The name must not be empty or whitespace — this is enforced at {@link build} time.
   *
   * @param name - The name to assign.
   * @returns The builder instance for chaining.
   */
  setName(name: string): this {
    this.options.name = name;
    return this;
  }

  /**
   * Sets the filter group scoped to this view.
   *
   * @param filters - The filter group to apply.
   * @returns The builder instance for chaining.
   */
  setFilter(filters: FilterGroup): this {
    this.options.filters = filters;
    return this;
  }

  /**
   * Sets the property by which items in this view are grouped.
   *
   * @param groupBy - The property order to group by.
   * @returns The builder instance for chaining.
   */
  setGroupBy(groupBy: PropertyOrder): this {
    this.options.groupBy = groupBy;
    return this;
  }

  /**
   * Sets the list of sort rules applied to this view, in order.
   *
   * @param sort - The sort rules to apply.
   * @returns The builder instance for chaining.
   */
  setSort(sort: PropertyOrder[]): this {
    this.options.sort = sort;
    return this;
  }

  /**
   * Sets the ordered list of properties defining column or field display order.
   *
   * @param propertyOrder - The property order to apply.
   * @returns The builder instance for chaining.
   */
  setPropertyOrder(propertyOrder: Property[]): this {
    this.options.propertyOrder = propertyOrder;
    return this;
  }

  // ── Build

  /**
   * Validates the accumulated options before building.
   * Subclasses should override this to add their own validation rules,
   * calling `super.validate()` first to preserve base validation.
   *
   * @throws {Error} If any required field is missing or invalid.
   */
  protected validate(): void {
    if (!this.options.name?.trim()) {
      throw new Error('View name cannot be empty');
    }
  }

  /**
   * Validates the accumulated options and builds the view configuration.
   * Subclasses must not override this method — extend {@link buildInternal} instead.
   *
   * @returns The constructed view configuration.
   * @throws {Error} If validation fails.
   */
  build(): ViewConfig {
    this.validate();
    return this.buildInternal();
  }

  /**
   * Internal build step invoked by {@link build} after validation.
   * Subclasses implement this to construct and return their specific {@link ViewConfig}.
   *
   * @returns The constructed view configuration.
   */
  protected abstract buildInternal(): ViewConfig;
}