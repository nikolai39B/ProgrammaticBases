// formula.ts

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