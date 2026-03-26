// tableViewInstaller.ts
import { TableViewBuilder } from "./tableViewBuilder";
import { TableViewConfig } from "./tableViewConfig";
import { ViewConfigOptions } from "./viewConfigOptions";
import { ViewTypeInstallerBase } from "./viewTypeInstaller";

// ─── Table View Installer ────────────────────────────────────────────────────

export class TableViewInstaller extends ViewTypeInstallerBase<'table', TableViewConfig> {
  readonly type = 'table' as const;

  createBuilder(config: TableViewConfig): TableViewBuilder {
    return new TableViewBuilder(config);
  }

  deserialize(raw: Record<string, unknown>): TableViewConfig {
    return TableViewConfig.deserialize(raw);
  }
}