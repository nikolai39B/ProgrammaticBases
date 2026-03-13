import { BaseConfig, FilterGroup, Formula, Property, ViewConfig } from './baseTypes'
import { ViewBuilder } from './viewBuilders'

export class BaseBuilder {
  private config: Omit<BaseConfig, 'views'>
  private views: ViewBuilder[]

  constructor() {
    this.config = {};
    this.views = [];
  }

  setFilter(filter: FilterGroup): this {
    this.config.filters = filter;
    return this;
  }

  addFormula(formula: Formula): this {
    this.config.formulas ??= [];
    this.config.formulas.push(formula);
    return this;
  }

  addProperty(property: Property, displayName: string): this {
    this.config.properties ??= new Map();
    this.config.properties.set(property.serialize(), displayName);
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
    return {
      ...this.config,
      views: this.views.map(v => v.build())
    };
  }
}