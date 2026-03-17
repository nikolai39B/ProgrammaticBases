import { FilterGroup, Formula } from './baseTypes';
import { ViewConfig } from './viewConfig';
import * as yaml from 'js-yaml';

export class BaseConfig {
  filters?: FilterGroup;
  formulas?: Formula[];
  properties?: Map<string, string>;
  views: ViewConfig[];

  constructor(
    views: ViewConfig[],
    filters?: FilterGroup,
    formulas?: Formula[],
    properties?: Map<string, string>
  ) {
    this.views = views;
    this.filters = filters;
    this.formulas = formulas;
    this.properties = properties;
  }

  serialize(): string {
    const obj: Record<string, unknown> = {};  

    // top-level filter group
    if (this.filters) {
      obj.filters = this.filters.serialize();
    }  

    // flatten formulas into a single name → content record
    if (this.formulas && this.formulas.length > 0) {
      const formulas: Record<string, string> = {};
      for (const formula of this.formulas) {
        Object.assign(formulas, formula.serialize());
      }
      obj.formulas = formulas;
    }  

    // flatten properties into serializedProperty → { displayName } record
    if (this.properties && this.properties.size > 0) {
      const properties: Record<string, { displayName: string }> = {};
      this.properties.forEach((displayName, serializedProperty) => {
        properties[serializedProperty] = { displayName };
      });
      obj.properties = properties;
    }  

    // serialize each view and collect into array
    obj.views = this.views.map(v => v.serialize());  

    return yaml.dump(obj, { lineWidth: -1 });
  }
}