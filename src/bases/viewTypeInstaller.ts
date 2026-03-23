/**
 * Base class for registering a view type with the application.
 *
 * Implementors must provide a unique {@link type} and a {@link createBuilder}
 * factory. All other hooks have sensible defaults that can be overridden when
 * needed.
 *
 * @example
 * ```typescript
 * class GanttViewInstaller extends ViewTypeInstaller {
 *   readonly type = 'gantt';
 *
 *   createBuilder(config: ViewConfig) {
 *     return new GanttViewBuilder(config);
 *   }
 * }
 *
 * new GanttViewInstaller().run();
 * ```
 */
abstract class ViewTypeInstaller {
  /**
   * The unique identifier for the view type being installed.
   * Must match a key in {@link ViewTypeRegistry}.
   */
  abstract readonly type: keyof ViewTypeRegistry;

  /**
   * Creates a {@link ViewBuilder} for this view type.
   *
   * Called once per view instance when the builder factory is invoked.
   *
   * @param config - The configuration for the view being built.
   * @returns A new builder instance for the given config.
   */
  abstract createBuilder(config: ViewConfig): ViewBuilder;

  /**
   * Returns the icon identifier for this view type.
   *
   * Override this method to provide a custom icon, for example based on
   * a injected theme service or a property of the view config.
   * Defaults to `'default-icon'`.
   *
   * @param config - The configuration for the view being built.
   * @returns An icon identifier string.
   */
  createIcon(config: ViewConfig): string {
    return 'default-icon';
  }

  /**
   * Registers this view type with all relevant factories and the view type
   * registry. Call this once during application or plugin initialisation.
   *
   * Registration order is managed by this method — subclasses should not
   * need to override it.
   */
  run(): void {
    viewTypeRegistry.register(this.type);
    builderFactory.register(this.type, (config) => this.createBuilder(config));
    iconFactory.register(this.type, (config) => this.createIcon(config));
  }

  /**
   * Removes this view type from all factories and the view type registry.
   * Call this when the view type is no longer needed, for example during
   * plugin teardown.
   *
   * Unregistration order is the reverse of {@link run} to avoid leaving
   * partially registered state.
   */
  uninstall(): void {
    builderFactory.unregister(this.type);
    iconFactory.unregister(this.type);
    viewTypeRegistry.unregister(this.type);
  }
}