// propertyOrder.ts

import { SerializationUtils } from "utils/serializationUtils";
import { Property } from "./property";

// ─── Property Order ──────────────────────────────────────────────────────────

/**
 * Represents a sort or group-by rule applied to a specific {@link Property}.
 */
export class PropertyOrder {

  // ── Attributes

  /** The property this ordering rule applies to. */
  property: Property;

  /** The direction in which to sort. */
  direction: PropertyOrder.Direction;


  // ── Constructor

  /**
   * Creates a new {@link PropertyOrder} instance.
   *
   * @param property - The property to order by.
   * @param direction - The sort direction.
   */
  constructor(property: Property, direction: PropertyOrder.Direction) {
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
    const direction = SerializationUtils.deserializeTypedString<PropertyOrder.Direction>(raw.direction, PropertyOrder.directions);
    return new PropertyOrder(property, direction);
  }
}

export namespace PropertyOrder {
  /**
   * The sort direction applied to a {@link PropertyOrder}.
   * - `'ASC'` — ascending order
   * - `'DESC'` — descending order
   */
  export type Direction = 'ASC' | 'DESC';

  /** All valid {@link Direction} values, useful for iteration and validation. */
  export const directions: Direction[] = ['ASC', 'DESC'];
}