import { FilterGroup, Formula, Property } from '../types/baseTypes';
import { BaseConfig } from '../types/baseConfig';
import { ViewConfig } from '../types/viewConfig';
import { ViewBuilder } from './viewBuilder';

export class BaseBuilder {
  private filters?: FilterGroup;
  private formulas?: Formula[];
  private properties?: Map<string, string>;
  private views: ViewBuilder[];

  constructor() {
    this.views = [];
  }

  setFilter(filter: FilterGroup): this {
    this.filters = filter;
    return this;
  }

  addFormula(formula: Formula): this {
    this.formulas ??= [];
    this.formulas.push(formula);
    return this;
  }

  addProperty(property: Property, displayName: string): this {
    this.properties ??= new Map();
    this.properties.set(property.serialize(), displayName);
    return this;
  }

  addView(view: ViewBuilder): this {
    this.views.push(view);
    return this;
  }

  build(): BaseConfig {
    if (this.views.length === 0) {
      throw new Error('Base must have at least one view');
    }
    return new BaseConfig(
      this.views.map(v => v.build()),
      this.filters,
      this.formulas,
      this.properties
    );
  }
}