import { Property } from 'primitives/property';
import { ViewConfigOptions } from './viewConfigOptions';

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * Options for configuring a card layout view.
 * Extends {@link ViewConfigOptions} with card-specific fields.
 */
export interface CardViewConfigOptions extends ViewConfigOptions {
  /** An optional size value controlling the width of each card. */
  cardSize?: number;

  /** An optional property whose value is used as the card image. */
  image?: Property;

  /** An optional setting controlling how the image is fitted within the card. */
  imageFit?: CardViewConfigOptions.ImageFitType;

  /** An optional aspect ratio for the card image (e.g. `1.5` for 3:2). */
  imageAspectRatio?: number;
}

export namespace CardViewConfigOptions {
  /**
   * Controls how the image is fitted within a card.
   * - `'contain'` — the image is scaled to fit within the card bounds
   * - `'cover'` — the image is scaled to fill the card, cropping if necessary
   */
  export type ImageFitType = 'contain' | 'cover';
}