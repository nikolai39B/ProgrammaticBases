// tableViewBuilder.test.ts

import { describe, it, expect } from 'vitest';
import { TableViewBuilder } from 'views/tableViewBuilder';
import { TableViewConfig } from 'views/tableViewConfig';
import { TableViewConfigOptions } from 'views/tableViewConfigOptions';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('TableViewBuilder', () => {

  // ── constructor() ───────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates a builder with no existing config', () => {
      expect(() => new TableViewBuilder()).not.toThrow();
    });

    it('initializes from an existing config', () => {
      const existing = new TableViewConfig({ name: 'view', rowHeight: 'tall' });
      const config = new TableViewBuilder(existing).build();
      expect(config.options.rowHeight).toBe('tall');
    });
  });

  // ── setRowHeight() ──────────────────────────────────────────────────────────

  describe('setRowHeight()', () => {
    it.each([['short'], ['medium'], ['tall'], ['extra-tall']] as const)(
      'sets row height to "%s"',
      (rowHeight) => {
        const config = new TableViewBuilder().setName('test').setRowHeight(rowHeight).build();
        expect(config.options.rowHeight).toBe(rowHeight);
      }
    );

    it('returns the builder instance for chaining', () => {
      const builder = new TableViewBuilder();
      expect(builder.setRowHeight('medium')).toBe(builder);
    });
  });

  // ── setColumnSize() ─────────────────────────────────────────────────────────

  describe('setColumnSize()', () => {
    it('sets the column size map', () => {
      const columnSize = new Map([['note.status', 120], ['file.path', 200]]);
      const config = new TableViewBuilder().setName('test').setColumnSize(columnSize).build();
      expect(config.options.columnSize).toBe(columnSize);
    });

    it('accepts an empty map', () => {
      const columnSize = new Map<string, number>();
      const config = new TableViewBuilder().setName('test').setColumnSize(columnSize).build();
      expect(config.options.columnSize).toEqual(new Map());
    });

    it('returns the builder instance for chaining', () => {
      const builder = new TableViewBuilder();
      expect(builder.setColumnSize(new Map())).toBe(builder);
    });
  });

  // ── build() ─────────────────────────────────────────────────────────────────

  describe('build()', () => {
    it('returns a TableViewConfig instance', () => {
      expect(new TableViewBuilder().setName('test').build()).toBeInstanceOf(TableViewConfig);
    });

    it('reflects all accumulated options in the built config', () => {
      const columnSize = new Map([['note.status', 150]]);
      const config = new TableViewBuilder()
        .setName('test')
        .setRowHeight('short')
        .setColumnSize(columnSize)
        .build();

      expect(config.options.rowHeight).toBe('short');
      expect(config.options.columnSize).toBe(columnSize);
    });
  });
});