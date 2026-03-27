// propertyOrder.test.ts

import { describe, it, expect } from 'vitest';
import { PropertyOrder } from 'primitives/propertyOrder';
import { Property } from 'primitives/property';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRaw(
  property = 'note.status',
  direction: PropertyOrder.Direction = 'ASC'
): Record<string, unknown> {
  return { property, direction };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PropertyOrder', () => {

  // ── constructor() ────────────────────────────────────────────────────────────

  describe('constructor()', () => {
    it('creates an instance with the given property and direction', () => {
      const property = new Property('status', 'note');
      const order = new PropertyOrder(property, 'ASC');
      expect(order).toBeInstanceOf(PropertyOrder);
      expect(order.property).toBe(property);
      expect(order.direction).toBe('ASC');
    });

    it.each([['ASC'], ['DESC']] as const)(
      'accepts direction "%s"',
      (direction) => {
        const property = new Property('status', 'note');
        const order = new PropertyOrder(property, direction);
        expect(order.direction).toBe(direction);
      }
    );
  });

  // ── serialize() ──────────────────────────────────────────────────────────────

  describe('serialize()', () => {
    it('serializes to a plain object with property and direction keys', () => {
      const property = new Property('status', 'note');
      const order = new PropertyOrder(property, 'ASC');
      expect(order.serialize()).toEqual({ property: 'note.status', direction: 'ASC' });
    });

    it.each([['ASC'], ['DESC']] as const)(
      'serializes direction "%s" correctly',
      (direction) => {
        const order = new PropertyOrder(new Property('status', 'note'), direction);
        expect(order.serialize().direction).toBe(direction);
      }
    );

    it('serializes the property as a "source.name" string', () => {
      const order = new PropertyOrder(new Property('path', 'file'), 'DESC');
      expect(order.serialize().property).toBe('file.path');
    });
  });

  // ── deserialize() ────────────────────────────────────────────────────────────

  describe('deserialize()', () => {
    it('deserializes a valid raw object correctly', () => {
      const order = PropertyOrder.deserialize(makeRaw());
      expect(order).toBeInstanceOf(PropertyOrder);
      expect(order.property).toBeInstanceOf(Property);
      expect(order.property.source).toBe('note');
      expect(order.property.name).toBe('status');
      expect(order.direction).toBe('ASC');
    });

    it.each([['ASC'], ['DESC']] as const)(
      'deserializes direction "%s" correctly',
      (direction) => {
        const order = PropertyOrder.deserialize(makeRaw('note.status', direction));
        expect(order.direction).toBe(direction);
      }
    );

    it('throws on an invalid direction value', () => {
      expect(() =>
        PropertyOrder.deserialize({ property: 'note.status', direction: 'invalid' })
      ).toThrow();
    });

    it('throws on an invalid property source', () => {
      expect(() =>
        PropertyOrder.deserialize({ property: 'invalid.status', direction: 'ASC' })
      ).toThrow();
    });
  });

  // ── Round-trip ───────────────────────────────────────────────────────────────

  describe('round-trip', () => {
    it('deserialize → serialize preserves all fields', () => {
      const raw = makeRaw();
      expect(PropertyOrder.deserialize(raw).serialize()).toEqual(raw);
    });

    it('serialize → deserialize preserves all fields', () => {
      const original = new PropertyOrder(new Property('status', 'note'), 'DESC');
      const restored = PropertyOrder.deserialize(original.serialize());
      expect(restored.direction).toBe(original.direction);
      expect(restored.property.source).toBe(original.property.source);
      expect(restored.property.name).toBe(original.property.name);
    });
  });
});