import { FilterGroup } from 'primitives/filter';
import { Property } from 'primitives/property';
import { PropertyOrder } from 'primitives/propertyOrder';

// ─── Base ─────────────────────────────────────────────────────────────────────

/**
 * Options shared across all view configuration types.
 * Used as the base for all view-specific options interfaces.
 */
export interface ViewConfigOptions {
  /** The display name of this view. Must not be empty or whitespace. */
  name: string;

  /** An optional filter group scoped to this view. */
  filters?: FilterGroup;

  /** An optional property by which items in this view are grouped. */
  groupBy?: PropertyOrder;

  /** An optional list of sort rules applied to this view, in order. */
  sort?: PropertyOrder[];

  /** An optional ordered list of properties defining column or field display order. */
  propertyOrder?: Property[];
}