// baseTypes.ts

//-- PROPERTY
export type PropertySource = 'file' | 'note' | 'formula'

export class Property {
  source: PropertySource
  name: string

  constructor(name: string, source: PropertySource = 'note') {
    this.source = source;
    this.name = name;
  }

  serialize(): string {
    return `${this.source}.${this.name}`;
  }

  equals(other: Property): boolean {
    return this.source === other.source && this.name === other.name;
  }
}


//-- FILTER
export type FilterOperator = 'and' | 'or' | 'none'
export type FilterLeaf = string

export class FilterGroup {
  operator: FilterOperator;
  children: Filter[];

  constructor(operator: FilterOperator, ...children: Filter[]) {
    this.operator = operator;
    this.children = children;
  }

  serialize(): Record<string, unknown> {
    return {
      [this.operator]: this.children.map(child =>
        typeof child === 'string' ? child : child.serialize()
      )
    };
  }
}

export type Filter = FilterLeaf | FilterGroup;


//-- SORTING & GROUPING
export type Direction = 'ASC' | 'DESC';

export class PropertyOrder {
  property: Property;
  direction: Direction;

  constructor(property: Property, direction: Direction) {
    this.property = property;
    this.direction = direction;
  }

  serialize(): Record<string, unknown> {
    return {
      property: this.property.serialize(),
      direction: this.direction
    };
  }
}


//-- FORMULAS
export class Formula {
  name: string;
  content: string;

  constructor(name: string, content: string) {
    this.name = name;
    this.content = content;
  }

  serialize(): Record<string, string> {
    return { [this.name]: this.content };
  }
}
