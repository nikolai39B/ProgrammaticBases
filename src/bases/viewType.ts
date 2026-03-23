// viewType.ts

import { ViewConfig } from "./viewConfig";
import { ViewConfigBuilder } from "./viewConfigBuilder";
import { ViewConfigOptions } from "./viewConfigOptions";

// ─── Registry ────────────────────────────────────────────────────────────────

export interface ViewTypeRegistry {
  'cards': true;
  'table': true;
  'list':  true;
}
export type ViewType = keyof ViewTypeRegistry;

interface ViewRegistration<K extends keyof ViewTypeRegistry, C extends ViewConfigOptions> {
  type: K;
  createBuilder: (options: C) => ViewConfigBuilder;
}

//interface ViewRegistration<K extends keyof ViewTypeRegistry> {
//  type: K;
//  builder: ViewConfigBuilder<K>;
//}

class ViewRegistry {
  private registrations = new Map<keyof ViewTypeRegistry, ViewRegistration<keyof ViewTypeRegistry, ViewConfigOptions>>();

  register<K extends keyof ViewTypeRegistry, C extends ViewConfigOptions>(
    registration: ViewRegistration<K, C>
  ): void {
    this.registrations.set(registration.type, registration);
  }

  createBuilder(config: ViewConfig): ViewConfigBuilder {
    const registration = this.registrations.get(config.type);
    if (!registration) throw new Error(`No builder registered for view type: ${config.type}`);
    return registration.createBuilder(config.options);
  }
}

//class ViewRegistry {
//  private registrations = new Map<keyof ViewTypeRegistry, ViewRegistration<any>>();
//
//  register<K extends keyof ViewTypeRegistry>(registration: ViewRegistration<K>): void {
//    this.registrations.set(registration.type, registration);
//  }
//
//  unregister(type: keyof ViewTypeRegistry): void {
//    this.registrations.delete(type);
//  }
//
//  isViewType(value: string): value is keyof ViewTypeRegistry {
//    return this.registrations.has(value as keyof ViewTypeRegistry);
//  }
//
//  getBuilder<K extends keyof ViewTypeRegistry>(type: K): ViewConfigBuilder<K> {
//    return this.registrations.get(type)?.builder;
//  }
//}
