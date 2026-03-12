// baseTypes.ts

// ─── Core Types ───────────────────────────────────────────────────────────────
export type PropertySource = 'file' | 'note' | 'formula'

export class Property {
  source: PropertySource
  name: string

  constructor(name: string, source: PropertySource = 'note') {
    this.source = source
    this.name = name
  }

  serialize(): string {
    return `${this.source}.${this.name}`
  }

  equals(other: Property): boolean {
    return this.source === other.source && this.name === other.name
  }
}

// ─── Filters ──────────────────────────────────────────────────────────────────
export type FilterOperator = 'and' | 'or' | 'none'
export type FilterLeaf = string

export interface FilterGroup {
  operator: FilterOperator
  children: Filter[]
}

export type Filter = FilterLeaf | FilterGroup

export function createFilterGroup(operator: FilterOperator, ...children: Filter[]): FilterGroup {
  return { operator, children }
}

// ─── Sorting & Grouping ───────────────────────────────────────────────────────
export interface PropertyOrder {
  property: Property
  direction: 'ASC' | 'DESC'
}

// ─── Formulas ─────────────────────────────────────────────────────────────────
export interface Formula {
  name: string
  content: string
}

// ─── Views ────────────────────────────────────────────────────────────────────
export type ViewType = 'table' | 'card' | 'list'
export type ImageFitType = 'contain' | 'cover'
export type RowHeightType = 'short' | 'medium' | 'tall' | 'extra-tall'

export interface BaseViewConfig {
  type: ViewType
  name: string
  filters?: FilterGroup
  groupBy?: PropertyOrder
  order?: Property[]
  sort?: PropertyOrder[]
}

export interface CardViewConfig extends BaseViewConfig {
  type: 'card'
  cardSize?: number
  image?: Property
  imageFit?: ImageFitType
  imageAspectRatio?: number
}

export interface TableViewConfig extends BaseViewConfig {
  type: 'table'
  columnSize?: Map<string, number>
  rowHeight?: RowHeightType
}

export interface ListViewConfig extends BaseViewConfig {
  type: 'list'
}

export type ViewConfig = CardViewConfig | TableViewConfig | ListViewConfig

// ─── Base ─────────────────────────────────────────────────────────────────────
export interface BaseConfig {
  filters?: FilterGroup
  formulas?: Formula[]
  properties?: Map<string, string>  // key is property.serialize(), value is displayName
  views: ViewConfig[]
}