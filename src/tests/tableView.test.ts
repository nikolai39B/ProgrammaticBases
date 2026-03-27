import { describe, it, expect } from 'vitest';
import { TableViewConfig } from 'views/tableViewConfig';
import { TableViewConfigOptions } from 'views/tableViewConfigOptions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'table',
    name: 'Test Table View',
    ...overrides,
  };
}

function makeOptions(overrides: Partial<TableViewConfigOptions> = {}): TableViewConfigOptions {
  return {
    name: 'Test Table View',
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TableViewConfig', () => {

  // ── type ────────────────────────────────────────────────────────────────────

  describe('type', () => {
    it('is "table"', () => {
      expect(TableViewConfig.type).toBe('table');
    });
  });

  // ── constructor() ────────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates an instance with a valid name', () => {
      const config = new TableViewConfig(makeOptions());
      expect(config).toBeInstanceOf(TableViewConfig);
    });

    it('throws if name is empty', () => {
      expect(() => new TableViewConfig(makeOptions({ name: '' }))).toThrow();
    });

    it('throws if name is whitespace only', () => {
      expect(() => new TableViewConfig(makeOptions({ name: '   ' }))).toThrow();
    });
  });

  // ── rowHeight ────────────────────────────────────────────────────────────────

  describe('rowHeight', () => {
    it.each([['short'], ['medium'], ['tall'], ['extra-tall']] as const)(
      'exposes "%s" when set in options',
      (rowHeight) => {
        const config = new TableViewConfig(makeOptions({ rowHeight }));
        expect(config.rowHeight).toBe(rowHeight);
      }
    );

    it('exposes undefined when not set', () => {
      const config = new TableViewConfig(makeOptions());
      expect(config.rowHeight).toBeUndefined();
    });

    it.each([['short'], ['medium'], ['tall'], ['extra-tall']] as const)(
      'serialize() includes rowHeight "%s" when defined',
      (rowHeight) => {
        const config = new TableViewConfig(makeOptions({ rowHeight }));
        expect(config.serialize()).toMatchObject({ rowHeight });
      }
    );

    it('serialize() omits rowHeight when undefined', () => {
      const config = new TableViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('rowHeight');
    });

    it.each([['short'], ['medium'], ['tall'], ['extra-tall']] as const)(
      'deserialize() restores rowHeight "%s" correctly',
      (rowHeight) => {
        const config = TableViewConfig.deserialize(makeRaw({ rowHeight }));
        expect(config.rowHeight).toBe(rowHeight);
      }
    );

    it('deserialize() leaves rowHeight undefined when absent', () => {
      const config = TableViewConfig.deserialize(makeRaw());
      expect(config.rowHeight).toBeUndefined();
    });

    it('deserialize() throws on an invalid rowHeight type', () => {
      expect(() =>
        TableViewConfig.deserialize(makeRaw({ rowHeight: 'invalid' }))
      ).toThrow(/expected one of/i);
    });
  });

  // ── columnSize ───────────────────────────────────────────────────────────────

  describe('columnSize', () => {
    it('exposes the value set in options', () => {
      const columnSize = new Map([['note.title', 200], ['note.status', 100]]);
      const config = new TableViewConfig(makeOptions({ columnSize }));
      expect(config.columnSize).toBe(columnSize);
    });

    it('exposes undefined when not set', () => {
      const config = new TableViewConfig(makeOptions());
      expect(config.columnSize).toBeUndefined();
    });

    it('serialize() includes columnSize as a plain object when defined', () => {
      const columnSize = new Map([['note.title', 200], ['note.status', 100]]);
      const config = new TableViewConfig(makeOptions({ columnSize }));
      expect(config.serialize()).toMatchObject({
        columnSize: { 'note.title': 200, 'note.status': 100 },
      });
    });

    it('serialize() omits columnSize when undefined', () => {
      const config = new TableViewConfig(makeOptions());
      expect(config.serialize()).not.toHaveProperty('columnSize');
    });

    it('deserialize() restores columnSize as a Map correctly', () => {
      const config = TableViewConfig.deserialize(
        makeRaw({ columnSize: { 'note.title': 200, 'note.status': 100 } })
      );
      expect(config.columnSize).toBeInstanceOf(Map);
      expect(config.columnSize?.get('note.title')).toBe(200);
      expect(config.columnSize?.get('note.status')).toBe(100);
    });

    it('deserialize() leaves columnSize undefined when absent', () => {
      const config = TableViewConfig.deserialize(makeRaw());
      expect(config.columnSize).toBeUndefined();
    });
  });

  // ── deserialize() ────────────────────────────────────────────────────────────

  describe('deserialize()', () => {
    it('deserializes a minimal raw object', () => {
      const config = TableViewConfig.deserialize(makeRaw());
      expect(config).toBeInstanceOf(TableViewConfig);
      expect(config.name).toBe('Test Table View');
    });

    it('throws if name is missing', () => {
      expect(() =>
        TableViewConfig.deserialize({ type: 'table' })
      ).toThrow();
    });

    it('leaves all optional fields undefined when absent', () => {
      const config = TableViewConfig.deserialize(makeRaw());
      expect(config.rowHeight).toBeUndefined();
      expect(config.columnSize).toBeUndefined();
    });
  });

  // ── Round-trip ───────────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('deserialize → serialize preserves all fields', () => {
      const raw = makeRaw({
        rowHeight: 'tall',
        columnSize: { 'note.title': 200, 'note.status': 100 },
      });

      const config = TableViewConfig.deserialize(raw);
      expect(config.serialize()).toEqual(raw);
    });

    it('deserialize → serialize preserves a minimal config', () => {
      const raw = makeRaw();
      const config = TableViewConfig.deserialize(raw);
      expect(config.serialize()).toEqual(raw);
    });

    it('serialize → deserialize preserves all fields', () => {
      const original = new TableViewConfig(makeOptions({
        rowHeight: 'tall',
        columnSize: new Map([['note.title', 200], ['note.status', 100]]),
      }));

      const restored = TableViewConfig.deserialize(original.serialize());

      expect(restored.name).toBe(original.name);
      expect(restored.rowHeight).toBe(original.rowHeight);
      expect(restored.columnSize).toEqual(original.columnSize);
    });
  });
});