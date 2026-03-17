import { FilterGroup, PropertyOrder, Property } from './baseTypes';

//-- BASE VIEW
export type ViewType = 'table' | 'cards' | 'list';

export abstract class ViewConfig {
  type: ViewType;
  name: string;
  filters?: FilterGroup;
  groupBy?: PropertyOrder;
  order?: Property[];
  sort?: PropertyOrder[];

  constructor(type: ViewType, name: string) {
    if (!name.trim()) {
      throw new Error('View name cannot be empty');
    }
    this.type = type;
    this.name = name;
  }

  serialize(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      type: this.type,
      name: this.name
    };

    if (this.filters) {
      result.filters = this.filters.serialize();
    }
    if (this.groupBy) {
      result.groupBy = this.groupBy.serialize();
    }
    if (this.order) {
      result.order = this.order.map(p => p.serialize());
    }
    if (this.sort) {
      result.sort = this.sort.map(s => s.serialize());
    }

    return result;
  }
}


//-- CARD VIEW
export type ImageFitType = 'contain' | 'cover';

export class CardViewConfig extends ViewConfig {
  cardSize?: number;
  image?: Property;
  imageFit?: ImageFitType;
  imageAspectRatio?: number;

  constructor(name: string) {
    super('cards', name);
  }

  serialize(): Record<string, unknown> {
    const result = super.serialize();

    if (this.cardSize != null) {
      result.cardSize = this.cardSize;
    }
    if (this.image) {
      result.image = this.image.serialize();
    }
    if (this.imageFit) {
      result.imageFit = this.imageFit;
    }
    if (this.imageAspectRatio != null) {
      result.imageAspectRatio = this.imageAspectRatio;
    }

    return result;
  }
}


//-- TABLE VIEW
export type RowHeightType = 'short' | 'medium' | 'tall' | 'extra-tall';

export class TableViewConfig extends ViewConfig {
  columnSize?: Map<string, number>;
  rowHeight?: RowHeightType;

  constructor(name: string) {
    super('table', name);
  }

  serialize(): Record<string, unknown> {
    const result = super.serialize();

    if (this.rowHeight) {
      result.rowHeight = this.rowHeight;
    }
    if (this.columnSize) {
      result.columnSize = Object.fromEntries(this.columnSize);
    }

    return result;
  }
}


//-- LIST VIEW
export class ListViewConfig extends ViewConfig {
  constructor(name: string) {
    super('list', name);
  }
}
