// viewType.ts

import { CardViewConfig } from "./cardViewConfig";
import { ListViewConfig } from "./listViewConfig";
import { TableViewConfig } from "./tableViewConfig";

// ─── View Type ───────────────────────────────────────────────────────────────

/**
 * Registry of all known view types in the application.
 *
 * Each key is a unique view type identifier and its value is the corresponding
 * {@link ViewConfig} type for that view. This mapping is used throughout the
 * type system to infer the correct configuration type from a given view type
 * key, without requiring explicit type parameters at call sites.
 *
 * To add a new view type, extend this interface via declaration merging and
 * provide the corresponding configuration type as the value.
 *
 * @example
 * ```typescript
 * declare module "./viewType" {
 *   interface ViewTypeRegistry {  
 *     gantt: GanttViewConfig;
 *   }
 * }
 * ```
 */
export interface ViewTypeRegistry {
  'cards': CardViewConfig;
  'table': TableViewConfig;
  'list':  ListViewConfig;
}

/**
 * Union of all registered view type keys.
 *
 * Derived from {@link ViewTypeRegistry}, so it automatically stays in sync
 * as new view types are added.
 */
export type ViewType = keyof ViewTypeRegistry;