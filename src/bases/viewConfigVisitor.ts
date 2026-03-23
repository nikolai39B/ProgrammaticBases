// viewConfigVisitor.ts

import { ViewConfig } from "./viewConfig";
import { ViewType } from "./viewType";

/**
 * A function that visits a specific {@link ViewConfig} subclass instance
 * and produces a value of type `R`.
 *
 * @template T - The specific {@link ViewConfig} subclass this handler accepts.
 * @template R - The return type of the handler.
 */
type ViewConfigHandler<T extends ViewConfig, R> = (config: T) => R;

/**
 * A registry-based visitor over the {@link ViewConfig} class hierarchy.
 * Maps each {@link ViewType} to a handler function, allowing plugins to
 * register handlers for their own view types without modifying a central interface.
 *
 * @template R - The return type of each handler.
 */
export class ViewConfigVisitor<R> {

  private handlers = new Map<ViewType, ViewConfigHandler<any, R>>();

  /**
   * Registers a handler for a specific view type.
   * If a handler is already registered for the given type, it is replaced.
   *
   * @param type - The view type to handle.
   * @param handler - The function to invoke when a config of this type is visited.
   * @returns `this`, to allow chaining.
   */
  register<T extends ViewConfig>(
    type: ViewType,
    handler: ViewConfigHandler<T, R>
  ): this {
    this.handlers.set(type, handler);
    return this;
  }

  /**
   * Visits a {@link ViewConfig} instance by dispatching to the registered handler
   * for its view type.
   *
   * @param config - The view config to visit.
   * @returns The value produced by the handler.
   * @throws {Error} If no handler is registered for the config's view type.
   */
  visit(config: ViewConfig): R {
    const handler = this.handlers.get(config.type);
    if (!handler) {
      throw new Error(`No handler registered for view type '${config.type}'`);
    }
    return handler(config);
  }
}










/**
 * A {@link ViewConfigVisitor} that produces a {@link ViewConfigBuilder} for each view type.
 * Used to obtain a pre-populated builder from an existing view config,
 * allowing it to be modified and rebuilt without constructing a builder from scratch.
 */
export const builderFactory: ViewConfigVisitor<ViewConfigBuilder> = {
  visitCard: (config) => new CardViewBuilder(config),
  visitTable: (config) => new TableViewBuilder(config),
  visitList: (config) => new ListViewBuilder(config),
};