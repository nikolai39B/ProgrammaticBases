import { ListViewConfigOptions } from 'views/listViewConfigOptions';
import { ListViewConfig } from './listViewConfig';
import { BaseViewBuilder } from './viewConfigBuilder';

// ─── List View Builder ───────────────────────────────────────────────────────

/**
 * Builder for {@link ListViewConfig} instances.
 * Extends {@link BaseViewBuilder} with additional mutators for list-specific
 * options such as indentation, marker style, and item separation.
 */
export class ListViewBuilder extends BaseViewBuilder<ListViewConfigOptions> {

  // ── Attributes

  /** Narrows the inherited {@link BaseViewBuilder.options} to {@link CardViewConfigOptions}. */
  protected declare options: ListViewConfigOptions;

  // ── Constructor

  /**
   * Creates a new {@link ListViewBuilder} instance.
   *
   * @param existing - Optional existing list view configuration to initialize from.
   */
  constructor(existing?: ListViewConfigOptions) {
    super(existing);
  }

  // ── Mutators

  /**
   * Sets whether nested properties should be indented under their parent item.
   *
   * @param indentProperties - `true` to enable indentation, `false` to disable.
   * @returns This builder instance for chaining.
   */
  setIndentProperties(indentProperties: boolean): this {
    this.options.indentProperties = indentProperties;
    return this;
  }

  /**
   * Sets the marker style used for list items.
   *
   * @param markers - The marker type to apply (`'number'`, `'bullet'`, or `'none'`).
   * @returns This builder instance for chaining.
   */
  setMarkers(markers: ListViewConfigOptions.MarkerType): this {
    this.options.markers = markers;
    return this;
  }

  /**
   * Sets the separator string used between list items or their properties.
   *
   * @param separator - The separator string, e.g. `','` or `' | '`.
   * @returns This builder instance for chaining.
   */
  setSeparator(separator: string): this {
    this.options.separator = separator;
    return this;
  }

  // ── Build

  /**
   * Builds and returns a {@link ListViewConfig} from the accumulated options.
   *
   * @returns The constructed {@link ListViewConfig}.
   */
  protected buildInternal(): ListViewConfig {
    return new ListViewConfig(this.options as ListViewConfigOptions);
  }
}