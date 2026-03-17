// viewConfigOptions.ts

import { FilterGroup, PropertyOrder, Property } from './baseTypes';

/**
 * Options shared across all view configuration types.
 * Used as the base for all view-specific options interfaces.
 */
export interface ViewConfigOptions {
  /** The display name of this view. Must not be empty or whitespace. */
  name: string;

  /** An optional filter group scoped to this view. */
  filters?: FilterGroup;

  /** An optional property by which items in this view are grouped. */
  groupBy?: PropertyOrder;

  /** An optional list of sort rules applied to this view, in order. */
  sort?: PropertyOrder[];

  /** An optional ordered list of properties defining column or field display order. */
  propertyOrder?: Property[];
}

/** Controls how the image is fitted within a card. */
export type ImageFitType = 'contain' | 'cover';

/**
 * Options for configuring a card layout view.
 * Extends {@link ViewConfigOptions} with card-specific fields.
 */
export interface CardViewConfigOptions extends ViewConfigOptions {
  /** An optional size value controlling the width of each card. */
  cardSize?: number;

  /** An optional property whose value is used as the card image. */
  image?: Property;

  /** An optional setting controlling how the image is fitted within the card. */
  imageFit?: ImageFitType;

  /** An optional aspect ratio for the card image (e.g. `1.5` for 3:2). */
  imageAspectRatio?: number;
}

/** Controls the row height in a table view. */
export type RowHeightType = 'short' | 'medium' | 'tall' | 'extra-tall';

/**
 * Options for configuring a table layout view.
 * Extends {@link ViewConfigOptions} with table-specific fields.
 */
export interface TableViewConfigOptions extends ViewConfigOptions {
  /**
   * An optional map of serialized property keys to their column width values.
   * Each entry controls the display width of a specific column.
   */
  columnSize?: Map<string, number>;

  /** An optional setting controlling the height of each row in the table. */
  rowHeight?: RowHeightType;
}

/**
 * Options for configuring a list layout view.
 * Extends {@link ViewConfigOptions} with no additional fields —
 * list views rely solely on the base view options.
 */
export interface ListViewConfigOptions extends ViewConfigOptions {}