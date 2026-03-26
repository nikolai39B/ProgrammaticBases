// viewType.ts
import { ViewConfig } from "./viewConfig";
import { ViewConfigBuilder } from "./viewConfigBuilder";
import { ViewConfigOptions } from "./viewConfigOptions";
import { ViewType, ViewTypeRegistry } from "./viewType";

// ─── Registration ────────────────────────────────────────────────────────────

/**
 * Describes a registered view type and its builder factory.
 *
 * A registration ties a unique view type key to the factory function
 * responsible for producing a {@link ViewConfigBuilder} for that type.
 * Registrations are created internally by {@link ViewTypeInstallerBase} and
 * should not need to be constructed manually.
 *
 * @typeParam K - The unique view type key, constrained to {@link ViewType}.
 * @typeParam C - The view configuration type, constrained to {@link ViewConfig}.
 */
export interface ViewRegistration<K extends ViewType, C extends ViewConfig> {
  /** The unique identifier for this view type. */
  type: K;

  /**
   * Factory function that produces a {@link ViewConfigBuilder} for this view type.
   *
   * Called once per view instance. Implementations should return a fresh
   * builder on every invocation.
   *
   * @param config - The configuration for the view being built.
   * @returns A new builder instance initialised with the given config.
   */
  createBuilder: (config: C) => ViewConfigBuilder;

  /**
   * Deserializes a plain object into a {@link ViewConfig} instance.
   *
   * @param raw - The raw object to deserialize.
   * @returns The deserialized {@link ViewConfig} instance.
   */
  deserialize: (raw: Record<string, unknown>) => ViewConfig;
}

/**
 * Central registry for view types.
 *
 * Maintains a map of {@link ViewRegistration} entries keyed by {@link ViewType}.
 * Each view type may only be registered once — attempting to register a type
 * that is already present will throw. Deregistration is always safe and is a
 * no-op if the type is not currently registered.
 *
 * The registry is the single source of truth for which view types are
 * available at runtime. It is responsible for enforcing uniqueness; installers
 * should not duplicate that check.
 *
 * @example
 * ```typescript
 * const registry = new ViewRegistry();
 *
 * registry.register({ type: 'cards', createBuilder: config => new CardsViewBuilder(config) });
 *
 * const builder = registry.createBuilder({ type: 'cards', ... });
 * ```
 */
export class ViewRegistry {
  private registrations = new Map<ViewType, ViewRegistration<ViewType, ViewConfig>>();

  /**
   * Registers a view type with the registry.
   *
   * The registration must include a unique {@link ViewType} key and a
   * {@link ViewRegistration.createBuilder} factory. If the type is already
   * registered, an error is thrown — use {@link isRegistered} to check first
   * if conditional registration is needed.
   *
   * @param registration - The registration entry to add.
   * @throws {Error} If a registration for the given type already exists.
   */
  register<K extends ViewType, C extends ViewConfig>(registration: ViewRegistration<K, C>): void {
    if (this.isRegistered(registration.type)) {
      throw new Error(`View type '${registration.type}' is already registered.`);
    }

    this.registrations.set(registration.type, registration);
  }

  /**
   * Removes a view type from the registry.
   *
   * This is the logical inverse of {@link register}. If the type is not
   * currently registered, this method is a no-op — no error is thrown.
   *
   * @param type - The view type key to remove.
   */
  deregister(type: ViewType): void {
    this.registrations.delete(type);
  }

  /**
   * Returns whether a view type is currently registered.
   *
   * Use this to guard calls to {@link register} or {@link deregister} when
   * conditional registration is needed.
   *
   * @param type - The view type key to check.
   * @returns `true` if the type is registered, `false` otherwise.
   */
  isRegistered(type: ViewType): boolean {
    return this.registrations.has(type);
  }

  /**
   * Creates a {@link ViewConfigBuilder} for the view type described by the
   * given config.
   *
   * Looks up the registration for `config.type` and delegates to its
   * {@link ViewRegistration.createBuilder} factory. Throws if no registration
   * is found, so callers can assume a valid builder is always returned on
   * success.
   *
   * @param config - The configuration for the view to build. The `type` field
   *   is used to look up the correct registration.
   * @returns A new builder instance for the given config.
   * @throws {Error} If no registration exists for `config.type`.
   */
  createBuilder(config: ViewConfig): ViewConfigBuilder {
    const registration = this.registrations.get(config.type);
    if (!registration) {
      throw new Error(`No builder registered for view type: ${config.type}`);
    }
    return registration.createBuilder(config);
  }
  
  /**
   * Deserializes a plain object into a {@link ViewConfig} instance using the
   * registered deserializer for the given view type.
   *
   * @param raw - The raw object to deserialize. Must contain a `type` field
   *   matching a key in {@link ViewTypeRegistry}.
   * @returns The deserialized {@link ViewConfig} instance.
   *
   * @throws {Error} If no deserializer is registered for the given view type.
   */
  deserialize(raw: Record<string, unknown>): ViewConfig {
    const registration = this.registrations.get(raw.type as keyof ViewTypeRegistry);
    if (!registration || !registration.deserialize) {
      throw new Error(`No deserializer registered for view type: ${raw.type}`);
    }
    return registration.deserialize(raw);
  }
}