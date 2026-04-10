// baseConfigOptions.ts

import { FilterGroup } from 'primitives/filter';
import { Formula } from 'primitives/formula';
import { PropertyDisplay } from 'primitives/propertyDisplay';
import { BaseMetadata } from './baseMetadata';

/**
 * Options for constructing a {@link BaseConfig} instance.
 * Encapsulates all top-level configuration fields for a database or collection.
 */
export interface BaseConfigOptions {
  /** An optional top-level filter group applied across the entire configuration. */
  filters?: FilterGroup;

  /** An optional list of formulas available within this configuration. */
  formulas?: Formula[];

  /**
   * An optional list of properties with their display names. Each entry overrides 
   * how a property is labeled in the UI.
   */
  properties?: PropertyDisplay[];

  /** Plugin-managed metadata stored in the `pb-metadata` key. */
  metadata?: BaseMetadata;
}