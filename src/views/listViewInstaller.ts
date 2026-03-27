// listViewInstaller.ts

import { ListViewBuilder } from "./listViewBuilder";
import { ListViewConfig } from "./listViewConfig";
import { ViewTypeInstallerBase } from "./viewTypeInstaller";

// ─── List View Installer ─────────────────────────────────────────────────────

/**
 * Installer for the **list** view type.
 *
 * Registers the list view type with the {@link ViewRegistry}, providing
 * a {@link ListViewBuilder} factory and a {@link ListViewConfig} deserializer.
 *
 * @example
 * ```typescript
 * const installer = new ListViewInstaller();
 * installer.install(viewRegistry);
 * ```
 */
export class ListViewInstaller extends ViewTypeInstallerBase<'list'> {

  /**
   * The unique identifier for the list view type.
   * Matches the `'list'` key in {@link ViewTypeRegistry}.
   */
  readonly type = 'list' as const;

  /**
   * Creates a {@link ListViewBuilder} initialised with the given config.
   *
   * Called by the builder factory each time a new list view instance is
   * created. Returns a fresh builder on every invocation.
   *
   * @param config - The existing list view configuration to initialise from.
   * @returns A new {@link ListViewBuilder} instance.
   */
  createBuilder(config: ListViewConfig): ListViewBuilder {
    return new ListViewBuilder(config);
  }

  /**
   * Deserializes a plain object into a {@link ListViewConfig} instance.
   *
   * Delegates to {@link ListViewConfig.deserialize}. Typically called by
   * the {@link ViewRegistry} when loading a persisted view configuration.
   *
   * @param raw - The raw object to deserialize, typically parsed from YAML.
   * @returns A fully populated {@link ListViewConfig} instance.
   */
  deserialize(raw: Record<string, unknown>): ListViewConfig {
    return ListViewConfig.deserialize(raw);
  }
}