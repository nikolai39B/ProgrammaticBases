// formula.test.ts

import { describe, it, expect } from 'vitest';
import { Formula } from 'primitives/formula';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(name = 'myFormula', content = 'prop("status") == "done"'): Record<string, string> {
  return { [name]: content };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Formula', () => {

  // ── constructor() ────────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates an instance with the given name and content', () => {
      const formula = new Formula('myFormula', 'prop("status") == "done"');
      expect(formula).toBeInstanceOf(Formula);
      expect(formula.name).toBe('myFormula');
      expect(formula.content).toBe('prop("status") == "done"');
    });
  });

  // ── serialize() ──────────────────────────────────────────────────────────────

  describe('serialize()', () => {
    it('serializes to a { name: content } record', () => {
      const formula = new Formula('myFormula', 'prop("status") == "done"');
      expect(formula.serialize()).toEqual({ myFormula: 'prop("status") == "done"' });
    });

    it('uses the formula name as the key', () => {
      const formula = new Formula('isComplete', 'prop("status") == "done"');
      const result = formula.serialize();
      expect(Object.keys(result)).toEqual(['isComplete']);
    });

    it('uses the formula content as the value', () => {
      const formula = new Formula('myFormula', 'prop("priority") == "high"');
      const result = formula.serialize();
      expect(result['myFormula']).toBe('prop("priority") == "high"');
    });
  });

  // ── deserialize() ────────────────────────────────────────────────────────────

  describe('deserialize()', () => {
    it('deserializes a { name: content } record correctly', () => {
      const formula = Formula.deserialize(makeRaw());
      expect(formula).toBeInstanceOf(Formula);
      expect(formula.name).toBe('myFormula');
      expect(formula.content).toBe('prop("status") == "done"');
    });

    it('uses the first entry when multiple keys are present', () => {
      const formula = Formula.deserialize({ first: 'content-a', second: 'content-b' });
      expect(formula.name).toBe('first');
      expect(formula.content).toBe('content-a');
    });

    it('throws on an empty record', () => {
      expect(() => Formula.deserialize({})).toThrow();
    });
  });

  // ── Round-trip ───────────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('deserialize → serialize preserves all fields', () => {
      const raw = makeRaw();
      expect(Formula.deserialize(raw).serialize()).toEqual(raw);
    });

    it('serialize → deserialize preserves all fields', () => {
      const original = new Formula('myFormula', 'prop("status") == "done"');
      const restored = Formula.deserialize(original.serialize());
      expect(restored.name).toBe(original.name);
      expect(restored.content).toBe(original.content);
    });
  });
});