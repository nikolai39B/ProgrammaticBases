// viewConfigDispatcher.ts

import { ViewConfig } from "./viewConfig";
import { ViewType } from "./viewType";

/**
 * A registry-based dispatcher over the {@link ViewConfig} class hierarchy.
 * Maps each {@link ViewType} to a handler function, allowing consumers to
 * register handlers for view types without modifying a central interface.
 *
 * @template R - The return type of each handler.
 */
export class ViewConfigDispatcher<R> {

  private handlers = new Map<ViewType, ViewConfigDispatcher.HandlerFn<any, R>>();

  /**
   * Registers a handler for a specific view type.
   * If a handler is already registered for the given type, it is replaced.
   *
   * @param type - The view type to handle.
   * @param handler - The function to invoke when a config of this type is dispatched.
   * @returns `this`, to allow chaining.
   */
  register<T extends ViewConfig>(
    type: ViewType,
    handler: ViewConfigDispatcher.HandlerFn<T, R>
  ): this {
    this.handlers.set(type, handler);
    return this;
  }

  /**
   * Dispatches a {@link ViewConfig} instance to the registered handler
   * for its view type.
   *
   * @param config - The view config to dispatch.
   * @returns The value produced by the handler.
   * @throws {Error} If no handler is registered for the config's view type.
   */
  dispatch(config: ViewConfig): R {
    const handler = this.handlers.get(config.type);
    if (!handler) {
      throw new Error(`No handler registered for view type '${config.type}'`);
    }
    return handler(config);
  }
}

export namespace ViewConfigDispatcher {

  /**
   * A function that handles a specific {@link ViewConfig} subclass instance
   * and produces a value of type `R`.
   *
   * @template T - The specific {@link ViewConfig} subclass this handler accepts.
   * @template R - The return type of the handler.
   */
  export type HandlerFn<T extends ViewConfig, R> = (config: T) => R;
}