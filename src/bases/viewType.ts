// viewTypeRegistry.ts

import { ViewConfig } from "./viewConfig";

// ─── Registry ────────────────────────────────────────────────────────────────

export interface ViewTypeRegistry {
  'cards': true;
  'table': true;
  'list':  true;
}

export type ViewType = keyof ViewTypeRegistry;


// viewTypeRegistry.ts

//import { ViewConfig } from "./viewConfig";
//import { ViewConfigVisitor } from "./viewConfigVisitor";

/**
 * Registers all handlers for a given view type across all visitors.
 * Called once per view type, keeping each type's logic co-located.
 */
export function registerViewType<T extends ViewConfig>(
  type: ViewType,
  handlers: {
    builder: (config: T) => ViewConfigBuilder;
    icon: (config: T) => IconType;
    // ... other visitors
  }
): void {
  builderFactory.register(type, handlers.builder);
  iconFactory.register(type, handlers.icon);
}

registerViewType('cards', {
  builder: (config: CardViewConfig) => new CardViewBuilder(config),
  icon: (_config) => 'grid-icon',
});

registerViewType('table', {
  builder: (config: TableViewConfig) => new TableViewBuilder(config),
  icon: (_config) => 'table-icon',
});