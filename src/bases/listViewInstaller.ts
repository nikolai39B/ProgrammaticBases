// listViewInstaller.ts
import { ListViewBuilder } from "./listViewBuilder";
import { ListViewConfig } from "./listViewConfig";
import { ViewTypeInstallerBase } from "./viewTypeInstaller";

// ─── List View Installer ─────────────────────────────────────────────────────

export class ListViewInstaller extends ViewTypeInstallerBase<'list', ListViewConfig> {
  readonly type = 'list' as const;
  createBuilder(config: ListViewConfig): ListViewBuilder {
    return new ListViewBuilder(config);
  }
}