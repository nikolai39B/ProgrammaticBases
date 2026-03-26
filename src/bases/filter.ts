// filter.ts

// ─── Filter Leaf ─────────────────────────────────────────────────────────────

/**
 * A leaf filter node — a raw filter expression string.
 */
export type FilterLeaf = string

// ─── Filter Group ────────────────────────────────────────────────────────────

/**
 * A recursive filter tree node that combines {@link Filter} children
 * using a logical {@link FilterOperator}.
 */
export class FilterGroup {

  // ── Attributes

  /** The logical operator applied to this group's children. */
  operator: FilterGroup.Operator;

  /** The child filters — either leaf strings or nested {@link FilterGroup} instances. */
  children: Filter[];


  // ── Constructor

  /**
   * Creates a new {@link FilterGroup} instance.
   *
   * @param operator - The logical operator to apply.
   * @param children - The child filters to combine.
   */
  constructor(operator: FilterGroup.Operator, children: Filter[]) {
    this.operator = operator;
    this.children = children;
  }


  // ── Serialization

  /**
   * Serializes this filter group to a plain object keyed by its operator.
   * Each child is serialized recursively — leaf strings are kept as-is.
   *
   * @returns The serialized filter group object.
   */
  serialize(): Record<string, unknown> {
    // Serialize the children
    const serilaizedChildren = this.children.map(child =>
        typeof child === 'string' ? child : child.serialize()
      );
    
    return { [this.operator]: serilaizedChildren };
  }

  /**
   * Deserializes a plain object into a {@link FilterGroup} instance.
   *
   * @param raw - The raw object to deserialize.
   * @returns The deserialized {@link FilterGroup}.
   * @throws {Error} If the input is not an object, lacks a valid operator, or children is not an array.
   */
  static deserialize(raw: Record<string, unknown>): FilterGroup {
    // Get the group's operator
    const operator = FilterGroup.operators.find(op => op in raw);
    if (!operator) {
      throw new Error(`Expected one of ${FilterGroup.operators.join(', ')}`);
    }

    // Get the children
    const rawChildren = raw[operator];
    if (!Array.isArray(rawChildren)) {
      throw new Error(`Expected an array, got: ${JSON.stringify(rawChildren)}`);
    }

    // Deserialize the children recursively
    const children = rawChildren.map(c => Filter.deserialize(c));
    return new FilterGroup(operator, children);
  }
}

export namespace FilterGroup {
  /**
   * The logical operator used to combine children within a {@link FilterGroup}.
   * - `'and'` — all children must match
   * - `'or'` — at least one child must match
   * - `'none'` — no children must match
   */
  export type Operator = 'and' | 'or' | 'none';

  /** All valid {@link Operator} values, useful for iteration and validation. */
  export const operators: Operator[] = ['and', 'or', 'none'];
}

// ─── Filter ──────────────────────────────────────────────────────────────────

/**
 * A filter node — either a raw {@link FilterLeaf} string or a nested {@link FilterGroup}.
 */
export type Filter = FilterLeaf | FilterGroup;

/**
 * Namespace holding the deserializer for the {@link Filter} union type.
 * A standalone function cannot be attached to a union type directly,
 * so this namespace acts as a logical home for filter-level deserialization.
 */
export namespace Filter {

  /**
   * Deserializes a raw value into a {@link Filter} — either a {@link FilterLeaf}
   * or a {@link FilterGroup}, depending on the input type.
   *
   * @param raw - The raw value to deserialize.
   * @returns The deserialized {@link Filter}.
   */
  export function deserialize(raw: unknown): Filter {
    // If the raw object is a string, use it directly
    if (typeof raw === 'string') {
      return raw as FilterLeaf;
    }

    // Othewise, deserialize
    return FilterGroup.deserialize(raw as Record<string, unknown>);
  }
}