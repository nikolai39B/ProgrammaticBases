import { describe, it, expect } from 'vitest';
import { ListViewConfig } from 'views/listViewConfig';
import { ListViewConfigOptions } from 'views/listViewConfigOptions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'Test List View',
    type: 'list',
    ...overrides,
  };
}

function makeOptions(overrides: Partial<ListViewConfigOptions> = {}): ListViewConfigOptions {
  return {
    name: 'Test List View',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ListViewConfig', () => {

  // ── type ────────────────────────────────────────────────────────────────────

  describe('type', () => {
    it('is "list"', () => {
      expect(ListViewConfig.type).toBe('list');
    });
  });

  // ── constructor() ────────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates an instance with a valid name', () => {
      const config = new ListViewConfig(makeOptions());
      expect(config).toBeInstanceOf(ListViewConfig);
    });

    it('throws if name is empty', () => {
      expect(() => new ListViewConfig(makeOptions({ name: '' }))).toThrow();
    });

    it('throws if name is whitespace only', () => {
      expect(() => new ListViewConfig(makeOptions({ name: '   ' }))).toThrow();
    });
  });

  // ── indentProperties ────────────────────────────────────────────────────────

  describe('indentProperties', () => {
    it('exposes the value set in options', () => {
      const config = new ListViewConfig(makeOptions({ indentProperties: true }));
      expect(config.indentProperties).toBe(true);
    });

    it('exposes undefined when not set', () => {
      const config = new ListViewConfig(makeOptions());
      expect(config.indentProperties).toBeUndefined();
    });

    it('serialize() includes indentProperties when defined', () => {
      const config = new ListViewConfig(makeOptions({ indentProperties: false }));
      expect(config.serialize()).toMatchObject({ indentProperties: false });
    });

    it('serialize() omits indentProperties when undefined', () => {
      const config = new ListViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('indentProperties');
    });

    it('deserialize() restores indentProperties correctly', () => {
      const config = ListViewConfig.deserialize(makeRaw({ indentProperties: true }));
      expect(config.indentProperties).toBe(true);
    });

    it('deserialize() leaves indentProperties undefined when absent', () => {
      const config = ListViewConfig.deserialize(makeRaw());
      expect(config.indentProperties).toBeUndefined();
    });
  });

  // ── markers ─────────────────────────────────────────────────────────────────

  describe('markers', () => {
    it.each([['number'], ['bullet'], ['none']] as const)(
      'exposes "%s" when set in options',
      (marker) => {
        const config = new ListViewConfig(makeOptions({ markers: marker }));
        expect(config.markers).toBe(marker);
      }
    );

    it('exposes undefined when not set', () => {
      const config = new ListViewConfig(makeOptions());
      expect(config.markers).toBeUndefined();
    });

    it.each([['number'], ['bullet'], ['none']] as const)(
      'serialize() includes markers "%s" when defined',
      (marker) => {
        const config = new ListViewConfig(makeOptions({ markers: marker }));
        expect(config.serialize()).toMatchObject({ markers: marker });
      }
    );

    it('serialize() omits markers when undefined', () => {
      const config = new ListViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('markers');
    });

    it.each([['number'], ['bullet'], ['none']] as const)(
      'deserialize() restores markers "%s" correctly',
      (marker) => {
        const config = ListViewConfig.deserialize(makeRaw({ markers: marker }));
        expect(config.markers).toBe(marker);
      }
    );

    it('deserialize() leaves markers undefined when absent', () => {
      const config = ListViewConfig.deserialize(makeRaw());
      expect(config.markers).toBeUndefined();
    });

    it('deserialize() throws on an invalid marker type', () => {
      expect(() =>
        ListViewConfig.deserialize(makeRaw({ markers: 'invalid' }))
      ).toThrow(/expected one of/i);
    });
  });

  // ── separator ───────────────────────────────────────────────────────────────

  describe('separator', () => {
    it('exposes the value set in options', () => {
      const config = new ListViewConfig(makeOptions({ separator: ' | ' }));
      expect(config.separator).toBe(' | ');
    });

    it('exposes undefined when not set', () => {
      const config = new ListViewConfig(makeOptions());
      expect(config.separator).toBeUndefined();
    });

    it('serialize() includes separator when defined', () => {
      const config = new ListViewConfig(makeOptions({ separator: ',' }));
      expect(config.serialize()).toMatchObject({ separator: ',' });
    });

    it('serialize() omits separator when undefined', () => {
      const config = new ListViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('separator');
    });

    it('deserialize() restores separator correctly', () => {
      const config = ListViewConfig.deserialize(makeRaw({ separator: ' | ' }));
      expect(config.separator).toBe(' | ');
    });

    it('deserialize() leaves separator undefined when absent', () => {
      const config = ListViewConfig.deserialize(makeRaw());
      expect(config.separator).toBeUndefined();
    });
  });

  // ── deserialize() ────────────────────────────────────────────────────────────

  describe('deserialize()', () => {
    it('deserializes a minimal raw object', () => {
      const config = ListViewConfig.deserialize(makeRaw());
      expect(config).toBeInstanceOf(ListViewConfig);
      expect(config.name).toBe('Test List View');
    });

    it('throws if name is missing', () => {
      expect(() =>
        ListViewConfig.deserialize({ type: 'list' })
      ).toThrow();
    });
  });

  // ── Round-trip ───────────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('deserialize → serialize preserves all fields', () => {
      const raw = makeRaw({
        indentProperties: true,
        markers: 'bullet',
        separator: ' | ',
      });

      const config = ListViewConfig.deserialize(raw);
      expect(config.serialize()).toEqual(raw);
    });

    it('deserialize → serialize preserves a minimal config', () => {
      const raw = makeRaw();
      const config = ListViewConfig.deserialize(raw);
      expect(config.serialize()).toEqual(raw);
    });

    it('serialize → deserialize preserves all fields', () => {
      const original = new ListViewConfig(makeOptions({
        indentProperties: true,
        markers: 'bullet',
        separator: ' | ',
      }));

      const restored = ListViewConfig.deserialize(original.serialize());

      expect(restored.name).toBe(original.name);
      expect(restored.indentProperties).toBe(original.indentProperties);
      expect(restored.markers).toBe(original.markers);
      expect(restored.separator).toBe(original.separator);
    });
  });
});