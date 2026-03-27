// listViewBuilder.test.ts

import { describe, it, expect } from 'vitest';
import { ListViewBuilder } from 'views/listViewBuilder';
import { ListViewConfig } from 'views/listViewConfig';
import { ListViewConfigOptions } from 'views/listViewConfigOptions';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ListViewBuilder', () => {

  // ── constructor() ───────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates a builder with no existing config', () => {
      expect(() => new ListViewBuilder()).not.toThrow();
    });

    it('initializes from an existing config', () => {
      const existing = new ListViewConfig({ name: 'view', markers: 'bullet' });
      const config = new ListViewBuilder(existing).build();
      expect(config.options.markers).toBe('bullet');
    });
  });

  // ── setIndentProperties() ───────────────────────────────────────────────────

  describe('setIndentProperties()', () => {
    it('sets indentProperties to true', () => {
      const config = new ListViewBuilder().setName('test').setIndentProperties(true).build();
      expect(config.options.indentProperties).toBe(true);
    });

    it('sets indentProperties to false', () => {
      const config = new ListViewBuilder().setName('test').setIndentProperties(false).build();
      expect(config.options.indentProperties).toBe(false);
    });

    it('returns the builder instance for chaining', () => {
      const builder = new ListViewBuilder();
      expect(builder.setIndentProperties(true)).toBe(builder);
    });
  });

  // ── setMarkers() ────────────────────────────────────────────────────────────

  describe('setMarkers()', () => {
    it.each([['number'], ['bullet'], ['none']] as const)(
      'sets markers to "%s"',
      (markers) => {
        const config = new ListViewBuilder().setName('test').setMarkers(markers).build();
        expect(config.options.markers).toBe(markers);
      }
    );

    it('returns the builder instance for chaining', () => {
      const builder = new ListViewBuilder();
      expect(builder.setMarkers('bullet')).toBe(builder);
    });
  });

  // ── setSeparator() ──────────────────────────────────────────────────────────

  describe('setSeparator()', () => {
    it('sets the separator string', () => {
      const config = new ListViewBuilder().setName('test').setSeparator(' | ').build();
      expect(config.options.separator).toBe(' | ');
    });

    it('accepts an empty string as a separator', () => {
      const config = new ListViewBuilder().setName('test').setSeparator('').build();
      expect(config.options.separator).toBe('');
    });

    it('returns the builder instance for chaining', () => {
      const builder = new ListViewBuilder();
      expect(builder.setSeparator(',')).toBe(builder);
    });
  });

  // ── build() ─────────────────────────────────────────────────────────────────

  describe('build()', () => {
    it('returns a ListViewConfig instance', () => {
      expect(new ListViewBuilder().setName('test').build()).toBeInstanceOf(ListViewConfig);
    });

    it('reflects all accumulated options in the built config', () => {
      const config = new ListViewBuilder()
        .setName('test')
        .setIndentProperties(true)
        .setMarkers('number')
        .setSeparator(', ')
        .build();

      expect(config.options.indentProperties).toBe(true);
      expect(config.options.markers).toBe('number');
      expect(config.options.separator).toBe(', ');
    });
  });
});