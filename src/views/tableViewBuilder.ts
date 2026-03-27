import { TableViewConfigOptions } from 'views/tableViewConfigOptions';
import { TableViewConfig } from './tableViewConfig';
import { BaseViewBuilder } from './viewConfigBuilder';

// ─── Table View Builder ──────────────────────────────────────────────────────

/**
 * Builder for {@link TableViewConfig} instances.
 * Extends {@link BaseViewBuilder} with table-specific setter methods.
 */
export class TableViewBuilder extends BaseViewBuilder<TableViewConfigOptions> {

  // ── Attributes

  /** Narrows the inherited {@link BaseViewBuilder.options} to {@link TableViewConfigOptions}. */
  protected declare options: Partial<TableViewConfigOptions>;

  // ── Constructor

  /**
   * Creates a new {@link TableViewBuilder} instance.
   *
   * @param existing - Optional existing table view configuration to initialize from.
   */
  constructor(existing?: TableViewConfigOptions) {
    super(existing);
  }

  // ── Mutators

  /**
   * Sets the height of each row in the table.
   *
   * @param rowHeight - The row height type.
   * @returns The builder instance for chaining.
   */
  setRowHeight(rowHeight: TableViewConfigOptions.RowHeightType): this {
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

  // ── Build

  /**
   * Builds and returns a {@link TableViewConfig} from the accumulated options.
   *
   * @returns The constructed {@link TableViewConfig}.
   */
  protected buildInternal(): TableViewConfig {
    return new TableViewConfig(this.options as TableViewConfigOptions);
  }
}