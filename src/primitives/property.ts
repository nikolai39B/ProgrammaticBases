// property.ts

// ─── Property ────────────────────────────────────────────────────────────────

/**
 * Represents a typed reference to a named property from a specific source.
 * Properties are serialized as `"source.name"` strings for storage and transport.
 */
export class Property {

  // ── Attributes

  /** The origin source of this property. */
  source: Property.Source;

  /** The name of the property within its source. */
  name: string;

  // ── Constructor

  /**
   * Creates a new {@link Property} instance.
   *
   * @param name - The property name.
   * @param source - The property source. Defaults to `'note'`.
   */
  constructor(name: string, source: Property.Source = 'note') {
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
    // Slice the raw string to get the source and name
    const dotIndex = raw.indexOf('.');
    if (dotIndex === -1) {
      throw new Error(`Invalid property string: "${raw}"`);
    }
    const source = raw.slice(0, dotIndex) as Property.Source;
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

export namespace Property {

  /**
   * Represents the origin source of a {@link Property}.
   * - `'file'` — derived from file-level metadata (e.g. filename, path)
   * - `'note'` — a user-defined frontmatter property on the note
   * - `'formula'` — a computed value defined by a {@link Formula}
   */
  export type Source = 'file' | 'note' | 'formula';
}