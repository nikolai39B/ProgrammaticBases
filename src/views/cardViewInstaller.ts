// cardViewInstaller.ts
import { CardViewBuilder } from "./cardViewBuilder";
import { CardViewConfig } from "./cardViewConfig";
import { CardViewConfigOptions } from "./cardViewConfigOptions";
import { ViewTypeInstallerBase } from "./viewTypeInstaller";

// ─── Card View Installer ─────────────────────────────────────────────────────

export class CardViewInstaller extends ViewTypeInstallerBase<'cards', CardViewConfig> {
  readonly type = 'cards' as const;

  createBuilder(config: CardViewConfig): CardViewBuilder {
    return new CardViewBuilder(config);
  }
  
  deserialize(raw: Record<string, unknown>): CardViewConfig {
    return CardViewConfig.deserialize(raw);
  }
}