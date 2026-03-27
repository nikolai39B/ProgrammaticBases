// baseBuilder.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseBuilder } from 'bases/baseBuilder';
import { BaseConfig } from 'bases/baseConfig';
import { FilterGroup } from 'primitives/filter';
import { Formula } from 'primitives/formula';
import { Property } from 'primitives/property';
import { PropertyDisplay } from 'primitives/propertyDisplay';
import { ViewConfigBuilder } from 'views/viewConfigBuilder';
import { ViewRegistry } from 'views/viewRegistry';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeViewBuilder(name = 'view'): ViewConfigBuilder {
  return {
    build: vi.fn().mockReturnValue({ name }),
  } as unknown as ViewConfigBuilder;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('BaseBuilder', () => {

  // ── constructor() ───────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates an empty builder when no existing config is provided', () => {
      const builder = new BaseBuilder();
      expect(() => builder.build()).toThrow();
    });
  
    it('initializes from an existing config', () => {
      const view = makeViewBuilder();
      const existing = new BaseConfig([view.build()], {});
      const registry = { createBuilder: vi.fn().mockReturnValue(view) } as unknown as ViewRegistry;
  
      const builder = new BaseBuilder(existing, registry);
      const config = builder.build();
      expect(config).toBeInstanceOf(BaseConfig);
    });
  
    it('copies options from an existing config', () => {
      const filters = new FilterGroup('and', []);
      const view = makeViewBuilder();
      const existing = new BaseConfig([view.build()], { filters });
      const registry = { createBuilder: vi.fn().mockReturnValue(view) } as unknown as ViewRegistry;
  
      const builder = new BaseBuilder(existing, registry);
      const config = builder.build();
      expect(config.options.filters).toBe(filters);
    });
  });

  // ── setFilter() ─────────────────────────────────────────────────────────────

  describe('setFilter()', () => {
    it('sets the filter group on the options', () => {
      const filters = new FilterGroup('and', []);
      const builder = new BaseBuilder();
      builder.addView(makeViewBuilder()).setFilter(filters);
      expect(builder.build().options.filters).toBe(filters);
    });

    it('replaces a previously set filter', () => {
      const first = new FilterGroup('and', []);
      const second = new FilterGroup('or', []);
      const builder = new BaseBuilder();
      builder.addView(makeViewBuilder()).setFilter(first).setFilter(second);
      expect(builder.build().options.filters).toBe(second);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new BaseBuilder();
      expect(builder.setFilter(new FilterGroup('and', []))).toBe(builder);
    });
  });

  // ── addFormula() ────────────────────────────────────────────────────────────

  describe('addFormula()', () => {
    it('adds a formula to the options', () => {
      const formula = new Formula('isComplete', 'true');
      const builder = new BaseBuilder();
      builder.addView(makeViewBuilder()).addFormula(formula);
      expect(builder.build().options.formulas).toContain(formula);
    });

    it('accumulates multiple formulas', () => {
      const a = new Formula('a', 'true');
      const b = new Formula('b', 'false');
      const builder = new BaseBuilder();
      builder.addView(makeViewBuilder()).addFormula(a).addFormula(b);
      expect(builder.build().options.formulas).toEqual([a, b]);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new BaseBuilder();
      expect(builder.addFormula(new Formula('x', 'true'))).toBe(builder);
    });
  });

  // ── addProperty() ───────────────────────────────────────────────────────────

  describe('addProperty()', () => {
    it('adds a property display to the options', () => {
      const property = new Property('status', 'note');
      const builder = new BaseBuilder();
      builder.addView(makeViewBuilder()).addProperty(property, 'Status');
      const properties = builder.build().options.properties;
      expect(properties).toHaveLength(1);
      expect(properties![0]).toBeInstanceOf(PropertyDisplay);
      expect(properties![0]!.property).toBe(property);
      expect(properties![0]!.displayName).toBe('Status');
    });

    it('accumulates multiple properties', () => {
      const a = new Property('status', 'note');
      const b = new Property('path', 'file');
      const builder = new BaseBuilder();
      builder.addView(makeViewBuilder()).addProperty(a, 'Status').addProperty(b, 'Path');
      expect(builder.build().options.properties).toHaveLength(2);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new BaseBuilder();
      expect(builder.addProperty(new Property('status'), 'Status')).toBe(builder);
    });
  });

  // ── addView() ───────────────────────────────────────────────────────────────

  describe('addView()', () => {
    it('adds a view builder that is included in the built config', () => {
      const view = makeViewBuilder('myView');
      const builder = new BaseBuilder();
      builder.addView(view);
      const config = builder.build();
      expect(view.build).toHaveBeenCalled();
      expect(config.views).toHaveLength(1);
    });

    it('accumulates multiple view builders', () => {
      const a = makeViewBuilder('a');
      const b = makeViewBuilder('b');
      const builder = new BaseBuilder();
      builder.addView(a).addView(b);
      expect(builder.build().views).toHaveLength(2);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new BaseBuilder();
      expect(builder.addView(makeViewBuilder())).toBe(builder);
    });
  });

  // ── build() ─────────────────────────────────────────────────────────────────

  describe('build()', () => {
    it('returns a BaseConfig instance', () => {
      const builder = new BaseBuilder();
      builder.addView(makeViewBuilder());
      expect(builder.build()).toBeInstanceOf(BaseConfig);
    });

    it('throws if no views have been added', () => {
      const builder = new BaseBuilder();
      expect(() => builder.build()).toThrow('Base must have at least one view');
    });

    it('builds all added view builders into the config', () => {
      const a = makeViewBuilder('a');
      const b = makeViewBuilder('b');
      const builder = new BaseBuilder();
      builder.addView(a).addView(b).build();
      expect(a.build).toHaveBeenCalledOnce();
      expect(b.build).toHaveBeenCalledOnce();
    });
  });
});