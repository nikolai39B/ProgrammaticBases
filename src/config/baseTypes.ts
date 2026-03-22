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

  static deserialize(raw: string): Property {
    const dotIndex = raw.indexOf('.');
    if (dotIndex === -1) {
      throw new Error(`Invalid property string: "${raw}"`);
    }
    const source = raw.slice(0, dotIndex) as PropertySource;
    const name = raw.slice(dotIndex + 1);
    return new Property(name, source);
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

  static deserialize(raw: unknown): FilterGroup {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(`Invalid FilterGroup: ${JSON.stringify(raw)}`);
    }

    const obj = raw as Record<string, unknown>;

    const operators: FilterOperator[] = ['and', 'or', 'none'];
    const operator = operators.find(op => op in obj);
    if (!operator) {
      throw new Error(`Expected one of ${operators.join(', ')}`);
    }

    const rawChildren = obj[operator];
    if (!Array.isArray(rawChildren)) {
      throw new Error(`Expected an array, got: ${JSON.stringify(rawChildren)}`);
    }
    const children = rawChildren.map(Filter.deserialize);
    return new FilterGroup(operator, ...children);
  }
}

export type Filter = FilterLeaf | FilterGroup;

// Namespace to hold the Filter deserializer since Filter is a union type
export namespace Filter {
  export function deserialize(raw: unknown): Filter {
    if (typeof raw === 'string') {
      return raw as FilterLeaf;
    }
    return FilterGroup.deserialize(raw);
  }
}

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

  static deserialize(raw: Record<string, unknown>): PropertyOrder {
    const property = Property.deserialize(raw.property as string);
    const direction = raw.direction as Direction;
    if (direction !== 'ASC' && direction !== 'DESC') {
      throw new Error(`Invalid direction: "${direction}"`);
    }
    return new PropertyOrder(property, direction);
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

  static deserialize(raw: Record<string, string>): Formula[] {
    return Object.entries(raw).map(([name, content]) => new Formula(name, content));
  }
}
