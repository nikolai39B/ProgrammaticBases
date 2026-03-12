// viewBuilders.ts

import { BaseViewConfig, CardViewConfig, TableViewConfig, ListViewConfig } from './baseTypes'
import { ViewType, ImageFitType, RowHeightType } from './baseTypes'
import { FilterGroup, Property, PropertyOrder } from './baseTypes'

// ─── View Builders ────────────────────────────────────────────────────────────

export class ViewBuilder {
  protected config: BaseViewConfig

  constructor(type: ViewType, name: string) {
    if (!name.trim()) throw new Error('View name cannot be empty')
    this.config = { type, name }
  }

  setFilter(filter: FilterGroup): this {
    this.config.filters = filter
    return this
  }

  setGroupBy(order: PropertyOrder): this {
    this.config.groupBy = order
    return this
  }

  setOrder(properties: Property[]): this {
    this.config.order = properties
    return this
  }

  addSort(order: PropertyOrder): this {
    this.config.sort ??= []
    this.config.sort.push(order)
    return this
  }

  build(): BaseViewConfig {
    return this.config
  }
}

export class CardViewBuilder extends ViewBuilder {
  constructor(name: string) {
    super('card', name)
  }

  setCardSize(size: number): this {
    (this.config as CardViewConfig).cardSize = size
    return this
  }

  setImage(property: Property): this {
    (this.config as CardViewConfig).image = property
    return this
  }

  setImageAspectRatio(aspectRatio: number): this {
    (this.config as CardViewConfig).imageAspectRatio = aspectRatio
    return this
  }

  setImageFit(fit: ImageFitType): this {
    (this.config as CardViewConfig).imageFit = fit
    return this
  }

  build(): CardViewConfig {
    return this.config as CardViewConfig
  }
}

export class TableViewBuilder extends ViewBuilder {
  constructor(name: string) {
    super('table', name)
  }

  setRowHeight(height: RowHeightType): this {
    (this.config as TableViewConfig).rowHeight = height
    return this
  }

  addColumnSize(property: Property, size: number): this {
    const c = this.config as TableViewConfig
    c.columnSize ??= new Map()
    c.columnSize.set(property.serialize(), size)
    return this
  }

  build(): TableViewConfig {
    return this.config as TableViewConfig
  }
}

export class ListViewBuilder extends ViewBuilder {
  constructor(name: string) {
    super('list', name)
  }

  build(): ListViewConfig {
    return this.config as ListViewConfig
  }
}