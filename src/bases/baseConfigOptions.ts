// baseConfigOptions.ts

import { FilterGroup } from './filter';
import { Formula } from './formula';
import { PropertyDisplay } from './propertyDisplay';
//import { ViewConfigOptions } from './viewConfigOptions';

/**
 * Options for constructing a {@link BaseConfig} instance.
 * Encapsulates all top-level configuration fields for a database or collection.
 */
export interface BaseConfigOptions {
  /** The list of views defined within this configuration. Must not be empty. */
  //views: ViewConfigOptions[];

  /** An optional top-level filter group applied across the entire configuration. */
  filters?: FilterGroup;

  /** An optional list of formulas available within this configuration. */
  formulas?: Formula[];

  /**
   * An optional list of properties with their display names. Each entry overrides 
   * how a property is labeled in the UI.
   */
  properties?: PropertyDisplay[];
}