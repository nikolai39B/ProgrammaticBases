import { ListViewConfigOptions } from './listViewConfigOptions';
import { ViewType } from './viewType';
import { ViewConfig } from './viewConfig';

// ─── List View ────────────────────────────────────────────────────────────────

/**
 * Represents the configuration for a list layout view.
 * Extends {@link ViewConfig} with no additional fields —
 * list views rely solely on the base view options.
 */
export class ListViewConfig extends ViewConfig {

  // ── Attributes

  /** Identifies this class as the handler for the `'list'` view type. */
  static readonly type = 'list' as const satisfies ViewType;
  
  /** Narrows the inherited {@link ViewConfig.options} to {@link CardViewConfigOptions}. */
  protected declare _options: ListViewConfigOptions;
  get options(): ListViewConfigOptions { return this._options; }


  // ── Constructor

  /**
   * Creates a new {@link ListViewConfig} instance.
   *
   * @param options - The list view configuration options.
   * @throws {Error} If `options.name` is empty or contains only whitespace.
   */
  constructor(options: ListViewConfigOptions) {
    super(options);
  }

  // ── Serialization

  /**
   * Deserializes a raw plain object into a {@link ListViewConfig} instance.
   *
   * @param raw - The raw object to deserialize parsed from YAML.
   * @returns A fully constructed {@link ListViewConfig} instance.
   */
  static deserialize(raw: Record<string, unknown>): ListViewConfig {
    // TODO: implement
    throw new Error('Not implemented');
  }
}