import { FilterGroup } from './filter';
import { Property } from './property';
import { PropertyOrder } from './propertyOrder';
import { ViewConfigOptions } from './viewConfigOptions';
import { ViewType } from './viewType';

// ─── Constructor Interface ───────────────────────────────────────────────────

/**
 * Describes the static side of a {@link ViewConfig} subclass.
 * Used by the view config registry to deserialize raw objects into
 * typed view config instances without instantiating the class directly.
 */
export interface ViewConfigConstructor {

  // ── Attributes

  /** The view type string this class is responsible for. */
  readonly type: ViewType;

  // ── Serialization

  /**
   * Deserializes a raw plain object into a typed {@link ViewConfig} instance.
   *
   * @param raw - The raw object to deserialize parsed from YAML.
   * @returns A fully constructed {@link ViewConfig} instance.
   */
  deserialize(raw: Record<string, unknown>): ViewConfig;
}

// ─── View Base Class ─────────────────────────────────────────────────────────

/**
 * Represents the shared configuration fields common to all view types.
 *
 * Subclasses must satisfy {@link ViewConfigConstructor} on their static side
 * to support type resolution and registration with the view config registry.
 *
 * Serializes to a plain object suitable for YAML or JSON export.
 */
export abstract class ViewConfig {

  // ── Attributes

  /** The configuration options for this view. */
  protected _options: ViewConfigOptions;
  get options(): ViewConfigOptions { return this._options; }

  // ── Constructor

  /**
   * Creates a new {@link ViewConfig} instance.
   *
   * @param options - The base view configuration options.
   * @throws {Error} If `options.name` is empty or contains only whitespace.
   */
  constructor(options: ViewConfigOptions) {
    if (!options.name.trim()) {
      throw new Error('View name cannot be empty');
    }
    this._options = options;
  }

  // ── Accessors

  /**
   * The layout type of this view, derived from the subclass's `static readonly type` field.
   */
  get type(): ViewType {
    return (this.constructor as unknown as ViewConfigConstructor).type;
  }

  /** The display name of this view. */
  get name(): string { return this.options.name; }

  /** An optional filter group scoped to this view. */
  get filters(): FilterGroup | undefined { return this.options.filters; }

  /** An optional property by which items in this view are grouped. */
  get groupBy(): PropertyOrder | undefined { return this.options.groupBy; }

  /** An optional list of sort rules applied to this view, in order. */
  get sort(): PropertyOrder[] | undefined { return this.options.sort; }

  /** An optional ordered list of properties defining column or field display order. */
  get propertyOrder(): Property[] | undefined { return this.options.propertyOrder; }

  // ── Serialization

  /**
   * Serializes this view configuration to a plain object.
   * Only fields that are defined are included in the output.
   * Subclasses should call `super.serialize()` and extend the result
   * with their own fields.
   *
   * @returns A plain object representing this view configuration.
   */
  serialize(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      type: this.type,
      name: this.name,
    };

    if (this.filters) {
      result.filters = this.filters.serialize();
    }
    if (this.groupBy) {
      result.groupBy = this.groupBy.serialize();
    }
    if (this.sort) {
      result.sort = this.sort.map(s => s.serialize());
    }
    if (this.propertyOrder) {
      result.propertyOrder = this.propertyOrder.map(p => p.serialize());
    }

    return result;
  }
}