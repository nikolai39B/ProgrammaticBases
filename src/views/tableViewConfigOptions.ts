import { ViewConfigOptions } from './viewConfigOptions';

// ─── Table ────────────────────────────────────────────────────────────────────

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
  rowHeight?: TableViewConfigOptions.RowHeightType;
}

export namespace TableViewConfigOptions {
  /**
   * Controls the row height in a table view.
   * - `'short'` — compact row height
   * - `'medium'` — default row height
   * - `'tall'` — expanded row height
   * - `'extra-tall'` — maximum row height
   */
  export type RowHeightType = 'short' | 'medium' | 'tall' | 'extra-tall';
}