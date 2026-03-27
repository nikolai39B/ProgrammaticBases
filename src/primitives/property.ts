// property.ts

import { SerializationUtils } from "utils/serializationUtils";

// ─── Property ────────────────────────────────────────────────────────────────

/**
 * Represents a typed reference to a named property from a specific source.
 * Properties are serialized as `"source.name"` strings when a source is present,
 * or as plain `"name"` strings when no source is specified.
 */
export class Property {

  // ── Attributes

  /** The origin source of this property, if specified. */
  source?: Property.Source;

  /** The name of the property within its source. */
  name: string;

  // ── Constructor

  /**
   * Creates a new {@link Property} instance.
   *
   * @param name - The property name.
   * @param source - The property source. If omitted, no source is associated
   *   and the property serializes as a plain name string.
   */
  constructor(name: string, source?: Property.Source) {
    this.source = source;
    this.name = name;
  }

  // ── Serialization

  /**
   * Serializes this property to a string.
   *
   * - If a source is present, returns `"source.name"` (e.g. `"file.path"`).
   * - If no source is present, returns the plain name (e.g. `"thumbnail"`).
   *
   * @returns The serialized property string.
   */
  serialize(): string {
    if (this.source === undefined) {
      return this.name;
    }
    return `${this.source}.${this.name}`;
  }

  /**
   * Deserializes a property string into a {@link Property} instance.
   *
   * Accepts two formats:
   * - `"source.name"` — explicit source and name (e.g. `"file.path"`)
   * - `"name"` — plain name with no source (e.g. `"thumbnail"`)
   *
   * @param raw - The raw serialized property string.
   * @returns The deserialized {@link Property}.
   * @throws {Error} If a dot separator is present but the source prefix is not
   *   a valid {@link Property.Source}.
   */
  static deserialize(raw: string): Property {
    const dotIndex = raw.indexOf('.');

    if (dotIndex === -1) {
      return new Property(raw);
    }

    const source = SerializationUtils.deserializeTypedString<Property.Source>(
      raw.slice(0, dotIndex),
      Property.sources
    );
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

  /** All valid {@link Source} values, useful for iteration and validation. */
  export const sources: Source[] = ['file', 'note', 'formula'];
}