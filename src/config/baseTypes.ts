// baseTypes.ts

// ─── Property ────────────────────────────────────────────────────────────────

/**
 * Represents the origin source of a {@link Property}.
 * - `'file'` — derived from file-level metadata (e.g. filename, path)
 * - `'note'` — a user-defined frontmatter property on the note
 * - `'formula'` — a computed value defined by a {@link Formula}
 */
export type PropertySource = 'file' | 'note' | 'formula'

/**
 * Represents a typed reference to a named property from a specific source.
 * Properties are serialized as `"source.name"` strings for storage and transport.
 */
export class Property {

  // ── Attributes

  /** The origin source of this property. */
  source: PropertySource;

  /** The name of the property within its source. */
  name: string;

  // ── Constructor

  /**
   * Creates a new {@link Property} instance.
   *
   * @param name - The property name.
   * @param source - The property source. Defaults to `'note'`.
   */
  constructor(name: string, source: PropertySource = 'note') {
    this.source = source;
    this.name = name;
  }

  
  // ── Serialization

  /**
   * Serializes this property to a `"source.name"` string.
   *
   * @returns The serialized property string.
   */
  serialize(): string {
    return `${this.source}.${this.name}`;
  }

  /**
   * Deserializes a `"source.name"` string into a {@link Property} instance.
   *
   * @param raw - The raw serialized property string.
   * @returns The deserialized {@link Property}.
   * @throws {Error} If the string does not contain a `.` separator.
   */
  static deserialize(raw: string): Property {
    const dotIndex = raw.indexOf('.');
    if (dotIndex === -1) {
      throw new Error(`Invalid property string: "${raw}"`);
    }
    const source = raw.slice(0, dotIndex) as PropertySource;
    const name = raw.slice(dotIndex + 1);
    return new Property(name, source);
  }


  // ── Comparison

  /**
   * Checks whether this property is equal to another by source and name.
   *
   * @param other - The property to compare against.
   * @returns `true` if both source and name match.
   */
  equals(other: Property): boolean {
    return this.source === other.source && this.name === other.name;
  }
}

// ─── Filter ──────────────────────────────────────────────────────────────────

/**
 * The logical operator used to combine children within a {@link FilterGroup}.
 * - `'and'` — all children must match
 * - `'or'` — at least one child must match
 * - `'none'` — no children must match
 */
export type FilterOperator = 'and' | 'or' | 'none'

/**
 * A leaf filter node — a raw filter expression string.
 */
export type FilterLeaf = string

/**
 * A recursive filter tree node that combines {@link Filter} children
 * using a logical {@link FilterOperator}.
 */
export class FilterGroup {

  // ── Attributes

  /** The logical operator applied to this group's children. */
  operator: FilterOperator;

  /** The child filters — either leaf strings or nested {@link FilterGroup} instances. */
  children: Filter[];


  // ── Constructor

  /**
   * Creates a new {@link FilterGroup} instance.
   *
   * @param operator - The logical operator to apply.
   * @param children - The child filters to combine.
   */
  constructor(operator: FilterOperator, ...children: Filter[]) {
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
    return {
      [this.operator]: this.children.map(child =>
        typeof child === 'string' ? child : child.serialize()
      )
    };
  }

  /**
   * Deserializes a plain object into a {@link FilterGroup} instance.
   *
   * @param raw - The raw object to deserialize.
   * @returns The deserialized {@link FilterGroup}.
   * @throws {Error} If the input is not an object, lacks a valid operator, or children is not an array.
   */
  static deserialize(raw: unknown): FilterGroup {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(`Invalid FilterGroup: ${JSON.stringify(raw)}`);
    }

    const obj = raw as Record<string, unknown>;

    const operators: FilterOperator[] = ['and', 'or', 'none'];
    const operator = operators.find(op => op in obj);
    if (!operator) {
      throw new Error(`Expected one of ${operators.join(', ')}`);
    }

    const rawChildren = obj[operator];
    if (!Array.isArray(rawChildren)) {
      throw new Error(`Expected an array, got: ${JSON.stringify(rawChildren)}`);
    }
    const children = rawChildren.map(Filter.deserialize);
    return new FilterGroup(operator, ...children);
  }
}

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
    if (typeof raw === 'string') {
      return raw as FilterLeaf;
    }
    return FilterGroup.deserialize(raw);
  }
}

// ─── Sorting & Grouping ──────────────────────────────────────────────────────

/**
 * The sort direction applied to a {@link PropertyOrder}.
 * - `'ASC'` — ascending order
 * - `'DESC'` — descending order
 */
export type Direction = 'ASC' | 'DESC';

/**
 * Represents a sort or group-by rule applied to a specific {@link Property}.
 */
export class PropertyOrder {

  // ── Attributes

  /** The property this ordering rule applies to. */
  property: Property;

  /** The direction in which to sort. */
  direction: Direction;


  // ── Constructor

  /**
   * Creates a new {@link PropertyOrder} instance.
   *
   * @param property - The property to order by.
   * @param direction - The sort direction.
   */
  constructor(property: Property, direction: Direction) {
    this.property = property;
    this.direction = direction;
  }


  // ── Serialization

  /**
   * Serializes this property order to a plain object.
   *
   * @returns The serialized property order object.
   */
  serialize(): Record<string, unknown> {
    return {
      property: this.property.serialize(),
      direction: this.direction
    };
  }

  /**
   * Deserializes a plain object into a {@link PropertyOrder} instance.
   *
   * @param raw - The raw object to deserialize.
   * @returns The deserialized {@link PropertyOrder}.
   * @throws {Error} If the direction value is not `'ASC'` or `'DESC'`.
   */
  static deserialize(raw: Record<string, unknown>): PropertyOrder {
    const property = Property.deserialize(raw.property as string);
    const direction = raw.direction as Direction;
    if (direction !== 'ASC' && direction !== 'DESC') {
      throw new Error(`Invalid direction: "${direction}"`);
    }
    return new PropertyOrder(property, direction);
  }
}

// ─── Formulas ────────────────────────────────────────────────────────────────

/**
 * Represents a named computed formula whose result can be referenced
 * as a `'formula'` sourced {@link Property}.
 */
export class Formula {

  // ── Attributes

  /** The name of the formula, used to reference it as a {@link Property}. */
  name: string;

  /** The raw formula expression content. */
  content: string;


  // ── Constructor

  /**
   * Creates a new {@link Formula} instance.
   *
   * @param name - The formula name.
   * @param content - The formula expression.
   */
  constructor(name: string, content: string) {
    this.name = name;
    this.content = content;
  }


  // ── Serialization

  /**
   * Serializes this formula to a `{ name: content }` record.
   *
   * @returns The serialized formula object.
   */
  serialize(): Record<string, string> {
    return { [this.name]: this.content };
  }

  /**
   * Deserializes a `{ name: content }` record into an array of {@link Formula} instances.
   * Multiple formulas can be stored in a single record, one per key.
   *
   * @param raw - The raw record to deserialize.
   * @returns An array of deserialized {@link Formula} instances.
   */
  static deserialize(raw: Record<string, string>): Formula[] {
    return Object.entries(raw).map(([name, content]) => new Formula(name, content));
  }
}