// viewConfig.ts

import { FilterGroup, PropertyOrder, Property } from './baseTypes';
import {
  ViewConfigOptions,
  CardViewConfigOptions,
  TableViewConfigOptions,
  ListViewConfigOptions,
  ImageFitType,
  RowHeightType,
} from './viewConfigOptions';

/** The supported view layout types. */
export type ViewType = 'table' | 'cards' | 'list';

/**
 * Represents the shared configuration fields common to all view types.
 * Subclasses must define the specific {@link ViewType} they represent.
 * Serializes to a plain object suitable for YAML or JSON export.
 */
export abstract class ViewConfig {
  /** The layout type of this view. */
  readonly type: ViewType;

  /** The configuration options for this view. */
  protected options: ViewConfigOptions;

  /**
   * Creates a new {@link ViewConfig} instance.
   *
   * @param type - The layout type of this view.
   * @param options - The base view configuration options.
   * @throws {Error} If `name` is empty or contains only whitespace.
   */
  constructor(type: ViewType, options: ViewConfigOptions) {
    if (!options.name.trim()) {
      throw new Error('View name cannot be empty');
    }
    this.type = type;
    this.options = options;
  }

  /** The display name of this view. */
  get name(): string { return this.options.name; }

  /** An optional filter group scoped to this view. */
  get filters(): FilterGroup | undefined { return this.options.filters; }

  /** An optional property by which items in this view are grouped. */
  get groupBy(): PropertyOrder | undefined { return this.options.groupBy; }

  /** An optional list of sort rules applied to this view, in order. */
  get sort(): PropertyOrder[] | undefined { return this.options.sort; }

  /** An optional ordered list of properties defining column or field display order. */
  get propertyOrder(): Property[] | undefined { return this.options.propertyOrder; }

  /**
   * Serializes this view configuration to a plain object.
   * Only fields that are defined are included in the output.
   * Subclasses should call `super.serialize()` and extend the result
   * with their own fields.
   *
   * @returns A plain object representing this view configuration.
   */
  serialize(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      type: this.type,
      name: this.name,
    };

    if (this.filters) {
      result.filters = this.filters.serialize();
    }
    if (this.groupBy) {
      result.groupBy = this.groupBy.serialize();
    }
    if (this.sort) {
      result.sort = this.sort.map(s => s.serialize());
    }
    if (this.propertyOrder) {
      result.propertyOrder = this.propertyOrder.map(p => p.serialize());
    }

    return result;
  }
}

// ─── Card View ────────────────────────────────────────────────────────────────

/**
 * Represents the configuration for a card layout view.
 * Extends {@link ViewConfig} with card-specific options such as
 * card size, image property, image fit, and aspect ratio.
 */
export class CardViewConfig extends ViewConfig {
  /** Narrows the inherited {@link ViewConfig.options} to {@link CardViewConfigOptions}. */
  protected declare options: CardViewConfigOptions;

  /**
   * Creates a new {@link CardViewConfig} instance.
   *
   * @param options - The card view configuration options.
   * @throws {Error} If `name` is empty or contains only whitespace.
   */
  constructor(options: CardViewConfigOptions) {
    super('cards', options);
  }

  /** An optional size value controlling the width of each card. */
  get cardSize(): number | undefined { return this.options.cardSize; }

  /** An optional property whose value is used as the card image. */
  get image(): Property | undefined { return this.options.image; }

  /** An optional setting controlling how the image is fitted within the card. */
  get imageFit(): ImageFitType | undefined { return this.options.imageFit; }

  /** An optional aspect ratio for the card image (e.g. `1.5` for 3:2). */
  get imageAspectRatio(): number | undefined { return this.options.imageAspectRatio; }

  /**
   * Serializes this card view configuration to a plain object.
   * Extends the base serialization with card-specific fields.
   * Only fields that are defined are included in the output.
   *
   * @returns A plain object representing this card view configuration.
   */
  serialize(): Record<string, unknown> {
    const result = super.serialize();

    if (this.cardSize != null) {
      result.cardSize = this.cardSize;
    }
    if (this.image) {
      result.image = this.image.serialize();
    }
    if (this.imageFit) {
      result.imageFit = this.imageFit;
    }
    if (this.imageAspectRatio != null) {
      result.imageAspectRatio = this.imageAspectRatio;
    }

    return result;
  }
}

// ─── Table View ───────────────────────────────────────────────────────────────

/**
 * Represents the configuration for a table layout view.
 * Extends {@link ViewConfig} with table-specific options such as
 * row height and per-column width sizing.
 */
export class TableViewConfig extends ViewConfig {
  /** Narrows the inherited {@link ViewConfig.options} to {@link TableViewConfigOptions}. */
  protected declare options: TableViewConfigOptions;

  /**
   * Creates a new {@link TableViewConfig} instance.
   *
   * @param options - The table view configuration options.
   * @throws {Error} If `name` is empty or contains only whitespace.
   */
  constructor(options: TableViewConfigOptions) {
    super('table', options);
  }

  /** An optional setting controlling the height of each row in the table. */
  get rowHeight(): RowHeightType | undefined { return this.options.rowHeight; }

  /**
   * An optional map of serialized property keys to their column width values.
   * Each entry controls the display width of a specific column.
   */
  get columnSize(): Map<string, number> | undefined { return this.options.columnSize; }

  /**
   * Serializes this table view configuration to a plain object.
   * Extends the base serialization with table-specific fields.
   * Only fields that are defined are included in the output.
   *
   * @returns A plain object representing this table view configuration.
   */
  serialize(): Record<string, unknown> {
    const result = super.serialize();

    if (this.rowHeight) {
      result.rowHeight = this.rowHeight;
    }
    if (this.columnSize) {
      result.columnSize = Object.fromEntries(this.columnSize);
    }

    return result;
  }
}

// ─── List View ────────────────────────────────────────────────────────────────

/**
 * Represents the configuration for a list layout view.
 * Extends {@link ViewConfig} with no additional fields —
 * list views rely solely on the base view options.
 */
export class ListViewConfig extends ViewConfig {
  /**
   * Creates a new {@link ListViewConfig} instance.
   *
   * @param options - The list view configuration options.
   * @throws {Error} If `name` is empty or contains only whitespace.
   */
  constructor(options: ListViewConfigOptions) {
    super('list', options);
  }
}