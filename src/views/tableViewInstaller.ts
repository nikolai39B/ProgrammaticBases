// tableViewInstaller.ts

import { TableViewBuilder } from "./tableViewBuilder";
import { TableViewConfig } from "./tableViewConfig";
import { ViewTypeInstallerBase } from "./viewTypeInstaller";

// ─── Table View Installer ────────────────────────────────────────────────────

/**
 * Installer for the **table** view type.
 *
 * Registers the table view type with the {@link ViewRegistry}, providing
 * a {@link TableViewBuilder} factory and a {@link TableViewConfig} deserializer.
 *
 * @example
 * ```typescript
 * const installer = new TableViewInstaller();
 * installer.install(viewRegistry);
 * ```
 */
export class TableViewInstaller extends ViewTypeInstallerBase<'table'> {

  /**
   * The unique identifier for the table view type.
   * Matches the `'table'` key in {@link ViewTypeRegistry}.
   */
  readonly type = 'table' as const;

  /**
   * Creates a {@link TableViewBuilder} initialised with the given config.
   *
   * Called by the builder factory each time a new table view instance is
   * created. Returns a fresh builder on every invocation.
   *
   * @param config - The existing table view configuration to initialise from.
   * @returns A new {@link TableViewBuilder} instance.
   */
  createBuilder(config: TableViewConfig): TableViewBuilder {
    return new TableViewBuilder(config);
  }

  /**
   * Deserializes a plain object into a {@link TableViewConfig} instance.
   *
   * Delegates to {@link TableViewConfig.deserialize}. Typically called by
   * the {@link ViewRegistry} when loading a persisted view configuration.
   *
   * @param raw - The raw object to deserialize, typically parsed from YAML.
   * @returns A fully populated {@link TableViewConfig} instance.
   */
  deserialize(raw: Record<string, unknown>): TableViewConfig {
    return TableViewConfig.deserialize(raw);
  }
}