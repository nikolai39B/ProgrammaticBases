// viewTypeInstaller.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewRegistry } from 'views/viewRegistry';
import { ViewTypeInstallerBase } from 'views/viewTypeInstaller';
import { ViewConfig } from 'views/viewConfig';
import { ViewConfigBuilder } from 'views/viewConfigBuilder';
import { ViewConfigOptions } from 'views/viewConfigOptions';
import { ListViewInstaller } from 'views/listViewInstaller';
import { ListViewConfig } from 'views/listViewConfig';
import { CardViewInstaller } from 'views/cardViewInstaller';
import { CardViewConfig } from 'views/cardViewConfig';
import { TableViewInstaller } from 'views/tableViewInstaller';
import { TableViewConfig } from 'views/tableViewConfig';
import { ViewType, ViewTypeRegistry } from 'views/viewType';

// ─── Test Doubles ─────────────────────────────────────────────────────────────

/**
 * Minimal concrete ViewConfig stub — reused across all installer tests.
 */
class StubViewConfig extends ViewConfig {
  constructor(options: ViewConfigOptions) {
    super(options);
  }
}

/**
 * Minimal concrete ViewConfigBuilder stub.
 */
class StubViewBuilder implements ViewConfigBuilder {
  build(): ViewConfig {
    return new StubViewConfig({ name: 'stub' } as ViewConfigOptions);
  }
}

/**
 * Minimal concrete installer used to test ViewTypeInstallerBase in isolation,
 * without depending on any real view type.
 *
 * Uses 'list' as the type key so no declaration merging is needed — it is
 * already present in ViewTypeRegistry.
 */
class StubInstaller extends ViewTypeInstallerBase<'list'> {
  readonly type = 'list' as const;

  createBuilder(_config: ListViewConfig): ViewConfigBuilder {
    return new StubViewBuilder();
  }

  deserialize(_raw: Record<string, unknown>): ListViewConfig {
    return ListViewConfig.deserialize({ type: 'list', name: 'stub' });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Runs the shared install / uninstall contract against any installer + config pair.
 * Avoids duplicating the same lifecycle assertions across all three concrete suites.
 */
function describeInstallerContract<K extends ViewType>(
  label: string,
  createInstaller: () => ViewTypeInstallerBase<K>,
  createConfig: () => ViewTypeRegistry[K],
): void {
  describe(label, () => {
    let registry: ViewRegistry;
    let installer: ViewTypeInstallerBase<K>;

    beforeEach(() => {
      registry = new ViewRegistry();
      installer = createInstaller();
    });

    // ── install() ─────────────────────────────────────────────────────────────

    describe('install()', () => {
      it('registers the view type with the registry', () => {
        installer.install(registry);
        expect(registry.isRegistered(installer.type)).toBe(true);
      });

      it('throws if the same type is installed twice', () => {
        installer.install(registry);
        expect(() => installer.install(registry)).toThrow();
      });
    });

    // ── uninstall() ───────────────────────────────────────────────────────────

    describe('uninstall()', () => {
      it('deregisters the view type from the registry', () => {
        installer.install(registry);
        installer.uninstall(registry);
        expect(registry.isRegistered(installer.type)).toBe(false);
      });

      it('is a no-op if the type was never installed', () => {
        expect(() => installer.uninstall(registry)).not.toThrow();
      });

      it('allows reinstalling after uninstall', () => {
        installer.install(registry);
        installer.uninstall(registry);
        installer.install(registry);
        expect(registry.isRegistered(installer.type)).toBe(true);
      });
    });

    // ── createBuilder() ───────────────────────────────────────────────────────

    describe('createBuilder()', () => {
      it('returns a ViewConfigBuilder', () => {
        const builder = installer.createBuilder(createConfig());
        expect(builder).toBeDefined();
        expect(typeof builder.build).toBe('function');
      });

      it('returns a fresh instance on every call', () => {
        const config = createConfig();
        const a = installer.createBuilder(config);
        const b = installer.createBuilder(config);
        expect(a).not.toBe(b);
      });
    });

    // ── deserialize() ─────────────────────────────────────────────────────────

    describe('deserialize()', () => {
      it('returns a ViewConfig instance', () => {
        const result = installer.deserialize({ type: installer.type, name: 'Test View' });
        expect(result).toBeInstanceOf(ViewConfig);
      });

      it('preserves the name field', () => {
        const result = installer.deserialize({ type: installer.type, name: 'My View' });
        expect(result.name).toBe('My View');
      });
    });

    // ── registry integration ──────────────────────────────────────────────────

    describe('registry integration', () => {
      it('registry can create a builder after install', () => {
        installer.install(registry);
        const config = createConfig();
        expect(() => registry.createBuilder(config)).not.toThrow();
      });

      it('registry cannot create a builder after uninstall', () => {
        installer.install(registry);
        installer.uninstall(registry);
        expect(() => registry.createBuilder(createConfig())).toThrow();
      });

      it('registry can deserialize after install', () => {
        installer.install(registry);
        const result = registry.deserialize({ type: installer.type, name: 'Test View' });
        expect(result).toBeInstanceOf(ViewConfig);
      });

      it('registry cannot deserialize after uninstall', () => {
        installer.install(registry);
        installer.uninstall(registry);
        expect(() => registry.deserialize({ type: installer.type, name: 'Test View' })).toThrow();
      });
    });
  });
}

// ─── Base Installer Tests ─────────────────────────────────────────────────────

describe('ViewTypeInstallerBase', () => {
  let registry: ViewRegistry;
  let installer: StubInstaller;

  beforeEach(() => {
    registry = new ViewRegistry();
    installer = new StubInstaller();
  });

  it('exposes the correct type', () => {
    expect(installer.type).toBe('list');
  });

  it('install delegates to registry.register', () => {
    const spy = vi.spyOn(registry, 'register');
    installer.install(registry);
    expect(spy).toHaveBeenCalledOnce();
  });

  it('uninstall delegates to registry.deregister', () => {
    const spy = vi.spyOn(registry, 'deregister');
    installer.uninstall(registry);
    expect(spy).toHaveBeenCalledWith('list');
  });

  it('install passes a registration with the correct type', () => {
    const spy = vi.spyOn(registry, 'register');
    installer.install(registry);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: 'list' }));
  });

  it('install passes a registration with a createBuilder function', () => {
    const spy = vi.spyOn(registry, 'register');
    installer.install(registry);
    const registration = spy.mock.calls[0]![0];
    expect(typeof registration.createBuilder).toBe('function');
  });

  it('install passes a registration with a deserialize function', () => {
    const spy = vi.spyOn(registry, 'register');
    installer.install(registry);
    const registration = spy.mock.calls[0]![0];
    expect(typeof registration.deserialize).toBe('function');
  });
});

// ─── Concrete Installer Contract Tests ───────────────────────────────────────

describe('ListViewInstaller', () => {
  describeInstallerContract(
    'contract',
    () => new ListViewInstaller(),
    () => ListViewConfig.deserialize({ type: 'list', name: 'Test View' }),
  );

  it('exposes the correct type', () => {
    expect(new ListViewInstaller().type).toBe('list');
  });

  it('createBuilder returns a ListViewBuilder', async () => {
    const { ListViewBuilder } = await import('views/listViewBuilder');
    const config = ListViewConfig.deserialize({ type: 'list', name: 'Test View' });
    expect(new ListViewInstaller().createBuilder(config)).toBeInstanceOf(ListViewBuilder);
  });

  it('deserialize returns a ListViewConfig', () => {
    const result = new ListViewInstaller().deserialize({ type: 'list', name: 'Test View' });
    expect(result).toBeInstanceOf(ListViewConfig);
  });
});

describe('CardViewInstaller', () => {
  describeInstallerContract(
    'contract',
    () => new CardViewInstaller(),
    () => CardViewConfig.deserialize({ type: 'cards', name: 'Test View' }),
  );

  it('exposes the correct type', () => {
    expect(new CardViewInstaller().type).toBe('cards');
  });

  it('createBuilder returns a CardViewBuilder', async () => {
    const { CardViewBuilder } = await import('views/cardViewBuilder');
    const config = CardViewConfig.deserialize({ type: 'cards', name: 'Test View' });
    expect(new CardViewInstaller().createBuilder(config)).toBeInstanceOf(CardViewBuilder);
  });

  it('deserialize returns a CardViewConfig', () => {
    const result = new CardViewInstaller().deserialize({ type: 'cards', name: 'Test View' });
    expect(result).toBeInstanceOf(CardViewConfig);
  });
});

describe('TableViewInstaller', () => {
  describeInstallerContract(
    'contract',
    () => new TableViewInstaller(),
    () => TableViewConfig.deserialize({ type: 'table', name: 'Test View' }),
  );

  it('exposes the correct type', () => {
    expect(new TableViewInstaller().type).toBe('table');
  });

  it('createBuilder returns a TableViewBuilder', async () => {
    const { TableViewBuilder } = await import('views/tableViewBuilder');
    const config = TableViewConfig.deserialize({ type: 'table', name: 'Test View' });
    expect(new TableViewInstaller().createBuilder(config)).toBeInstanceOf(TableViewBuilder);
  });

  it('deserialize returns a TableViewConfig', () => {
    const result = new TableViewInstaller().deserialize({ type: 'table', name: 'Test View' });
    expect(result).toBeInstanceOf(TableViewConfig);
  });
});