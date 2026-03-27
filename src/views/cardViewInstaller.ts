// cardViewInstaller.ts

import { CardViewBuilder } from "./cardViewBuilder";
import { CardViewConfig } from "./cardViewConfig";
import { ViewTypeInstallerBase } from "./viewTypeInstaller";

// ─── Card View Installer ─────────────────────────────────────────────────────

/**
 * Installer for the **cards** view type.
 *
 * Registers the cards view type with the {@link ViewRegistry}, providing
 * a {@link CardViewBuilder} factory and a {@link CardViewConfig} deserializer.
 *
 * @example
 * ```typescript
 * const installer = new CardViewInstaller();
 * installer.install(viewRegistry);
 * ```
 */
export class CardViewInstaller extends ViewTypeInstallerBase<'cards'> {

  /**
   * The unique identifier for the cards view type.
   * Matches the `'cards'` key in {@link ViewTypeRegistry}.
   */
  readonly type = 'cards' as const;

  /**
   * Creates a {@link CardViewBuilder} initialised with the given config.
   *
   * Called by the builder factory each time a new cards view instance is
   * created. Returns a fresh builder on every invocation.
   *
   * @param config - The existing cards view configuration to initialise from.
   * @returns A new {@link CardViewBuilder} instance.
   */
  createBuilder(config: CardViewConfig): CardViewBuilder {
    return new CardViewBuilder(config);
  }

  /**
   * Deserializes a plain object into a {@link CardViewConfig} instance.
   *
   * Delegates to {@link CardViewConfig.deserialize}. Typically called by
   * the {@link ViewRegistry} when loading a persisted view configuration.
   *
   * @param raw - The raw object to deserialize, typically parsed from YAML.
   * @returns A fully populated {@link CardViewConfig} instance.
   */
  deserialize(raw: Record<string, unknown>): CardViewConfig {
    return CardViewConfig.deserialize(raw);
  }
}