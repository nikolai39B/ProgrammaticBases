// filter.test.ts

import { describe, it, expect } from 'vitest';
import { Filter, FilterGroup } from 'primitives/filter';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(
  operator: FilterGroup.Operator,
  children: unknown[] = []
): Record<string, unknown> {
  return { [operator]: children };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FilterGroup', () => {

  // ── constructor() ────────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it.each([['and'], ['or'], ['not']] as const)(
      'creates an instance with operator "%s"',
      (operator) => {
        const group = new FilterGroup(operator, []);
        expect(group).toBeInstanceOf(FilterGroup);
        expect(group.operator).toBe(operator);
        expect(group.children).toEqual([]);
      }
    );

    it('stores children correctly', () => {
      const children: Filter[] = ['status = done', 'priority = high'];
      const group = new FilterGroup('and', children);
      expect(group.children).toBe(children);
    });
  });

  // ── serialize() ──────────────────────────────────────────────────────────────

  describe('serialize()', () => {
    it.each([['and'], ['or'], ['not']] as const)(
      'serializes with operator "%s" as the top-level key',
      (operator) => {
        const group = new FilterGroup(operator, []);
        expect(group.serialize()).toEqual({ [operator]: [] });
      }
    );

    it('serializes leaf children as strings', () => {
      const group = new FilterGroup('and', ['status = done', 'priority = high']);
      expect(group.serialize()).toEqual({
        and: ['status = done', 'priority = high'],
      });
    });

    it('serializes nested FilterGroup children recursively', () => {
      const inner = new FilterGroup('or', ['status = done', 'status = in-progress']);
      const outer = new FilterGroup('and', [inner]);
      expect(outer.serialize()).toEqual({
        and: [{ or: ['status = done', 'status = in-progress'] }],
      });
    });

    it('serializes a mix of leaf and nested children', () => {
      const inner = new FilterGroup('or', ['status = done']);
      const outer = new FilterGroup('and', ['priority = high', inner]);
      expect(outer.serialize()).toEqual({
        and: ['priority = high', { or: ['status = done'] }],
      });
    });
  });

  // ── deserialize() ────────────────────────────────────────────────────────────

  describe('deserialize()', () => {
    it.each([['and'], ['or'], ['not']] as const)(
      'deserializes operator "%s" correctly',
      (operator) => {
        const group = FilterGroup.deserialize(makeRaw(operator));
        expect(group).toBeInstanceOf(FilterGroup);
        expect(group.operator).toBe(operator);
      }
    );

    it('deserializes an empty children array', () => {
      const group = FilterGroup.deserialize(makeRaw('and'));
      expect(group.children).toEqual([]);
    });

    it('deserializes leaf string children', () => {
      const group = FilterGroup.deserialize(
        makeRaw('and', ['status = done', 'priority = high'])
      );
      expect(group.children).toEqual(['status = done', 'priority = high']);
    });

    it('deserializes nested FilterGroup children recursively', () => {
      const group = FilterGroup.deserialize({
        and: [{ or: ['status = done', 'status = in-progress'] }],
      });
      expect(group.children[0]).toBeInstanceOf(FilterGroup);
      expect((group.children[0] as FilterGroup).operator).toBe('or');
    });

    it('deserializes a mix of leaf and nested children', () => {
      const group = FilterGroup.deserialize({
        and: ['priority = high', { or: ['status = done'] }],
      });
      expect(typeof group.children[0]).toBe('string');
      expect(group.children[1]).toBeInstanceOf(FilterGroup);
    });

    it('throws if no valid operator key is present', () => {
      expect(() =>
        FilterGroup.deserialize({ invalid: [] })
      ).toThrow();
    });

    it('throws if children is not an array', () => {
      expect(() =>
        FilterGroup.deserialize({ and: 'not-an-array' })
      ).toThrow();
    });
  });

  // ── Round-trip ───────────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('deserialize → serialize preserves a flat group', () => {
      const raw = makeRaw('and', ['status = done', 'priority = high']);
      expect(FilterGroup.deserialize(raw).serialize()).toEqual(raw);
    });

    it('deserialize → serialize preserves a nested group', () => {
      const raw = {
        and: ['priority = high', { or: ['status = done', 'status = in-progress'] }],
      };
      expect(FilterGroup.deserialize(raw).serialize()).toEqual(raw);
    });

    it('serialize → deserialize preserves all fields', () => {
      const inner = new FilterGroup('or', ['status = done']);
      const outer = new FilterGroup('and', ['priority = high', inner]);
      const restored = FilterGroup.deserialize(outer.serialize());

      expect(restored.operator).toBe(outer.operator);
      expect(restored.children[0]).toBe('priority = high');
      expect((restored.children[1] as FilterGroup).operator).toBe('or');
    });
  });
});

// ─── Filter.deserialize ───────────────────────────────────────────────────────

describe('Filter.deserialize', () => {
  it('returns a string as-is for a leaf value', () => {
    expect(Filter.deserialize('status = done')).toBe('status = done');
  });

  it('returns a FilterGroup for an object value', () => {
    const result = Filter.deserialize({ and: [] });
    expect(result).toBeInstanceOf(FilterGroup);
  });

  it('deserializes a nested structure correctly', () => {
    const result = Filter.deserialize({
      and: ['priority = high', { or: ['status = done'] }],
    });
    expect(result).toBeInstanceOf(FilterGroup);
    expect((result as FilterGroup).children[1]).toBeInstanceOf(FilterGroup);
  });
});