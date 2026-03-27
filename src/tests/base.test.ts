// base.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseConfig } from 'bases/baseConfig';
import { ViewConfig } from 'views/viewConfig';
import { ViewRegistry } from 'views/viewRegistry';
import { FilterGroup } from 'primitives/filter';
import { Formula } from 'primitives/formula';
import { PropertyDisplay } from 'primitives/propertyDisplay';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeViewConfig(serialized: Record<string, unknown> = {}): ViewConfig {
  return {
    type: 'table',
    serialize: vi.fn().mockReturnValue({ type: 'table', ...serialized }),
  } as unknown as ViewConfig;
}

function makeViewRegistry(deserializedView?: ViewConfig): ViewRegistry {
  const registry = {
    deserialize: vi.fn().mockReturnValue(deserializedView ?? makeViewConfig()),
  } as unknown as ViewRegistry;
  return registry;
}

function makeFilterGroup(): FilterGroup {
  return {
    serialize: vi.fn().mockReturnValue({ operator: 'and', filters: [] }),
  } as unknown as FilterGroup;
}

function makeFormula(name: string): Formula {
  return {
    serialize: vi.fn().mockReturnValue({ [name]: 'some-expression' }),
  } as unknown as Formula;
}

function makePropertyDisplay(name: string): PropertyDisplay {
  return {
    serialize: vi.fn().mockReturnValue({ [name]: 'Display Name' }),
  } as unknown as PropertyDisplay;
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('BaseConfig constructor', () => {
  it('creates an instance with views and options', () => {
    const view = makeViewConfig();
    const config = new BaseConfig([view], {});

    expect(config.views).toEqual([view]);
    expect(config.options).toEqual({});
  });

  it('throws if no views are provided', () => {
    expect(() => new BaseConfig([], {})).toThrow('Base must have at least one view');
  });

  it('exposes filters from options', () => {
    const filters = makeFilterGroup();
    const config = new BaseConfig([makeViewConfig()], { filters });

    expect(config.filters).toBe(filters);
  });

  it('exposes formulas from options', () => {
    const formulas = [makeFormula('total')];
    const config = new BaseConfig([makeViewConfig()], { formulas });

    expect(config.formulas).toBe(formulas);
  });

  it('exposes properties from options', () => {
    const properties = [makePropertyDisplay('name')];
    const config = new BaseConfig([makeViewConfig()], { properties });

    expect(config.properties).toBe(properties);
  });

  it('returns undefined for filters when not provided', () => {
    const config = new BaseConfig([makeViewConfig()], {});
    expect(config.filters).toBeUndefined();
  });

  it('returns undefined for formulas when not provided', () => {
    const config = new BaseConfig([makeViewConfig()], {});
    expect(config.formulas).toBeUndefined();
  });

  it('returns undefined for properties when not provided', () => {
    const config = new BaseConfig([makeViewConfig()], {});
    expect(config.properties).toBeUndefined();
  });
});

// ─── serialize ────────────────────────────────────────────────────────────────

describe('BaseConfig.serialize', () => {
  it('serializes views', () => {
    const view = makeViewConfig();
    const config = new BaseConfig([view], {});
    const result = config.serialize();

    expect(view.serialize).toHaveBeenCalled();
    expect(result.views).toEqual([{ type: 'table' }]);
  });

  it('serializes multiple views', () => {
    const view1 = makeViewConfig({ name: 'View 1' });
    const view2 = makeViewConfig({ name: 'View 2' });
    const config = new BaseConfig([view1, view2], {});
    const result = config.serialize();

    expect(result.views).toEqual([
      { type: 'table', name: 'View 1' },
      { type: 'table', name: 'View 2' },
    ]);
  });

  it('serializes filters when present', () => {
    const filters = makeFilterGroup();
    const config = new BaseConfig([makeViewConfig()], { filters });
    const result = config.serialize();

    expect(filters.serialize).toHaveBeenCalled();
    expect(result.filters).toEqual({ operator: 'and', filters: [] });
  });

  it('omits filters when not present', () => {
    const config = new BaseConfig([makeViewConfig()], {});
    const result = config.serialize();

    expect(result).not.toHaveProperty('filters');
  });

  it('serializes formulas when present', () => {
    const formula = makeFormula('total');
    const config = new BaseConfig([makeViewConfig()], { formulas: [formula] });
    const result = config.serialize();

    expect(formula.serialize).toHaveBeenCalled();
    expect(result.formulas).toEqual({ total: 'some-expression' });
  });

  it('omits formulas when not present', () => {
    const config = new BaseConfig([makeViewConfig()], {});
    const result = config.serialize();

    expect(result).not.toHaveProperty('formulas');
  });

  it('omits formulas when array is empty', () => {
    const config = new BaseConfig([makeViewConfig()], { formulas: [] });
    const result = config.serialize();

    expect(result).not.toHaveProperty('formulas');
  });

  it('serializes properties when present', () => {
    const property = makePropertyDisplay('name');
    const config = new BaseConfig([makeViewConfig()], { properties: [property] });
    const result = config.serialize();

    expect(property.serialize).toHaveBeenCalled();
    expect(result.properties).toEqual({ name: 'Display Name' });
  });

  it('omits properties when not present', () => {
    const config = new BaseConfig([makeViewConfig()], {});
    const result = config.serialize();

    expect(result).not.toHaveProperty('properties');
  });

  it('omits properties when array is empty', () => {
    const config = new BaseConfig([makeViewConfig()], { properties: [] });
    const result = config.serialize();

    expect(result).not.toHaveProperty('properties');
  });

  it('serializes all fields together', () => {
    const view = makeViewConfig();
    const filters = makeFilterGroup();
    const formula = makeFormula('total');
    const property = makePropertyDisplay('name');

    const config = new BaseConfig([view], {
      filters,
      formulas: [formula],
      properties: [property],
    });

    const result = config.serialize();

    expect(result).toEqual({
      views: [{ type: 'table' }],
      filters: { operator: 'and', filters: [] },
      formulas: { total: 'some-expression' },
      properties: { name: 'Display Name' },
    });
  });
});

// ─── deserialize ──────────────────────────────────────────────────────────────

describe('BaseConfig.deserialize', () => {
  it('deserializes views using the registry', () => {
    const deserializedView = makeViewConfig();
    const registry = makeViewRegistry(deserializedView);

    const raw = {
      views: [{ type: 'table' }],
    };

    const config = BaseConfig.deserialize(raw, registry);

    expect(registry.deserialize).toHaveBeenCalledWith({ type: 'table' });
    expect(config.views).toEqual([deserializedView]);
  });

  it('deserializes filters when present', () => {
    const registry = makeViewRegistry();

    const raw = {
      views: [{ type: 'table' }],
      filters: { operator: 'and', filters: [] },
    };

    vi.spyOn(FilterGroup, 'deserialize').mockReturnValue(makeFilterGroup());

    const config = BaseConfig.deserialize(raw, registry);

    expect(FilterGroup.deserialize).toHaveBeenCalledWith({ operator: 'and', filters: [] });
    expect(config.filters).toBeDefined();
  });

  it('leaves filters undefined when not present', () => {
    const registry = makeViewRegistry();
    const raw = { views: [{ type: 'table' }] };

    const config = BaseConfig.deserialize(raw, registry);

    expect(config.filters).toBeUndefined();
  });

  it('deserializes formulas when present', () => {
    const registry = makeViewRegistry();

    const raw = {
      views: [{ type: 'table' }],
      formulas: { total: 'some-expression' },
    };

    vi.spyOn(Formula, 'deserialize').mockReturnValue(makeFormula('total'));

    const config = BaseConfig.deserialize(raw, registry);

    expect(Formula.deserialize).toHaveBeenCalledWith({ total: 'some-expression' });
    expect(config.formulas).toHaveLength(1);
  });

  it('leaves formulas undefined when not present', () => {
    const registry = makeViewRegistry();
    const raw = { views: [{ type: 'table' }] };

    const config = BaseConfig.deserialize(raw, registry);

    expect(config.formulas).toBeUndefined();
  });

  it('deserializes properties when present', () => {
    const registry = makeViewRegistry();

    const raw = {
      views: [{ type: 'table' }],
      properties: { name: 'Display Name' },
    };

    vi.spyOn(PropertyDisplay, 'deserialize').mockReturnValue(makePropertyDisplay('name'));

    const config = BaseConfig.deserialize(raw, registry);

    expect(PropertyDisplay.deserialize).toHaveBeenCalledWith({ name: 'Display Name' });
    expect(config.properties).toHaveLength(1);
  });

  it('leaves properties undefined when not present', () => {
    const registry = makeViewRegistry();
    const raw = { views: [{ type: 'table' }] };

    const config = BaseConfig.deserialize(raw, registry);

    expect(config.properties).toBeUndefined();
  });

  it('deserializes all fields together', () => {
    const deserializedView = makeViewConfig();
    const registry = makeViewRegistry(deserializedView);

    vi.spyOn(FilterGroup, 'deserialize').mockReturnValue(makeFilterGroup());
    vi.spyOn(Formula, 'deserialize').mockReturnValue(makeFormula('total'));
    vi.spyOn(PropertyDisplay, 'deserialize').mockReturnValue(makePropertyDisplay('name'));

    const raw = {
      views: [{ type: 'table' }],
      filters: { operator: 'and', filters: [] },
      formulas: { total: 'some-expression' },
      properties: { name: 'Display Name' },
    };

    const config = BaseConfig.deserialize(raw, registry);

    expect(config.views).toEqual([deserializedView]);
    expect(config.filters).toBeDefined();
    expect(config.formulas).toHaveLength(1);
    expect(config.properties).toHaveLength(1);
  });
});

// ─── Round-trip ───────────────────────────────────────────────────────────────

describe('BaseConfig round-trip', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('survives a round-trip with views only', () => {
    const view = makeViewConfig();
    const original = new BaseConfig([view], {});
    const serialized = original.serialize();

    const registry = makeViewRegistry(view);
    const restored = BaseConfig.deserialize(serialized, registry);

    expect(restored.views).toEqual(original.views);
    expect(restored.filters).toBeUndefined();
    expect(restored.formulas).toBeUndefined();
    expect(restored.properties).toBeUndefined();
  });

  it('survives a round-trip with all fields', () => {
    const view = makeViewConfig();
    const filters = makeFilterGroup();
    const formula = makeFormula('total');
    const property = makePropertyDisplay('name');

    const original = new BaseConfig([view], {
      filters,
      formulas: [formula],
      properties: [property],
    });

    const serialized = original.serialize();

    // Wire static deserializers to return the same instances
    vi.spyOn(FilterGroup, 'deserialize').mockReturnValue(filters);
    vi.spyOn(Formula, 'deserialize').mockReturnValue(formula);
    vi.spyOn(PropertyDisplay, 'deserialize').mockReturnValue(property);

    const registry = makeViewRegistry(view);
    const restored = BaseConfig.deserialize(serialized, registry);

    expect(restored.views).toEqual(original.views);
    expect(restored.filters).toBe(filters);
    expect(restored.formulas).toEqual([formula]);
    expect(restored.properties).toEqual([property]);
  });

  it('serializes a restored instance identically to the original', () => {
    const view = makeViewConfig();
    const filters = makeFilterGroup();
    const formula = makeFormula('total');
    const property = makePropertyDisplay('name');

    const original = new BaseConfig([view], {
      filters,
      formulas: [formula],
      properties: [property],
    });

    const serialized = original.serialize();

    vi.spyOn(FilterGroup, 'deserialize').mockReturnValue(filters);
    vi.spyOn(Formula, 'deserialize').mockReturnValue(formula);
    vi.spyOn(PropertyDisplay, 'deserialize').mockReturnValue(property);

    const registry = makeViewRegistry(view);
    const restored = BaseConfig.deserialize(serialized, registry);

    expect(restored.serialize()).toEqual(serialized);
  });
});