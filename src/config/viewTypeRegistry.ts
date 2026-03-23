// viewTypeRegistry.ts

import { ViewConfig } from "./viewConfig";

// ─── Registry ────────────────────────────────────────────────────────────────

export interface ViewTypeRegistry {
  'cards': true;
  'table': true;
  'list':  true;
}

export type ViewType = keyof ViewTypeRegistry;


