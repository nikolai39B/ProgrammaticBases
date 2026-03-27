import { describe, it, expect } from 'vitest';
import { ViewConfig } from 'views/viewConfig';
import { ViewConfigOptions } from 'views/viewConfigOptions';
import { FilterGroup } from 'primitives/filter';
import { Property } from 'primitives/property';
import { PropertyOrder } from 'primitives/propertyOrder';

// ─── Concrete Stub ────────────────────────────────────────────────────────────

/**
 * Minimal concrete subclass of ViewConfig used to exercise the abstract base.
 * Not a real view type — exists only to make ViewConfig instantiable in tests.
 */
class StubViewConfig extends ViewConfig {
  static readonly type = 'stub' as const;

  constructor(options: ViewConfigOptions) {
    super(options);
  }

  serialize(): Record<string, unknown> {
    return super.serialize();
  }

  static deserialize(raw: Record<string, unknown>): StubViewConfig {
    const base = ViewConfig.deserialize(raw);
    return new StubViewConfig(base);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'stub',
    name: 'Test View',
    ...overrides,
  };
}

function makeOptions(overrides: Partial<ViewConfigOptions> = {}): ViewConfigOptions {
  return {
    name: 'Test View',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ViewConfig', () => {

  // ── constructor() ────────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates an instance with a valid name', () => {
      const config = new StubViewConfig(makeOptions());
      expect(config).toBeInstanceOf(ViewConfig);
    });

    it('throws if name is empty', () => {
      expect(() => new StubViewConfig(makeOptions({ name: '' }))).toThrow();
    });

    it('throws if name is whitespace only', () => {
      expect(() => new StubViewConfig(makeOptions({ name: '   ' }))).toThrow();
    });
  });

  // ── type ─────────────────────────────────────────────────────────────────────

  describe('type', () => {
    it('reflects the static type of the subclass', () => {
      const config = new StubViewConfig(makeOptions());
      expect(config.type).toBe('stub');
    });
  });

  // ── name ─────────────────────────────────────────────────────────────────────

  describe('name', () => {
    it('exposes the value set in options', () => {
      const config = new StubViewConfig(makeOptions({ name: 'My View' }));
      expect(config.name).toBe('My View');
    });
  });

  // ── filters ──────────────────────────────────────────────────────────────────

  describe('filters', () => {
    it('exposes the value set in options', () => {
      const filters = new FilterGroup('and', []);
      const config = new StubViewConfig(makeOptions({ filters }));
      expect(config.filters).toBe(filters);
    });

    it('exposes undefined when not set', () => {
      const config = new StubViewConfig(makeOptions());
      expect(config.filters).toBeUndefined();
    });
  });

  // ── groupBy ──────────────────────────────────────────────────────────────────

  describe('groupBy', () => {
    it('exposes the value set in options', () => {
      const groupBy = PropertyOrder.deserialize({ property: 'note.status', direction: 'ASC' });
      const config = new StubViewConfig(makeOptions({ groupBy }));
      expect(config.groupBy).toBe(groupBy);
    });

    it('exposes undefined when not set', () => {
      const config = new StubViewConfig(makeOptions());
      expect(config.groupBy).toBeUndefined();
    });
  });

  // ── sort ─────────────────────────────────────────────────────────────────────

  describe('sort', () => {
    it('exposes the value set in options', () => {
      const sort = [
        PropertyOrder.deserialize({ property: 'note.title', direction: 'ASC' }),
        PropertyOrder.deserialize({ property: 'note.status', direction: 'DESC' }),
      ];
      const config = new StubViewConfig(makeOptions({ sort }));
      expect(config.sort).toBe(sort);
    });

    it('exposes undefined when not set', () => {
      const config = new StubViewConfig(makeOptions());
      expect(config.sort).toBeUndefined();
    });
  });

  // ── propertyOrder ─────────────────────────────────────────────────────────────

  describe('propertyOrder', () => {
    it('exposes the value set in options', () => {
      const propertyOrder = [
        Property.deserialize('note.title'),
        Property.deserialize('note.status'),
      ];
      const config = new StubViewConfig(makeOptions({ propertyOrder }));
      expect(config.propertyOrder).toBe(propertyOrder);
    });

    it('exposes undefined when not set', () => {
      const config = new StubViewConfig(makeOptions());
      expect(config.propertyOrder).toBeUndefined();
    });
  });

  // ── serialize() ──────────────────────────────────────────────────────────────

  describe('serialize()', () => {
    it('includes type and name', () => {
      const config = new StubViewConfig(makeOptions());
      const result = config.serialize();
      expect(result.type).toBe('stub');
      expect(result.name).toBe('Test View');
    });

    it('includes filters when defined', () => {
      const filters = new FilterGroup('and', []);
      const config = new StubViewConfig(makeOptions({ filters }));
      expect(config.serialize()).toHaveProperty('filters');
    });

    it('omits filters when undefined', () => {
      const config = new StubViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('filters');
    });

    it('includes groupBy when defined', () => {
      const groupBy = PropertyOrder.deserialize({ property: 'note.status', direction: 'ASC' });
      const config = new StubViewConfig(makeOptions({ groupBy }));
      expect(config.serialize()).toHaveProperty('groupBy');
    });

    it('omits groupBy when undefined', () => {
      const config = new StubViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('groupBy');
    });

    it('includes sort when defined', () => {
      const sort = [PropertyOrder.deserialize({ property: 'note.title', direction: 'ASC' })];
      const config = new StubViewConfig(makeOptions({ sort }));
      expect(config.serialize()).toHaveProperty('sort');
    });

    it('omits sort when undefined', () => {
      const config = new StubViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('sort');
    });

    it('serializes propertyOrder under the "order" key when defined', () => {
      const propertyOrder = [Property.deserialize('note.title')];
      const config = new StubViewConfig(makeOptions({ propertyOrder }));
      expect(config.serialize()).toHaveProperty('order');
    });

    it('omits order when propertyOrder is undefined', () => {
      const config = new StubViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('order');
    });

    it('serializes sort as an array', () => {
      const sort = [
        PropertyOrder.deserialize({ property: 'note.title', direction: 'ASC' }),
        PropertyOrder.deserialize({ property: 'note.status', direction: 'DESC' }),
      ];
      const config = new StubViewConfig(makeOptions({ sort }));
      const result = config.serialize();
      expect(Array.isArray(result.sort)).toBe(true);
      expect((result.sort as unknown[]).length).toBe(2);
    });

    it('serializes propertyOrder as an array under "order"', () => {
      const propertyOrder = [
        Property.deserialize('note.title'),
        Property.deserialize('note.status'),
      ];
      const config = new StubViewConfig(makeOptions({ propertyOrder }));
      const result = config.serialize();
      expect(Array.isArray(result.order)).toBe(true);
      expect((result.order as unknown[]).length).toBe(2);
    });
  });

  // ── deserialize() ────────────────────────────────────────────────────────────

  describe('deserialize()', () => {
    it('deserializes a minimal raw object', () => {
      const config = StubViewConfig.deserialize(makeRaw());
      expect(config).toBeInstanceOf(StubViewConfig);
      expect(config.name).toBe('Test View');
    });

    it('deserializes filters when present', () => {
      const config = StubViewConfig.deserialize(
        makeRaw({ filters: { and: [] } })
      );
      expect(config.filters).toBeInstanceOf(FilterGroup);
    });

    it('leaves filters undefined when absent', () => {
      const config = StubViewConfig.deserialize(makeRaw());
      expect(config.filters).toBeUndefined();
    });

    it('deserializes groupBy when present', () => {
      const config = StubViewConfig.deserialize(
        makeRaw({ groupBy: { property: 'note.status', direction: 'ASC' } })
      );
      expect(config.groupBy).toBeInstanceOf(PropertyOrder);
    });

    it('leaves groupBy undefined when absent', () => {
      const config = StubViewConfig.deserialize(makeRaw());
      expect(config.groupBy).toBeUndefined();
    });

    it('deserializes sort when present', () => {
      const config = StubViewConfig.deserialize(
        makeRaw({ sort: [{ property: 'note.title', direction: 'ASC' }] })
      );
      expect(Array.isArray(config.sort)).toBe(true);
      expect(config.sort![0]).toBeInstanceOf(PropertyOrder);
    });

    it('leaves sort undefined when absent', () => {
      const config = StubViewConfig.deserialize(makeRaw());
      expect(config.sort).toBeUndefined();
    });

    it('deserializes propertyOrder from the "order" key when present', () => {
      const config = StubViewConfig.deserialize(
        makeRaw({ order: ['note.title', 'note.status'] })
      );
      expect(Array.isArray(config.propertyOrder)).toBe(true);
      expect(config.propertyOrder![0]).toBeInstanceOf(Property);
    });

    it('leaves propertyOrder undefined when absent', () => {
      const config = StubViewConfig.deserialize(makeRaw());
      expect(config.propertyOrder).toBeUndefined();
    });

    it('leaves all optional fields undefined when absent', () => {
      const config = StubViewConfig.deserialize(makeRaw());
      expect(config.filters).toBeUndefined();
      expect(config.groupBy).toBeUndefined();
      expect(config.sort).toBeUndefined();
      expect(config.propertyOrder).toBeUndefined();
    });
  });

  // ── Round-trip ───────────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('deserialize → serialize preserves all fields', () => {
      const raw = makeRaw({
        filters: { and: [] },
        groupBy: { property: 'note.status', direction: 'ASC' },
        sort: [{ property: 'note.title', direction: 'ASC' }],
        order: ['note.title', 'note.status'],
      });

      const config = StubViewConfig.deserialize(raw);
      expect(config.serialize()).toEqual(raw);
    });

    it('deserialize → serialize preserves a minimal config', () => {
      const raw = makeRaw();
      const config = StubViewConfig.deserialize(raw);
      expect(config.serialize()).toEqual(raw);
    });

    it('serialize → deserialize preserves all fields', () => {
      const original = new StubViewConfig(makeOptions({
        filters: new FilterGroup('and', []),
        groupBy: PropertyOrder.deserialize({ property: 'note.status', direction: 'ASC' }),
        sort: [PropertyOrder.deserialize({ property: 'note.title', direction: 'ASC' })],
        propertyOrder: [Property.deserialize('note.title'), Property.deserialize('note.status')],
      }));

      const restored = StubViewConfig.deserialize(original.serialize());

      expect(restored.name).toBe(original.name);
      expect(restored.filters).toEqual(original.filters);
      expect(restored.groupBy).toEqual(original.groupBy);
      expect(restored.sort).toEqual(original.sort);
      expect(restored.propertyOrder).toEqual(original.propertyOrder);
    });
  });
});