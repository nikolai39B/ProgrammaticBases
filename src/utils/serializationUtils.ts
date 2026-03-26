export class SerializationUtils {
  /**
   * Serializes an array of instances of type `T` into a merged record of key-value pairs.
   *
   * Each instance is serialized using the provided `serialize` function, which must return
   * a single-entry record. All resulting records are then merged into one.
   *
   * @param items - The array of instances to serialize.
   * @param serialize - A function that serializes a single instance into a
   *                    single-entry `Record<string, unknown>`.
   * @returns A merged record containing all serialized key-value pairs.
   *
   * @example
   * const formulas = SerializationUtils.serializeRecord(
   *   this.formulas,
   *   f => f.serialize()
   * );
   */
  static serializeRecord<T>(
    items: T[],
    serialize: (item: T) => Record<string, unknown>
  ): Record<string, unknown> {
    return Object.assign({}, ...items.map(serialize));
  }
  
  /**
   * Deserializes a record of key-value pairs into an array of instances of type `T`.
   *
   * Each entry in the record is passed individually to the provided `deserialize`
   * function as a single-entry `{ key: value }` record.
   *
   * @param raw - The raw record to deserialize, where each key-value pair
   *              represents a single serialized instance.
   * @param deserialize - A function that deserializes a single-entry record
   *                      into an instance of type `T`.
   * @returns An array of deserialized instances of type `T`.
   *
   * @example
   * const formulas = SerializationUtils.deserializeRecord(
   *   raw.formulas as Record<string, unknown>,
   *   Formula.deserialize
   * );
   */
  static deserializeRecord<T>(
    raw: Record<string, unknown>,
    deserialize: (raw: Record<string, unknown>) => T
  ): T[] {
    return Object.entries(raw).map(([name, value]) =>
      deserialize({ [name]: value })
    );
  }
}