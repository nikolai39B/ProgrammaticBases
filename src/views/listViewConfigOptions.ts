import { ViewConfigOptions } from './viewConfigOptions';

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * Options for configuring a list layout view.
 * Extends {@link ViewConfigOptions} with additional fields for controlling
 * how list items are displayed, indented, and separated.
 */
export interface ListViewConfigOptions extends ViewConfigOptions {
  /**
   * Whether to indent nested properties under their parent item.
   * When `true`, child properties are visually nested for hierarchy clarity.
   * @default false
   */
  indentProperties?: boolean;

  /**
   * The marker style used for list items.
   * - `'number'` — numbered list (1, 2, 3, ...)
   * - `'bullet'` — bulleted list (•)
   * - `'none'`   — no marker
   * @default 'bullet'
   */
  markers?: ListViewConfigOptions.MarkerType;

  /**
   * A string used to separate list items or their properties.
   * For example, `','` or `' | '`.
   * @default undefined
   */
  separator?: string;
}

export namespace ListViewConfigOptions {
  /**
   * Defines the visual marker style for list items in a list view.
   * - `'number'` — items are prefixed with an incrementing number
   * - `'bullet'` — items are prefixed with a bullet point
   * - `'none'`   — items have no prefix marker
   */
  export type MarkerType = 'number' | 'bullet' | 'none';

  /** All valid {@link MarkerType} values, useful for iteration and validation. */
  export const markerTypes: MarkerType[] = ['number', 'bullet', 'none'];
}