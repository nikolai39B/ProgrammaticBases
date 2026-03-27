// propertyDisplay.test.ts

import { describe, it, expect } from 'vitest';
import { PropertyDisplay } from 'primitives/propertyDisplay';
import { Property } from 'primitives/property';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(
  propertyKey = 'note.status',
  displayName = 'Status'
): Record<string, unknown> {
  return { [propertyKey]: { displayName } };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PropertyDisplay', () => {

  // ── constructor() ────────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates an instance with the given property and displayName', () => {
      const property = new Property('status', 'note');
      const pd = new PropertyDisplay(property, 'Status');
      expect(pd).toBeInstanceOf(PropertyDisplay);
      expect(pd.property).toBe(property);
      expect(pd.displayName).toBe('Status');
    });
  });

  // ── serialize() ──────────────────────────────────────────────────────────────

  describe('serialize()', () => {
    it('serializes to a single-entry record keyed by the serialized property', () => {
      const property = new Property('status', 'note');
      const pd = new PropertyDisplay(property, 'Status');
      expect(pd.serialize()).toEqual({ 'note.status': { displayName: 'Status' } });
    });

    it('uses the serialized property string as the key', () => {
      const property = new Property('path', 'file');
      const pd = new PropertyDisplay(property, 'File Path');
      const result = pd.serialize();
      expect(Object.keys(result)).toEqual(['file.path']);
    });

    it('nests displayName under the property key', () => {
      const property = new Property('status', 'note');
      const pd = new PropertyDisplay(property, 'Status');
      const result = pd.serialize();
      expect(result['note.status']).toEqual({ displayName: 'Status' });
    });
  });

  // ── deserialize() ────────────────────────────────────────────────────────────

  describe('deserialize()', () => {
    it('deserializes a valid raw record correctly', () => {
      const pd = PropertyDisplay.deserialize(makeRaw());
      expect(pd).toBeInstanceOf(PropertyDisplay);
      expect(pd.property).toBeInstanceOf(Property);
      expect(pd.property.source).toBe('note');
      expect(pd.property.name).toBe('status');
      expect(pd.displayName).toBe('Status');
    });

    it('deserializes a file-sourced property correctly', () => {
      const pd = PropertyDisplay.deserialize(makeRaw('file.path', 'File Path'));
      expect(pd.property.source).toBe('file');
      expect(pd.property.name).toBe('path');
      expect(pd.displayName).toBe('File Path');
    });

    it('uses the first entry when multiple keys are present', () => {
      const pd = PropertyDisplay.deserialize({
        'note.status': { displayName: 'Status' },
        'note.priority': { displayName: 'Priority' },
      });
      expect(pd.property.name).toBe('status');
      expect(pd.displayName).toBe('Status');
    });

    it('throws on an empty record', () => {
      expect(() => PropertyDisplay.deserialize({})).toThrow();
    });
  });

  // ── Round-trip ───────────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('deserialize → serialize preserves all fields', () => {
      const raw = makeRaw();
      expect(PropertyDisplay.deserialize(raw).serialize()).toEqual(raw);
    });

    it('serialize → deserialize preserves all fields', () => {
      const original = new PropertyDisplay(new Property('status', 'note'), 'Status');
      const restored = PropertyDisplay.deserialize(original.serialize());
      expect(restored.displayName).toBe(original.displayName);
      expect(restored.property.source).toBe(original.property.source);
      expect(restored.property.name).toBe(original.property.name);
    });
  });
});