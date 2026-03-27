import { ListViewConfigOptions } from './listViewConfigOptions';
import { ViewType } from './viewType';
import { ViewConfig } from './viewConfig';
import { SerializationUtils } from 'utils/serializationUtils';

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
  
  /** Narrows the inherited {@link ViewConfig.options} to {@link ListViewConfigOptions}. */
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

  // ── Accessors

  /** An optional flag controlling whether nested properties are indented under their parent item. */
  get indentProperties(): boolean | undefined { return this.options.indentProperties; }

  /** An optional marker style used to prefix each list item (`'number'`, `'bullet'`, or `'none'`). */
  get markers(): ListViewConfigOptions.MarkerType | undefined { return this.options.markers; }

  /** An optional string used to separate list items or their properties (e.g. `','` or `' | '`). */
  get separator(): string | undefined { return this.options.separator; }

  // ── Serialization

  /**
   * Serializes this list view configuration to a plain object.
   * Extends the base serialization with list-specific fields.
   * Only fields that are defined are included in the output.
   *
   * @returns A plain object representing this list view configuration.
   */
  serialize(): Record<string, unknown> {
    // Serialize the base class properties
    const obj = super.serialize();

    // Serialize attributes
    if (this.indentProperties != null) {
      obj.indentProperties = this.indentProperties;
    }
    if (this.markers) {
      obj.markers = this.markers;
    }
    if (this.separator != null) {
      obj.separator = this.separator;
    }

    return obj;
  }

  /**
   * Deserializes a raw plain object into a {@link ListViewConfig} instance.
   *
   * @param raw - The raw object to deserialize parsed from YAML.
   * @returns A fully constructed {@link ListViewConfig} instance.
   */
  static deserialize(raw: Record<string, unknown>): ListViewConfig {
    // Deserialize base class properties
    const base = ViewConfig.deserialize(raw);

    // Deserialize attributes
    const markers = raw.markers ?
      SerializationUtils.deserializeTypedString<ListViewConfigOptions.MarkerType>(raw.markers, ListViewConfigOptions.markerTypes) :
      undefined;

    return new ListViewConfig({
      ...base,
      indentProperties: raw.indentProperties as boolean | undefined,
      markers: markers,
      separator: raw.separator as string | undefined
    });
  }
}