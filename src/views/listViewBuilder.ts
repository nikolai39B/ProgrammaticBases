import { ListViewConfigOptions } from 'views/listViewConfigOptions';
import { ListViewConfig } from './listViewConfig';
import { BaseViewBuilder } from './viewConfigBuilder';

// ─── List View Builder ───────────────────────────────────────────────────────

/**
 * Builder for {@link ListViewConfig} instances.
 * Extends {@link BaseViewBuilder} with no additional fields —
 * list views rely solely on the base view options.
 */
export class ListViewBuilder extends BaseViewBuilder<ListViewConfigOptions> {

  // ── Constructor

  /**
   * Creates a new {@link ListViewBuilder} instance.
   *
   * @param existing - Optional existing list view configuration to initialize from.
   */
  constructor(existing?: ListViewConfigOptions) {
    super(existing);
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