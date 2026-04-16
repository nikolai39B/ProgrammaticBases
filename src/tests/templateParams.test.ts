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

  it('parses folder, date, datetime types', () => {
    const result = parseParamSpecs({
      f: { type: 'folder' },
      d: { type: 'date' },
      dt: { type: 'datetime' },
    });
    expect(result.f.type).toBe('folder');
    expect(result.d.type).toBe('date');
    expect(result.dt.type).toBe('datetime');
  });

  it('coerces unknown type to "string"', () => {
    const result = parseParamSpecs({ x: { type: 'unknown' } });
    expect(result.x.type).toBe('string');
  });

  it('treats a non-object entry value as an empty spec', () => {
    expect(parseParamSpecs({ x: 'not an object' })).toEqual({ x: {} });
  });

  it('omits label when it is not a string', () => {
    expect(parseParamSpecs({ x: { label: 123 } })).toMatchObject({ x: { label: undefined } });
  });

  it('omits number default when it is not a number', () => {
    expect(parseParamSpecs({ x: { type: 'number', default: 'not a number' } }))
      .toMatchObject({ x: { default: undefined } });
  });
});

// ── mergeHarvestedParams ──────────────────────────────────────────────────────

describe('mergeHarvestedParams', () => {
  it('adds a new param with the given source path', () => {
    const into: HarvestedParams = {};
    mergeHarvestedParams(into, { x: { type: 'string' } }, 'view/focused');
    expect(into.x.sources).toEqual(['view/focused']);
    expect(into.x.spec.type).toBe('string');
  });

  it('accumulates sources for same-named params', () => {
    const into: HarvestedParams = {};
    mergeHarvestedParams(into, { x: { type: 'string' } }, 'view/focused');
    mergeHarvestedParams(into, { x: { type: 'folder' } }, 'filter/inThisFolder');
    expect(into.x.sources).toEqual(['view/focused', 'filter/inThisFolder']);
    // Keeps the spec from the first declaration
    expect(into.x.spec.type).toBe('string');
  });

  it('handles template-level source path (empty string)', () => {
    const into: HarvestedParams = {};
    mergeHarvestedParams(into, { x: { label: 'X' } }, '');
    expect(into.x.sources).toEqual(['']);
  });

  it('adds multiple distinct params independently', () => {
    const into: HarvestedParams = {};
    mergeHarvestedParams(into, { a: {}, b: {} }, 'comp');
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
