// viewRegistry.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewRegistry } from 'views/viewRegistry';
import { ViewRegistration } from 'views/viewRegistry';
import { ViewConfig } from 'views/viewConfig';
import { ViewConfigBuilder } from 'views/viewConfigBuilder';
import { ViewConfigOptions } from 'views/viewConfigOptions';
import { ViewType } from 'views/viewType';

// ─── Test Doubles ─────────────────────────────────────────────────────────────

class StubViewConfig extends ViewConfig {
  constructor(options: ViewConfigOptions) {
    super(options);
  }
}

class StubViewBuilder implements ViewConfigBuilder {
  build(): ViewConfig {
    return new StubViewConfig({ name: 'stub' } as ViewConfigOptions);
  }
}

function makeRegistration<K extends ViewType>(
  type: K,
  overrides: Partial<ViewRegistration<K, StubViewConfig>> = {},
): ViewRegistration<K, StubViewConfig> {
  return {
    type,
    createBuilder: vi.fn(() => new StubViewBuilder()),
    deserialize: vi.fn((_raw) => new StubViewConfig({ name: 'stub' } as ViewConfigOptions)),
    ...overrides,
  };
}

function makeConfig(type: ViewType, name = 'Test View'): StubViewConfig {
  const config = new StubViewConfig({ name } as ViewConfigOptions);
  Object.defineProperty(config, 'type', { value: type, writable: false });
  return config;
}

// ─── ViewRegistry ─────────────────────────────────────────────────────────────

describe('ViewRegistry', () => {
  let registry: ViewRegistry;

  beforeEach(() => {
    registry = new ViewRegistry();
  });

  // ── register() ──────────────────────────────────────────────────────────────

  describe('register()', () => {
    it('registers a view type successfully', () => {
      registry.register(makeRegistration('list'));
      expect(registry.isRegistered('list')).toBe(true);
    });

    it('registers multiple distinct view types', () => {
      registry.register(makeRegistration('list'));
      registry.register(makeRegistration('cards'));
      registry.register(makeRegistration('table'));

      expect(registry.isRegistered('list')).toBe(true);
      expect(registry.isRegistered('cards')).toBe(true);
      expect(registry.isRegistered('table')).toBe(true);
    });

    it('throws if the same type is registered twice', () => {
      registry.register(makeRegistration('list'));
      expect(() => registry.register(makeRegistration('list'))).toThrow(
        "View type 'list' is already registered.",
      );
    });

    it('throws with the correct type name in the error message', () => {
      registry.register(makeRegistration('cards'));
      expect(() => registry.register(makeRegistration('cards'))).toThrow('cards');
    });

    it('does not affect other types when one duplicate throws', () => {
      registry.register(makeRegistration('list'));
      registry.register(makeRegistration('cards'));

      expect(() => registry.register(makeRegistration('list'))).toThrow();

      // cards should be unaffected
      expect(registry.isRegistered('cards')).toBe(true);
    });

    it('stores the registration so its factories are callable', () => {
      const registration = makeRegistration('list');
      registry.register(registration);

      const config = makeConfig('list');
      registry.createBuilder(config);

      expect(registration.createBuilder).toHaveBeenCalledOnce();
    });
  });

  // ── deregister() ────────────────────────────────────────────────────────────

  describe('deregister()', () => {
    it('removes a registered view type', () => {
      registry.register(makeRegistration('list'));
      registry.deregister('list');
      expect(registry.isRegistered('list')).toBe(false);
    });

    it('is a no-op if the type was never registered', () => {
      expect(() => registry.deregister('list')).not.toThrow();
    });

    it('does not affect other registered types', () => {
      registry.register(makeRegistration('list'));
      registry.register(makeRegistration('cards'));

      registry.deregister('list');

      expect(registry.isRegistered('list')).toBe(false);
      expect(registry.isRegistered('cards')).toBe(true);
    });

    it('allows re-registration after deregistration', () => {
      registry.register(makeRegistration('list'));
      registry.deregister('list');
      expect(() => registry.register(makeRegistration('list'))).not.toThrow();
      expect(registry.isRegistered('list')).toBe(true);
    });

    it('calling deregister twice on the same type does not throw', () => {
      registry.register(makeRegistration('list'));
      registry.deregister('list');
      expect(() => registry.deregister('list')).not.toThrow();
    });
  });

  // ── isRegistered() ──────────────────────────────────────────────────────────

  describe('isRegistered()', () => {
    it('returns false for an empty registry', () => {
      expect(registry.isRegistered('list')).toBe(false);
    });

    it('returns true after registration', () => {
      registry.register(makeRegistration('list'));
      expect(registry.isRegistered('list')).toBe(true);
    });

    it('returns false after deregistration', () => {
      registry.register(makeRegistration('list'));
      registry.deregister('list');
      expect(registry.isRegistered('list')).toBe(false);
    });

    it('returns false for a type that was never registered, even when others are', () => {
      registry.register(makeRegistration('cards'));
      expect(registry.isRegistered('list')).toBe(false);
    });

    it('is independent per type', () => {
      registry.register(makeRegistration('list'));
      expect(registry.isRegistered('list')).toBe(true);
      expect(registry.isRegistered('cards')).toBe(false);
      expect(registry.isRegistered('table')).toBe(false);
    });
  });

  // ── createBuilder() ─────────────────────────────────────────────────────────

  describe('createBuilder()', () => {
    it('returns a builder for a registered type', () => {
      registry.register(makeRegistration('list'));
      const config = makeConfig('list');
      const builder = registry.createBuilder(config);
      expect(builder).toBeInstanceOf(StubViewBuilder);
    });

    it('delegates to the registration createBuilder factory', () => {
      const registration = makeRegistration('list');
      registry.register(registration);

      const config = makeConfig('list');
      registry.createBuilder(config);

      expect(registration.createBuilder).toHaveBeenCalledOnce();
      expect(registration.createBuilder).toHaveBeenCalledWith(config);
    });

    it('returns a fresh builder on every call', () => {
      registry.register(makeRegistration('list'));
      const config = makeConfig('list');

      const a = registry.createBuilder(config);
      const b = registry.createBuilder(config);

      expect(a).not.toBe(b);
    });

    it('throws if no registration exists for the config type', () => {
      const config = makeConfig('list');
      expect(() => registry.createBuilder(config)).toThrow(
        'No builder registered for view type: list',
      );
    });

    it('throws with the correct type name in the error message', () => {
      const config = makeConfig('cards');
      expect(() => registry.createBuilder(config)).toThrow('cards');
    });

    it('calls the correct factory when multiple types are registered', () => {
      const listRegistration = makeRegistration('list');
      const cardsRegistration = makeRegistration('cards');

      registry.register(listRegistration);
      registry.register(cardsRegistration);

      registry.createBuilder(makeConfig('list'));
      registry.createBuilder(makeConfig('cards'));

      expect(listRegistration.createBuilder).toHaveBeenCalledOnce();
      expect(cardsRegistration.createBuilder).toHaveBeenCalledOnce();
    });

    it('throws after the type is deregistered', () => {
      registry.register(makeRegistration('list'));
      registry.deregister('list');
      expect(() => registry.createBuilder(makeConfig('list'))).toThrow();
    });
  });

  // ── deserialize() ───────────────────────────────────────────────────────────

  describe('deserialize()', () => {
    it('returns a ViewConfig for a registered type', () => {
      registry.register(makeRegistration('list'));
      const result = registry.deserialize({ type: 'list', name: 'Test View' });
      expect(result).toBeInstanceOf(ViewConfig);
    });

    it('delegates to the registration deserialize factory', () => {
      const registration = makeRegistration('list');
      registry.register(registration);

      const raw = { type: 'list', name: 'Test View' };
      registry.deserialize(raw);

      expect(registration.deserialize).toHaveBeenCalledOnce();
      expect(registration.deserialize).toHaveBeenCalledWith(raw);
    });

    it('throws if no registration exists for the raw type', () => {
      expect(() => registry.deserialize({ type: 'list', name: 'Test View' })).toThrow(
        'No deserializer registered for view type: list',
      );
    });

    it('throws with the correct type name in the error message', () => {
      expect(() => registry.deserialize({ type: 'cards' })).toThrow('cards');
    });

    it('calls the correct deserializer when multiple types are registered', () => {
      const listRegistration = makeRegistration('list');
      const cardsRegistration = makeRegistration('cards');

      registry.register(listRegistration);
      registry.register(cardsRegistration);

      registry.deserialize({ type: 'list', name: 'List View' });
      registry.deserialize({ type: 'cards', name: 'Cards View' });

      expect(listRegistration.deserialize).toHaveBeenCalledOnce();
      expect(cardsRegistration.deserialize).toHaveBeenCalledOnce();
    });

    it('throws after the type is deregistered', () => {
      registry.register(makeRegistration('list'));
      registry.deregister('list');
      expect(() => registry.deserialize({ type: 'list', name: 'Test View' })).toThrow();
    });

    it('passes the full raw object to the deserializer', () => {
      const registration = makeRegistration('list');
      registry.register(registration);

      const raw = { type: 'list', name: 'My View', someExtraField: 42 };
      registry.deserialize(raw);

      expect(registration.deserialize).toHaveBeenCalledWith(raw);
    });
  });

  // ── lifecycle integration ────────────────────────────────────────────────────

  describe('lifecycle integration', () => {
    it('supports a full register → use → deregister → re-register cycle', () => {
      registry.register(makeRegistration('list'));
      expect(registry.isRegistered('list')).toBe(true);

      registry.createBuilder(makeConfig('list'));
      registry.deserialize({ type: 'list', name: 'Test View' });

      registry.deregister('list');
      expect(registry.isRegistered('list')).toBe(false);

      registry.register(makeRegistration('list'));
      expect(registry.isRegistered('list')).toBe(true);
    });

    it('each registry instance is independent', () => {
      const registryA = new ViewRegistry();
      const registryB = new ViewRegistry();

      registryA.register(makeRegistration('list'));

      expect(registryA.isRegistered('list')).toBe(true);
      expect(registryB.isRegistered('list')).toBe(false);
    });

    it('all three view types can be registered and used simultaneously', () => {
      registry.register(makeRegistration('list'));
      registry.register(makeRegistration('cards'));
      registry.register(makeRegistration('table'));

      expect(() => registry.createBuilder(makeConfig('list'))).not.toThrow();
      expect(() => registry.createBuilder(makeConfig('cards'))).not.toThrow();
      expect(() => registry.createBuilder(makeConfig('table'))).not.toThrow();

      expect(() => registry.deserialize({ type: 'list' })).not.toThrow();
      expect(() => registry.deserialize({ type: 'cards' })).not.toThrow();
      expect(() => registry.deserialize({ type: 'table' })).not.toThrow();
    });
  });
});