import { Property } from 'primitives/property';
import { CardViewConfigOptions } from './cardViewConfigOptions';
import { CardViewConfig } from './cardViewConfig';
import { BaseViewBuilder } from './viewConfigBuilder';

// ─── Card View Builder ───────────────────────────────────────────────────────

/**
 * Builder for {@link CardViewConfig} instances.
 * Extends {@link BaseViewBuilder} with card-specific setter methods.
 */
export class CardViewBuilder extends BaseViewBuilder<CardViewConfigOptions> {

  // ── Attributes

  /** Narrows the inherited {@link BaseViewBuilder.options} to {@link CardViewConfigOptions}. */
  protected declare options: CardViewConfigOptions;

  // ── Constructor

  /**
   * Creates a new {@link CardViewBuilder} instance.
   *
   * @param existing - Optional existing card view configuration to initialize from.
   */
  constructor(existing?: CardViewConfigOptions) {
    super(existing);
  }

  // ── Mutators

  /**
   * Sets the size value controlling the width of each card.
   *
   * @param cardSize - The card width value.
   * @returns The builder instance for chaining.
   */
  setCardSize(cardSize: number): this {
    this.options.cardSize = cardSize;
    return this;
  }

  /**
   * Sets the property whose value is used as the card image.
   *
   * @param image - The image property.
   * @returns The builder instance for chaining.
   */
  setImage(image: Property): this {
    this.options.image = image;
    return this;
  }

  /**
   * Sets how the image is fitted within the card.
   *
   * @param imageFit - The image fit type.
   * @returns The builder instance for chaining.
   */
  setImageFit(imageFit: CardViewConfigOptions.ImageFitType): this {
    this.options.imageFit = imageFit;
    return this;
  }

  /**
   * Sets the aspect ratio for the card image.
   *
   * @param imageAspectRatio - The aspect ratio (e.g. `1.5` for 3:2).
   * @returns The builder instance for chaining.
   */
  setImageAspectRatio(imageAspectRatio: number): this {
    this.options.imageAspectRatio = imageAspectRatio;
    return this;
  }

  // ── Build

  /**
   * Builds and returns a {@link CardViewConfig} from the accumulated options.
   *
   * @returns The constructed {@link CardViewConfig}.
   */
  protected buildInternal(): CardViewConfig {
    return new CardViewConfig(this.options as CardViewConfigOptions);
  }
}