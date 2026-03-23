import { TableViewConfigOptions } from './tableViewConfigOptions';
import { ViewType } from './viewType';
import { ViewConfig } from './viewConfig';

// ─── Table View ───────────────────────────────────────────────────────────────

/**
 * Represents the configuration for a table layout view.
 * Extends {@link ViewConfig} with table-specific options such as
 * row height and per-column width sizing.
 */
export class TableViewConfig extends ViewConfig {

  // ── Attributes

  /** Identifies this class as the handler for the `'table'` view type. */
  static readonly type = 'table' as const satisfies ViewType;

  /** Narrows the inherited {@link ViewConfig.options} to {@link TableViewConfigOptions}. */
  protected declare _options: TableViewConfigOptions;
  get options(): TableViewConfigOptions { return this._options; }

  // ── Constructor

  /**
   * Creates a new {@link TableViewConfig} instance.
   *
   * @param options - The table view configuration options.
   * @throws {Error} If `options.name` is empty or contains only whitespace.
   */
  constructor(options: TableViewConfigOptions) {
    super(options);
  }

  // ── Accessors

  /** An optional setting controlling the height of each row in the table. */
  get rowHeight(): TableViewConfigOptions.RowHeightType | undefined { return this.options.rowHeight; }

  /**
   * An optional map of serialized property keys to their column width values.
   * Each entry controls the display width of a specific column.
   */
  get columnSize(): Map<string, number> | undefined { return this.options.columnSize; }

  // ── Serialization

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

  /**
   * Deserializes a raw plain object into a {@link TableViewConfig} instance.
   *
   * @param raw - The raw object to deserialize parsed from YAML.
   * @returns A fully constructed {@link TableViewConfig} instance.
   */
  static deserialize(raw: Record<string, unknown>): TableViewConfig {
    // TODO: implement
    throw new Error('Not implemented');
  }
}