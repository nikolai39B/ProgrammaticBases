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
   * Deserializes a `{ name: content }` record into a {@link Formula} instance.
   *
   * @param raw - The serialized formula record, where the key is the formula name
   *              and the value is the formula content.
   * @returns The deserialized {@link Formula} instance.
   */
  static deserialize(raw: Record<string, unknown>): Formula {
    const entry = Object.entries(raw)[0];
    if (!entry) { 
      throw new Error("Cannot deserialize an empty record.");
    }
    const [name, content] = entry;
    if (typeof content !== 'string') {
      throw new Error(`Formula content must be a string, got: ${typeof content}`);
    }
    return new Formula(name, content);
  }
}