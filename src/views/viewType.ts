// viewType.ts

// ─── View Type ───────────────────────────────────────────────────────────────

/**
 * Registry of all known view types in the application.
 *
 * To add a new view type, extend this interface with a new key. The value
 * should always be `true` — it exists only to satisfy the mapped type and
 * carries no runtime meaning.
 *
 * @example
 * ```typescript
 * declare module "./viewType" {
 *   interface ViewTypeRegistry {
 *     gantt: true;
 *   }
 * }
 * ```
 */
export interface ViewTypeRegistry {
  'cards': true;
  'table': true;
  'list':  true;
}

/**
 * Union of all registered view type keys.
 *
 * Derived from {@link ViewTypeRegistry}, so it automatically stays in sync
 * as new view types are added.
 */
export type ViewType = keyof ViewTypeRegistry;