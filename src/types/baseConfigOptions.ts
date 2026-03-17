// baseConfigOptions.ts

import { FilterGroup, Formula } from './baseTypes';
import { ViewConfig } from './viewConfig';

/**
 * Options for constructing a {@link BaseConfig} instance.
 * Encapsulates all top-level configuration fields for a database or collection.
 */
export interface BaseConfigOptions {
  /** The list of views defined within this configuration. Must not be empty. */
  views: ViewConfig[];

  /** An optional top-level filter group applied across the entire configuration. */
  filters?: FilterGroup;

  /** An optional list of formulas available within this configuration. */
  formulas?: Formula[];

  /**
   * An optional map of serialized property keys to their display names.
   * Each entry overrides how a property is labeled in the UI.
   */
  properties?: Map<string, string>;
}