// property.test.ts

import { describe, it, expect } from 'vitest';
import { Property } from 'primitives/property';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property', () => {

  // ── constructor() ────────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates an instance with the given name and source', () => {
      const property = new Property('status', 'note');
      expect(property).toBeInstanceOf(Property);
      expect(property.name).toBe('status');
      expect(property.source).toBe('note');
    });

    it('leaves source undefined when not provided', () => {
      const property = new Property('status');
      expect(property.source).toBeUndefined();
    });

    it.each([['file'], ['note'], ['formula']] as const)(
      'accepts source "%s"',
      (source) => {
        const property = new Property('status', source);
        expect(property.source).toBe(source);
      }
    );
  });

  // ── serialize() ──────────────────────────────────────────────────────────────

  describe('serialize()', () => {
    it('serializes to "source.name" when a source is present', () => {
      const property = new Property('status', 'note');
      expect(property.serialize()).toBe('note.status');
    });

    it('serializes to a plain name when no source is present', () => {
      const property = new Property('thumbnail');
      expect(property.serialize()).toBe('thumbnail');
    });

    it.each([
      ['file', 'path', 'file.path'],
      ['note', 'status', 'note.status'],
      ['formula', 'isComplete', 'formula.isComplete'],
    ] as const)(
      'serializes source "%s" with name "%s" as "%s"',
      (source, name, expected) => {
        expect(new Property(name, source).serialize()).toBe(expected);
      }
    );
  });

  // ── deserialize() ────────────────────────────────────────────────────────────

  describe('deserialize()', () => {
    it('deserializes a "source.name" string correctly', () => {
      const property = Property.deserialize('note.status');
      expect(property).toBeInstanceOf(Property);
      expect(property.source).toBe('note');
      expect(property.name).toBe('status');
    });

    it.each([
      ['file.path', 'file', 'path'],
      ['note.status', 'note', 'status'],
      ['formula.isComplete', 'formula', 'isComplete'],
    ] as const)(
      'deserializes "%s" to source "%s" and name "%s"',
      (raw, source, name) => {
        const property = Property.deserialize(raw);
        expect(property.source).toBe(source);
        expect(property.name).toBe(name);
      }
    );

    it('leaves source undefined for a plain name string with no dot', () => {
      const property = Property.deserialize('thumbnail');
      expect(property.source).toBeUndefined();
      expect(property.name).toBe('thumbnail');
    });

    it('throws if the source prefix is not a valid source', () => {
      expect(() => Property.deserialize('invalid.status')).toThrow();
    });

    it('handles a name containing a dot correctly', () => {
      const property = Property.deserialize('note.some.nested.name');
      expect(property.source).toBe('note');
      expect(property.name).toBe('some.nested.name');
    });
  });

  // ── equals() ─────────────────────────────────────────────────────────────────

  describe('equals()', () => {
    it('returns true for two properties with the same source and name', () => {
      const a = new Property('status', 'note');
      const b = new Property('status', 'note');
      expect(a.equals(b)).toBe(true);
    });

    it('returns true for two properties with no source and the same name', () => {
      const a = new Property('thumbnail');
      const b = new Property('thumbnail');
      expect(a.equals(b)).toBe(true);
    });

    it('returns false when names differ', () => {
      const a = new Property('status', 'note');
      const b = new Property('priority', 'note');
      expect(a.equals(b)).toBe(false);
    });

    it('returns false when sources differ', () => {
      const a = new Property('status', 'note');
      const b = new Property('status', 'file');
      expect(a.equals(b)).toBe(false);
    });

    it('returns false when one property has a source and the other does not', () => {
      const a = new Property('status', 'note');
      const b = new Property('status');
      expect(a.equals(b)).toBe(false);
    });

    it('returns false when both source and name differ', () => {
      const a = new Property('status', 'note');
      const b = new Property('path', 'file');
      expect(a.equals(b)).toBe(false);
    });
  });

  // ── Round-trip ───────────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('deserialize → serialize preserves a "source.name" string', () => {
      expect(Property.deserialize('note.status').serialize()).toBe('note.status');
    });

    it('deserialize → serialize preserves a plain name string', () => {
      expect(Property.deserialize('thumbnail').serialize()).toBe('thumbnail');
    });

    it('serialize → deserialize preserves a property with a source', () => {
      const original = new Property('status', 'note');
      const restored = Property.deserialize(original.serialize());
      expect(restored.source).toBe(original.source);
      expect(restored.name).toBe(original.name);
    });

    it('serialize → deserialize preserves a property with no source', () => {
      const original = new Property('thumbnail');
      const restored = Property.deserialize(original.serialize());
      expect(restored.source).toBeUndefined();
      expect(restored.name).toBe(original.name);
    });
  });
});