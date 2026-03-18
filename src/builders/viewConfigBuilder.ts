// viewConfigBuilder.ts

import { FilterGroup, PropertyOrder, Property } from '../config/baseTypes';
import {
  ViewConfigOptions,
  CardViewConfigOptions,
  TableViewConfigOptions,
  ListViewConfigOptions,
  ImageFitType,
  RowHeightType,
} from '../config/viewConfigOptions';
import { ViewConfig, CardViewConfig, TableViewConfig, ListViewConfig } from '../config/viewConfig';

// ─── Interface ────────────────────────────────────────────────────────────────

/**
 * Represents any builder capable of producing a {@link ViewConfig}.
 * Implemented structurally by all concrete view builder classes.
 */
export interface ViewConfigBuilder {
  build(): ViewConfig;
}

// ─── Base Builder ─────────────────────────────────────────────────────────────

/**
 * Abstract base class for all view configuration builders.
 * Accumulates shared view options and provides fluent setter methods.
 * Subclasses extend this with view-specific fields and implement {@link ViewConfigBuilder.build}.
 *
 * @template T - The concrete {@link ViewConfigOptions} type this builder produces.
 */
abstract class BaseViewBuilder<T extends ViewConfigOptions> implements ViewConfigBuilder {
  /**
   * The accumulated view configuration options.
   * Subclasses narrow this type via `declare` to include their own fields.
   */
  protected options: Partial<T> = {} as Partial<T>;

  /**
   * Sets the display name of the view.
   *
   * @param name - The name to assign. Must not be empty or whitespace.
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
   * Internal build step invoked by {@link build} after validation.
   * Subclasses implement this to construct and return their specific {@link ViewConfig}.
   *
   * @returns The constructed view configuration.
   */
  protected abstract buildInternal(): ViewConfig;
  
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
}

// ─── Card View Builder ────────────────────────────────────────────────────────

/**
 * Builder for {@link CardViewConfig} instances.
 * Extends {@link BaseViewBuilder} with card-specific setter methods.
 */
export class CardViewBuilder extends BaseViewBuilder<CardViewConfigOptions> {
  /** Narrows the inherited {@link BaseViewBuilder.options} to {@link CardViewConfigOptions}. */
  protected declare options: Partial<CardViewConfigOptions>;

  /**
   * Sets the size value controlling the width of each card.
   *
   * @param cardSize - The card width value.
   * @returns The builder instance for chaining.
   */
  setCardSize(cardSize: number): this {
    this.options.cardSize = cardSize;
    return this;
  }

  /**
   * Sets the property whose value is used as the card image.
   *
   * @param image - The image property.
   * @returns The builder instance for chaining.
   */
  setImage(image: Property): this {
    this.options.image = image;
    return this;
  }

  /**
   * Sets how the image is fitted within the card.
   *
   * @param imageFit - The image fit type.
   * @returns The builder instance for chaining.
   */
  setImageFit(imageFit: ImageFitType): this {
    this.options.imageFit = imageFit;
    return this;
  }

  /**
   * Sets the aspect ratio for the card image.
   *
   * @param imageAspectRatio - The aspect ratio (e.g. `1.5` for 3:2).
   * @returns The builder instance for chaining.
   */
  setImageAspectRatio(imageAspectRatio: number): this {
    this.options.imageAspectRatio = imageAspectRatio;
    return this;
  }

  /**
   * Builds and returns a {@link CardViewConfig} from the accumulated options.
   *
   * @returns The constructed {@link CardViewConfig}.
   * @throws {Error} If `name` is empty or contains only whitespace.
   */
  protected buildInternal(): CardViewConfig {
    return new CardViewConfig(this.options as CardViewConfigOptions);
  }
}

// ─── Table View Builder ───────────────────────────────────────────────────────

/**
 * Builder for {@link TableViewConfig} instances.
 * Extends {@link BaseViewBuilder} with table-specific setter methods.
 */
export class TableViewBuilder extends BaseViewBuilder<TableViewConfigOptions> {
  /** Narrows the inherited {@link BaseViewBuilder.options} to {@link TableViewConfigOptions}. */
  protected declare options: Partial<TableViewConfigOptions>;

  /**
   * Sets the height of each row in the table.
   *
   * @param rowHeight - The row height type.
   * @returns The builder instance for chaining.
   */
  setRowHeight(rowHeight: RowHeightType): this {
    this.options.rowHeight = rowHeight;
    return this;
  }

  /**
   * Sets the map of serialized property keys to their column width values.
   *
   * @param columnSize - A map of property keys to column widths.
   * @returns The builder instance for chaining.
   */
  setColumnSize(columnSize: Map<string, number>): this {
    this.options.columnSize = columnSize;
    return this;
  }

  /**
   * Builds and returns a {@link TableViewConfig} from the accumulated options.
   *
   * @returns The constructed {@link TableViewConfig}.
   * @throws {Error} If `name` is empty or contains only whitespace.
   */
  protected buildInternal(): TableViewConfig {
    return new TableViewConfig(this.options as TableViewConfigOptions);
  }
}

// ─── List View Builder ────────────────────────────────────────────────────────

/**
 * Builder for {@link ListViewConfig} instances.
 * Extends {@link BaseViewBuilder} with no additional fields —
 * list views rely solely on the base view options.
 */
export class ListViewBuilder extends BaseViewBuilder<ListViewConfigOptions> {
  /**
   * Builds and returns a {@link ListViewConfig} from the accumulated options.
   *
   * @returns The constructed {@link ListViewConfig}.
   * @throws {Error} If `name` is empty or contains only whitespace.
   */
  protected buildInternal(): ListViewConfig {
    return new ListViewConfig(this.options as ListViewConfigOptions);
  }
}