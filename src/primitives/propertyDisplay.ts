// propertyDisplay.ts

import { Property } from "./property";

// ─── Property Display ─────────────────────────────────────────────────────────

/**
 * Represents a {@link Property} paired with a human-readable display name,
 * used to control how a property is labeled when rendered.
 */
export class PropertyDisplay {

  // ── Attributes

  /** The property being displayed. */
  property: Property;

  /** The human-readable label for the property. */
  displayName: string;

  // ── Constructor

  /**
   * Creates a new {@link PropertyDisplay} instance.
   *
   * @param property - The property to display.
   * @param displayName - The human-readable label for the property.
   */
  constructor(property: Property, displayName: string) {
    this.property = property;
    this.displayName = displayName;
  }

  // ── Serialization

  /**
   * Serializes this property display to a single-entry record,
   * where the key is the property name and the value contains the display name.
   *
   * @returns A single-entry record of the form `{ [property]: { displayName: string } }`.
   */
  serialize(): Record<string, unknown> {
    return {
      [this.property.serialize()]: {
        displayName: this.displayName
      }
    };
  }
  
  /**
   * Deserializes a single-entry record into a {@link PropertyDisplay} instance.
   *
   * @param raw - A single-entry record where the key is the property name
   *              and the value contains the display name.
   * @returns The deserialized {@link PropertyDisplay} instance.
   */
  static deserialize(raw: Record<string, unknown>): PropertyDisplay {
    // Exactly one entry expected
    const entry = Object.entries(raw)[0];
    if (!entry) {
      throw new Error("Cannot deserialize an empty record.");
    }

    // Deserialize the property name and display name
    const [propertyName, value] = entry;
    const property = Property.deserialize(propertyName);
    const displayName = (value as { displayName: string }).displayName;
    
    return new PropertyDisplay(property, displayName);
  }
}