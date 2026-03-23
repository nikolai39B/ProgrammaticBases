import { Property } from './property';
import { CardViewConfigOptions } from './cardViewConfigOptions';
import { ViewConfigVisitor } from './viewConfigVisitor';
import { ViewType } from './viewType';
import { ViewConfig } from './viewConfig';

// ─── Card View ────────────────────────────────────────────────────────────────

/**
 * Represents the configuration for a card layout view.
 * Extends {@link ViewConfig} with card-specific options such as
 * card size, image property, image fit, and aspect ratio.
 */
export class CardViewConfig extends ViewConfig {

  // ── Attributes

  /** Identifies this class as the handler for the `'cards'` view type. */
  static readonly type = 'cards' as const satisfies ViewType;

  /** Narrows the inherited {@link ViewConfig.options} to {@link CardViewConfigOptions}. */
  protected declare options: CardViewConfigOptions;

  // ── Constructor

  /**
   * Creates a new {@link CardViewConfig} instance.
   *
   * @param options - The card view configuration options.
   * @throws {Error} If `options.name` is empty or contains only whitespace.
   */
  constructor(options: CardViewConfigOptions) {
    super(options);
  }

  // ── Accessors

  /** An optional size value controlling the width of each card. */
  get cardSize(): number | undefined { return this.options.cardSize; }

  /** An optional property whose value is used as the card image. */
  get image(): Property | undefined { return this.options.image; }

  /** An optional setting controlling how the image is fitted within the card. */
  get imageFit(): CardViewConfigOptions.ImageFitType | undefined { return this.options.imageFit; }

  /** An optional aspect ratio for the card image (e.g. `1.5` for 3:2). */
  get imageAspectRatio(): number | undefined { return this.options.imageAspectRatio; }

  // ── Serialization

  /**
   * Serializes this card view configuration to a plain object.
   * Extends the base serialization with card-specific fields.
   * Only fields that are defined are included in the output.
   *
   * @returns A plain object representing this card view configuration.
   */
  serialize(): Record<string, unknown> {
    const result = super.serialize();

    if (this.cardSize != null) {
      result.cardSize = this.cardSize;
    }
    if (this.image) {
      result.image = this.image.serialize();
    }
    if (this.imageFit) {
      result.imageFit = this.imageFit;
    }
    if (this.imageAspectRatio != null) {
      result.imageAspectRatio = this.imageAspectRatio;
    }

    return result;
  }

  /**
   * Deserializes a raw plain object into a {@link CardViewConfig} instance.
   *
   * @param raw - The raw object to deserialize parsed from YAML.
   * @returns A fully constructed {@link CardViewConfig} instance.
   */
  static deserialize(raw: Record<string, unknown>): CardViewConfig {
    // TODO: implement
    throw new Error('Not implemented');
  }

  // ── Visitor

  /**
   * Accepts a visitor and dispatches to {@link ViewConfigVisitor.visitCard}.
   *
   * @param visitor - The visitor to accept.
   * @returns The value produced by the visitor.
   */
  accept<R>(visitor: ViewConfigVisitor<R>): R {
    return visitor.visitCard(this);
  }
}