// templateParams.test.ts

import { describe, it, expect } from 'vitest';
import {
  parseParamSpecs,
  mergeHarvestedParams,
  buildScopedParams,
  HarvestedParams,
} from 'bases/templateParams';

// ── parseParamSpecs ───────────────────────────────────────────────────────────

describe('parseParamSpecs', () => {
  it('returns {} for null', () => expect(parseParamSpecs(null)).toEqual({}));
  it('returns {} for undefined', () => expect(parseParamSpecs(undefined)).toEqual({}));
  it('returns {} for a string', () => expect(parseParamSpecs('hello')).toEqual({}));
  it('returns {} for an array', () => expect(parseParamSpecs([])).toEqual({}));
  it('returns {} for an empty object', () => expect(parseParamSpecs({})).toEqual({}));

  it('parses a full string spec', () => {
    expect(parseParamSpecs({ x: { label: 'X Label', type: 'string', default: 'hello' } }))
      .toEqual({ x: { label: 'X Label', type: 'string', default: 'hello' } });
  });

  it('parses a boolean spec', () => {
    expect(parseParamSpecs({ flag: { type: 'boolean', default: true } }))
      .toEqual({ flag: { label: undefined, type: 'boolean', default: true } });
  });

  it('parses a number spec', () => {
    expect(parseParamSpecs({ count: { type: 'number', default: 42 } }))
      .toEqual({ count: { label: undefined, type: 'number', default: 42 } });
  });

  it('parses min and max on a number spec', () => {
    expect(parseParamSpecs({ count: { type: 'number', min: 0, max: 100 } }))
      .toMatchObject({ count: { type: 'number', min: 0, max: 100 } });
  });

  it('omits min/max when they are not numbers', () => {
    const result = parseParamSpecs({ count: { type: 'number', min: 'low', max: true } });
    expect(result.count).not.toHaveProperty('min');
    expect(result.count).not.toHaveProperty('max');
  });

  it('parses partial number constraints', () => {
    const result = parseParamSpecs({ count: { type: 'number', min: 1 } });
    expect(result.count).toMatchObject({ type: 'number', min: 1 });
    expect(result.count).not.toHaveProperty('max');
  });

  it('parses folder, date, datetime types', () => {
    const result = parseParamSpecs({
      f: { type: 'folder' },
      d: { type: 'date' },
      dt: { type: 'datetime' },
    });
    expect(result.f!.type).toBe('folder');
    expect(result.d!.type).toBe('date');
    expect(result.dt!.type).toBe('datetime');
  });

  it('throws on unknown type', () => {
    expect(() => parseParamSpecs({ x: { type: 'unknown' } })).toThrow('Unknown param type: unknown');
  });

  it('throws when type is absent', () => {
    expect(() => parseParamSpecs({ x: { label: 123 } })).toThrow('Unknown param type: undefined');
  });

  it('treats a non-object entry value as a plain string spec', () => {
    expect(parseParamSpecs({ x: 'not an object' })).toMatchObject({ x: { type: 'string' } });
  });

  it('parses optional: true', () => {
    expect(parseParamSpecs({ x: { type: 'string', optional: true } }))
      .toMatchObject({ x: { optional: true } });
  });

  it('leaves optional undefined when not explicitly true', () => {
    const result = parseParamSpecs({ x: { type: 'string' } });
    expect(result.x?.optional).toBeUndefined();
  });

  it('omits number default when it is not a number', () => {
    expect(parseParamSpecs({ x: { type: 'number', default: 'not a number' } }))
      .toMatchObject({ x: { default: undefined } });
  });

  it('parses an enum spec with options', () => {
    expect(parseParamSpecs({ dir: { type: 'enum', options: ['ASC', 'DESC'], default: 'ASC' } }))
      .toEqual({ dir: { label: undefined, type: 'enum', options: ['ASC', 'DESC'], default: 'ASC' } });
  });

  it('parses an enum spec with no default', () => {
    expect(parseParamSpecs({ dir: { type: 'enum', options: ['ASC', 'DESC'] } }))
      .toMatchObject({ dir: { type: 'enum', options: ['ASC', 'DESC'], default: undefined } });
  });

  it('filters non-string values from enum options', () => {
    const result = parseParamSpecs({ dir: { type: 'enum', options: ['ASC', 42, null, 'DESC'] } });
    expect(result.dir).toMatchObject({ type: 'enum', options: ['ASC', 'DESC'] });
  });

  it('parses an enum spec with an empty options array', () => {
    expect(parseParamSpecs({ dir: { type: 'enum', options: [] } }))
      .toMatchObject({ dir: { type: 'enum', options: [] } });
  });

  it('parses an enum spec with a non-array options value as empty', () => {
    const result = parseParamSpecs({ dir: { type: 'enum', options: 'ASC' } });
    expect(result.dir).toMatchObject({ type: 'enum', options: [] });
  });
});

// ── mergeHarvestedParams ──────────────────────────────────────────────────────

describe('mergeHarvestedParams', () => {
  it('adds a new param with the given source path', () => {
    const into: HarvestedParams = {};
    mergeHarvestedParams(into, { x: { type: 'string' } }, 'view/focused');
    expect(Object.keys(into.x!.specs)).toEqual(['view/focused']);
    expect(into.x!.specs['view/focused']!.type).toBe('string');
  });

  it('stores each source\'s spec independently for same-named params', () => {
    const into: HarvestedParams = {};
    mergeHarvestedParams(into, { x: { type: 'string' } }, 'view/focused');
    mergeHarvestedParams(into, { x: { type: 'folder' } }, 'filter/inThisFolder');
    expect(Object.keys(into.x!.specs)).toEqual(['view/focused', 'filter/inThisFolder']);
    expect(into.x!.specs['view/focused']!.type).toBe('string');
    expect(into.x!.specs['filter/inThisFolder']!.type).toBe('folder');
  });

  it('handles template-level source path (empty string)', () => {
    const into: HarvestedParams = {};
    mergeHarvestedParams(into, { x: { type: 'string', label: 'X' } }, '');
    expect(Object.keys(into.x!.specs)).toEqual(['']);
  });

  it('adds multiple distinct params independently', () => {
    const into: HarvestedParams = {};
    mergeHarvestedParams(into, { a: { type: 'string' }, b: { type: 'string' } }, 'comp');
    expect(Object.keys(into)).toEqual(['a', 'b']);
  });
});

// ── buildScopedParams ─────────────────────────────────────────────────────────

describe('buildScopedParams', () => {
  it('returns template-level (unprefixed) keys when sourcePath is empty', () => {
    expect(buildScopedParams({ x: 'hello' }, '')).toEqual({ x: 'hello' });
  });

  it('extracts and strips source-scoped keys', () => {
    const resolved = { 'view/focused>taskLocation': 'Tasks' };
    expect(buildScopedParams(resolved, 'view/focused')).toEqual({ taskLocation: 'Tasks' });
  });

  it('ignores template-level keys when sourcePath is non-empty', () => {
    const resolved = { 'view/focused>taskLocation': 'Scoped', taskLocation: 'TopLevel' };
    expect(buildScopedParams(resolved, 'view/focused')).toEqual({ taskLocation: 'Scoped' });
  });

  it('ignores keys from a different source path', () => {
    const resolved = { 'other/comp>taskLocation': 'Other' };
    expect(buildScopedParams(resolved, 'view/focused')).toEqual({});
  });

  it('returns empty object when resolved is empty', () => {
    expect(buildScopedParams({}, 'any/path')).toEqual({});
  });
});
