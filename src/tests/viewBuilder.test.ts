// baseViewBuilder.test.ts

import { describe, it, expect } from 'vitest';
import { BaseViewBuilder } from 'views/viewConfigBuilder';
import { ViewConfig } from 'views/viewConfig';
import { ViewConfigOptions } from 'views/viewConfigOptions';
import { FilterGroup } from 'primitives/filter';
import { Property } from 'primitives/property';
import { PropertyOrder } from 'primitives/propertyOrder';

// ─── Test Doubles ─────────────────────────────────────────────────────────────

/**
 * Minimal concrete subclass of ViewConfig used to exercise the abstract base.
 * Not a real view type — exists only to make ViewConfig instantiable in tests.
 */
class StubViewConfig extends ViewConfig {
  constructor(options: ViewConfigOptions) {
    super(options);
  }
}

/**
 * Minimal concrete builder used to exercise BaseViewBuilder.
 * Not a real builder — exists only to make BaseViewBuilder instantiable in tests.
 */
class StubViewBuilder extends BaseViewBuilder<StubViewConfig> {
  protected buildInternal(): StubViewConfig {
    return new StubViewConfig(this.options as ViewConfigOptions);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildView(name = 'test'): StubViewConfig {
  return new StubViewBuilder().setName(name).build();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BaseViewBuilder', () => {

  // ── constructor() ───────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates a builder with no existing config', () => {
      expect(() => new StubViewBuilder()).not.toThrow();
    });

    it('initializes options from an existing config', () => {
      const existing = new StubViewConfig({ name: 'original' } as ViewConfigOptions);
      const config = new StubViewBuilder(existing).setName('original').build();
      expect(config.options.name).toBe('original');
    });

    it('shallow-copies options from the existing config', () => {
      const existing = new StubViewConfig({ name: 'original' } as ViewConfigOptions);
      const config = new StubViewBuilder(existing).setName('modified').build();
      expect(existing.options.name).toBe('original');
    });
  });

  // ── setName() ───────────────────────────────────────────────────────────────

  describe('setName()', () => {
    it('sets the view name', () => {
      const config = new StubViewBuilder().setName('my view').build();
      expect(config.options.name).toBe('my view');
    });

    it('returns the builder instance for chaining', () => {
      const builder = new StubViewBuilder();
      expect(builder.setName('test')).toBe(builder);
    });
  });

  // ── setFilter() ─────────────────────────────────────────────────────────────

  describe('setFilter()', () => {
    it('sets the filter group', () => {
      const filters = new FilterGroup('and', []);
      const config = new StubViewBuilder().setName('test').setFilter(filters).build();
      expect(config.options.filters).toBe(filters);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new StubViewBuilder();
      expect(builder.setFilter(new FilterGroup('and', []))).toBe(builder);
    });
  });

  // ── setGroupBy() ────────────────────────────────────────────────────────────

  describe('setGroupBy()', () => {
    it('sets the group-by property order', () => {
      const groupBy = PropertyOrder.deserialize({ property: 'note.status', direction: 'ASC' });
      const config = new StubViewBuilder().setName('test').setGroupBy(groupBy).build();
      expect(config.options.groupBy).toBe(groupBy);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new StubViewBuilder();
      expect(builder.setGroupBy(PropertyOrder.deserialize({ property: 'note.status', direction: 'ASC' }))).toBe(builder);
    });
  });

  // ── setSort() ───────────────────────────────────────────────────────────────

  describe('setSort()', () => {
    it('sets the sort rules', () => {
      const sort = [PropertyOrder.deserialize({ property: 'note.title', direction: 'ASC' })];
      const config = new StubViewBuilder().setName('test').setSort(sort).build();
      expect(config.options.sort).toBe(sort);
    });

    it('accepts an empty sort array', () => {
      const config = new StubViewBuilder().setName('test').setSort([]).build();
      expect(config.options.sort).toEqual([]);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new StubViewBuilder();
      expect(builder.setSort([])).toBe(builder);
    });
  });

  // ── setPropertyOrder() ──────────────────────────────────────────────────────

  describe('setPropertyOrder()', () => {
    it('sets the property display order', () => {
      const propertyOrder = [Property.deserialize('note.title'), Property.deserialize('note.status')];
      const config = new StubViewBuilder().setName('test').setPropertyOrder(propertyOrder).build();
      expect(config.options.propertyOrder).toBe(propertyOrder);
    });

    it('accepts an empty property order array', () => {
      const config = new StubViewBuilder().setName('test').setPropertyOrder([]).build();
      expect(config.options.propertyOrder).toEqual([]);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new StubViewBuilder();
      expect(builder.setPropertyOrder([])).toBe(builder);
    });
  });

  // ── validate() ──────────────────────────────────────────────────────────────

  describe('validate()', () => {
    it('throws if name is not set', () => {
      expect(() => new StubViewBuilder().build()).toThrow('View name cannot be empty');
    });

    it('throws if name is an empty string', () => {
      expect(() => new StubViewBuilder().setName('').build()).toThrow('View name cannot be empty');
    });

    it('throws if name is only whitespace', () => {
      expect(() => new StubViewBuilder().setName('   ').build()).toThrow('View name cannot be empty');
    });

    it('does not throw for a valid name', () => {
      expect(() => new StubViewBuilder().setName('valid').build()).not.toThrow();
    });
  });

  // ── build() ─────────────────────────────────────────────────────────────────

  describe('build()', () => {
    it('returns a ViewConfig instance', () => {
      expect(buildView()).toBeInstanceOf(StubViewConfig);
    });

    it('reflects all accumulated options in the built config', () => {
      const filters = new FilterGroup('and', []);
      const sort = [PropertyOrder.deserialize({ property: 'note.title', direction: 'ASC' })];
      const propertyOrder = [Property.deserialize('note.title')];
      const groupBy = PropertyOrder.deserialize({ property: 'note.status', direction: 'DESC' });

      const config = new StubViewBuilder()
        .setName('full view')
        .setFilter(filters)
        .setSort(sort)
        .setPropertyOrder(propertyOrder)
        .setGroupBy(groupBy)
        .build();

      expect(config.options.name).toBe('full view');
      expect(config.options.filters).toBe(filters);
      expect(config.options.sort).toBe(sort);
      expect(config.options.propertyOrder).toBe(propertyOrder);
      expect(config.options.groupBy).toBe(groupBy);
    });
  });
});