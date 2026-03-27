// cardViewBuilder.test.ts

import { describe, it, expect } from 'vitest';
import { CardViewBuilder } from 'views/cardViewBuilder';
import { CardViewConfig } from 'views/cardViewConfig';
import { CardViewConfigOptions } from 'views/cardViewConfigOptions';
import { Property } from 'primitives/property';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CardViewBuilder', () => {

  // ── constructor() ───────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates a builder with no existing config', () => {
      expect(() => new CardViewBuilder()).not.toThrow();
    });

    it('initializes from an existing config', () => {
      const existing = new CardViewConfig({ name: 'view', cardSize: 300 });
      const config = new CardViewBuilder(existing).build() as CardViewConfig;
      expect(config.options.cardSize).toBe(300);
    });
  });

  // ── setCardSize() ───────────────────────────────────────────────────────────

  describe('setCardSize()', () => {
    it('sets the card size', () => {
      const config = new CardViewBuilder().setName('test').setCardSize(250).build() as CardViewConfig;
      expect(config.options.cardSize).toBe(250);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new CardViewBuilder();
      expect(builder.setCardSize(200)).toBe(builder);
    });
  });

  // ── setImage() ──────────────────────────────────────────────────────────────

  describe('setImage()', () => {
    it('sets the image property', () => {
      const image = new Property('thumbnail', 'note');
      const config = new CardViewBuilder().setName('test').setImage(image).build() as CardViewConfig;
      expect(config.options.image).toBe(image);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new CardViewBuilder();
      expect(builder.setImage(new Property('thumbnail'))).toBe(builder);
    });
  });

  // ── setImageFit() ───────────────────────────────────────────────────────────

  describe('setImageFit()', () => {
    it.each([['cover'], ['contain']] as const)(
      'sets image fit to "%s"',
      (fit) => {
        const config = new CardViewBuilder().setName('test').setImageFit(fit).build();
        expect(config.options.imageFit).toBe(fit);
      }
    );

    it('returns the builder instance for chaining', () => {
      const builder = new CardViewBuilder();
      expect(builder.setImageFit('cover')).toBe(builder);
    });
  });

  // ── setImageAspectRatio() ───────────────────────────────────────────────────

  describe('setImageAspectRatio()', () => {
    it('sets the image aspect ratio', () => {
      const config = new CardViewBuilder().setName('test').setImageAspectRatio(1.5).build();
      expect(config.options.imageAspectRatio).toBe(1.5);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new CardViewBuilder();
      expect(builder.setImageAspectRatio(1.5)).toBe(builder);
    });
  });

  // ── build() ─────────────────────────────────────────────────────────────────

  describe('build()', () => {
    it('returns a CardViewConfig instance', () => {
      expect(new CardViewBuilder().setName('test').build()).toBeInstanceOf(CardViewConfig);
    });

    it('reflects all accumulated options in the built config', () => {
      const image = new Property('thumbnail', 'note');
      const config = new CardViewBuilder()
        .setName('test')
        .setCardSize(300)
        .setImage(image)
        .setImageFit('cover')
        .setImageAspectRatio(1.5)
        .build();

      expect(config.options.cardSize).toBe(300);
      expect(config.options.image).toBe(image);
      expect(config.options.imageFit).toBe('cover');
      expect(config.options.imageAspectRatio).toBe(1.5);
    });
  });
});