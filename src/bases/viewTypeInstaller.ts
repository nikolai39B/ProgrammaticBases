import { ViewConfig } from "./viewConfig";
import { ViewConfigBuilder } from "./viewConfigBuilder";
import { ViewRegistry, ViewType, ViewTypeRegistry } from "./viewType";

// ─── View Type Installer ─────────────────────────────────────────────────────

/**
 * Minimal lifecycle interface for view type installers.
 *
 * This interface intentionally exposes only {@link install} and
 * {@link uninstall} so that installers can be stored in a uniform collection
 * without losing type safety. Do not add methods that expose the generic type
 * parameters of {@link ViewTypeInstallerBase}.
 *
 * The {@link ViewRegistry} is passed explicitly at call time rather than
 * injected at construction, keeping installers stateless and easy to test.
 *
 * @example
 * ```typescript
 * const installers: ViewTypeInstaller[] = [
 *   new CardViewInstaller(),
 *   new ListViewInstaller(),
 * ];
 *
 * installers.forEach(i => i.install(viewRegistry));
 * ```
 */
export interface ViewTypeInstaller {
  /**
   * Registers this view type with the given registry.
   *
   * Should be called once during plugin or application initialisation.
   *
   * @param viewRegistry - The registry to register this view type with.
   */
  install(viewRegistry: ViewRegistry): void;

  /**
   * Removes this view type from the given registry.
   *
   * Should be called during plugin teardown or when the view type is no
   * longer needed. Must be called with the same registry instance that was
   * passed to {@link install}.
   *
   * @param viewRegistry - The registry to deregister this view type from.
   */
  uninstall(viewRegistry: ViewRegistry): void;
}

/**
 * Base class for registering a view type with the application.
 *
 * Implementors must provide a unique {@link type} and a {@link createBuilder}
 * factory. The {@link install} and {@link uninstall} lifecycle methods are
 * implemented here and should not need to be overridden — customise
 * {@link createBuilder} instead.
 *
 * Instances should be stored and managed through the {@link ViewTypeInstaller}
 * interface to avoid exposing the generic type parameters to call sites that
 * only need lifecycle control.
 *
 * The {@link ViewRegistry} is accepted as a parameter at call time rather than
 * stored at construction, keeping subclasses stateless and decoupled from any
 * specific registry instance.
 *
 * @typeParam K - The unique view type key, constrained to {@link ViewType}.
 * @typeParam C - The view configuration type, constrained to {@link ViewConfig}.
 *
 * @example
 * ```typescript
 * class GanttViewInstaller extends ViewTypeInstallerBase<'gantt', GanttViewConfig> {
 *   readonly type = 'gantt' as const;
 *
 *   createBuilder(config: GanttViewConfig): GanttViewBuilder {
 *     return new GanttViewBuilder(config);
 *   }
 * }
 *
 * const installer = new GanttViewInstaller();
 * installer.install(viewRegistry);
 * ```
 */
export abstract class ViewTypeInstallerBase<K extends ViewType, C extends ViewConfig>
  implements ViewTypeInstaller {

  /**
   * The unique identifier for the view type being installed.
   * Must match a key in {@link ViewTypeRegistry}.
   */
  abstract readonly type: K;

  /**
   * Creates a {@link ViewConfigBuilder} for this view type.
   *
   * Called by the builder factory each time a new view instance is created.
   * Implementations should return a fresh builder instance on every call.
   *
   * @param config - The configuration for the view being built.
   * @returns A new builder instance initialised with the given config.
   */
  abstract createBuilder(config: C): ViewConfigBuilder;

  /**
   * Registers this view type with the given registry.
   *
   * Constructs a registration entry from {@link type} and {@link createBuilder}
   * and passes it to the registry. Call this once during application or plugin
   * initialisation.
   *
   * Subclasses should not need to override this method — customise
   * {@link createBuilder} instead.
   *
   * @param viewRegistry - The registry to register this view type with.
   */
  install(viewRegistry: ViewRegistry): void {
    const registration = {
      type: this.type,
      createBuilder: (config: C) => this.createBuilder(config)
    };

    viewRegistry.register(registration);
  }

  /**
   * Removes this view type from the given registry.
   *
   * Call this during plugin teardown or when the view type is no longer
   * needed. This is the logical inverse of {@link install} and should be
   * called with the same registry instance.
   *
   * Subclasses should not need to override this method.
   *
   * @param viewRegistry - The registry to deregister this view type from.
   */
  uninstall(viewRegistry: ViewRegistry): void {
    viewRegistry.deregister(this.type);
  }
}