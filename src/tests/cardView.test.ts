import { describe, it, expect } from 'vitest';
import { CardViewConfig } from 'views/cardViewConfig';
import { CardViewConfigOptions } from 'views/cardViewConfigOptions';
import { Property } from 'primitives/property';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'cards',
    name: 'Test Card View',
    ...overrides,
  };
}

function makeOptions(overrides: Partial<CardViewConfigOptions> = {}): CardViewConfigOptions {
  return {
    name: 'Test Card View',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CardViewConfig', () => {

  // ── type ────────────────────────────────────────────────────────────────────

  describe('type', () => {
    it('is "cards"', () => {
      expect(CardViewConfig.type).toBe('cards');
    });
  });

  // ── constructor() ────────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates an instance with a valid name', () => {
      const config = new CardViewConfig(makeOptions());
      expect(config).toBeInstanceOf(CardViewConfig);
    });

    it('throws if name is empty', () => {
      expect(() => new CardViewConfig(makeOptions({ name: '' }))).toThrow();
    });

    it('throws if name is whitespace only', () => {
      expect(() => new CardViewConfig(makeOptions({ name: '   ' }))).toThrow();
    });
  });

  // ── cardSize ─────────────────────────────────────────────────────────────────

  describe('cardSize', () => {
    it('exposes the value set in options', () => {
      const config = new CardViewConfig(makeOptions({ cardSize: 300 }));
      expect(config.cardSize).toBe(300);
    });

    it('exposes undefined when not set', () => {
      const config = new CardViewConfig(makeOptions());
      expect(config.cardSize).toBeUndefined();
    });

    it('serialize() includes cardSize when defined', () => {
      const config = new CardViewConfig(makeOptions({ cardSize: 250 }));
      expect(config.serialize()).toMatchObject({ cardSize: 250 });
    });

    it('serialize() omits cardSize when undefined', () => {
      const config = new CardViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('cardSize');
    });

    it('deserialize() restores cardSize correctly', () => {
      const config = CardViewConfig.deserialize(makeRaw({ cardSize: 320 }));
      expect(config.cardSize).toBe(320);
    });

    it('deserialize() leaves cardSize undefined when absent', () => {
      const config = CardViewConfig.deserialize(makeRaw());
      expect(config.cardSize).toBeUndefined();
    });
  });

  // ── image ────────────────────────────────────────────────────────────────────

  describe('image', () => {
    it('exposes the value set in options', () => {
      const image = new Property('thumbnail');
      const config = new CardViewConfig(makeOptions({ image }));
      expect(config.image).toBe(image);
    });

    it('exposes undefined when not set', () => {
      const config = new CardViewConfig(makeOptions());
      expect(config.image).toBeUndefined();
    });

    it('serialize() includes image when defined', () => {
      const image = new Property('thumbnail');
      const config = new CardViewConfig(makeOptions({ image }));
      expect(config.serialize().image).toEqual(image.serialize());
    });

    it('serialize() omits image when undefined', () => {
      const config = new CardViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('image');
    });

    it('deserialize() restores image correctly', () => {
      const config = CardViewConfig.deserialize(makeRaw({ image: 'thumbnail' }));
      expect(config.image).toBeInstanceOf(Property);
    });

    it('deserialize() leaves image undefined when absent', () => {
      const config = CardViewConfig.deserialize(makeRaw());
      expect(config.image).toBeUndefined();
    });
  });

  // ── imageFit ─────────────────────────────────────────────────────────────────

  describe('imageFit', () => {
    it.each([['contain'], ['cover']] as const)(
      'exposes "%s" when set in options',
      (imageFit) => {
        const config = new CardViewConfig(makeOptions({ imageFit }));
        expect(config.imageFit).toBe(imageFit);
      }
    );

    it('exposes undefined when not set', () => {
      const config = new CardViewConfig(makeOptions());
      expect(config.imageFit).toBeUndefined();
    });

    it.each([['contain'], ['cover']] as const)(
      'serialize() includes imageFit "%s" when defined',
      (imageFit) => {
        const config = new CardViewConfig(makeOptions({ imageFit }));
        expect(config.serialize()).toMatchObject({ imageFit });
      }
    );

    it('serialize() omits imageFit when undefined', () => {
      const config = new CardViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('imageFit');
    });

    it.each([['contain'], ['cover']] as const)(
      'deserialize() restores imageFit "%s" correctly',
      (imageFit) => {
        const config = CardViewConfig.deserialize(makeRaw({ imageFit }));
        expect(config.imageFit).toBe(imageFit);
      }
    );

    it('deserialize() leaves imageFit undefined when absent', () => {
      const config = CardViewConfig.deserialize(makeRaw());
      expect(config.imageFit).toBeUndefined();
    });

    it('deserialize() throws on an invalid imageFit type', () => {
      expect(() =>
        CardViewConfig.deserialize(makeRaw({ imageFit: 'invalid' }))
      ).toThrow(/expected one of/i);
    });
  });

  // ── imageAspectRatio ──────────────────────────────────────────────────────────

  describe('imageAspectRatio', () => {
    it('exposes the value set in options', () => {
      const config = new CardViewConfig(makeOptions({ imageAspectRatio: 1.5 }));
      expect(config.imageAspectRatio).toBe(1.5);
    });

    it('exposes undefined when not set', () => {
      const config = new CardViewConfig(makeOptions());
      expect(config.imageAspectRatio).toBeUndefined();
    });

    it('serialize() includes imageAspectRatio when defined', () => {
      const config = new CardViewConfig(makeOptions({ imageAspectRatio: 1.78 }));
      expect(config.serialize()).toMatchObject({ imageAspectRatio: 1.78 });
    });

    it('serialize() omits imageAspectRatio when undefined', () => {
      const config = new CardViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('imageAspectRatio');
    });

    it('deserialize() restores imageAspectRatio correctly', () => {
      const config = CardViewConfig.deserialize(makeRaw({ imageAspectRatio: 1.5 }));
      expect(config.imageAspectRatio).toBe(1.5);
    });

    it('deserialize() leaves imageAspectRatio undefined when absent', () => {
      const config = CardViewConfig.deserialize(makeRaw());
      expect(config.imageAspectRatio).toBeUndefined();
    });
  });

  // ── deserialize() ────────────────────────────────────────────────────────────

  describe('deserialize()', () => {
    it('deserializes a minimal raw object', () => {
      const config = CardViewConfig.deserialize(makeRaw());
      expect(config).toBeInstanceOf(CardViewConfig);
      expect(config.name).toBe('Test Card View');
    });

    it('throws if name is missing', () => {
      expect(() =>
        CardViewConfig.deserialize({ type: 'cards' })
      ).toThrow();
    });

    it('leaves all optional fields undefined when absent', () => {
      const config = CardViewConfig.deserialize(makeRaw());
      expect(config.cardSize).toBeUndefined();
      expect(config.image).toBeUndefined();
      expect(config.imageFit).toBeUndefined();
      expect(config.imageAspectRatio).toBeUndefined();
    });
  });

  // ── Round-trip ───────────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('deserialize → serialize preserves all fields', () => {
      const raw = makeRaw({
        cardSize: 300,
        image: 'note.thumbnail',
        imageFit: 'cover',
        imageAspectRatio: 1.5,
      });

      const config = CardViewConfig.deserialize(raw);
      expect(config.serialize()).toEqual(raw);
    });

    it('deserialize → serialize preserves a minimal config', () => {
      const raw = makeRaw();
      const config = CardViewConfig.deserialize(raw);
      expect(config.serialize()).toEqual(raw);
    });

    it('serialize → deserialize preserves all fields', () => {
      const original = new CardViewConfig(makeOptions({
        cardSize: 300,
        image: new Property('thumbnail'),
        imageFit: 'cover',
        imageAspectRatio: 1.5,
      }));

      const restored = CardViewConfig.deserialize(original.serialize());

      expect(restored.name).toBe(original.name);
      expect(restored.cardSize).toBe(original.cardSize);
      expect(restored.imageFit).toBe(original.imageFit);
      expect(restored.imageAspectRatio).toBe(original.imageAspectRatio);
      expect(restored.image?.equals(original.image!)).toBe(true);
    });
  });
});