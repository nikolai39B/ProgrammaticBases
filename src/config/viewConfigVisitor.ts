// viewConfigVisitor.ts
import { CardViewBuilder, ListViewBuilder, TableViewBuilder, ViewConfigBuilder } from "builders/viewConfigBuilder";
import { CardViewConfig, ListViewConfig, TableViewConfig } from "./viewConfig";

export interface ViewConfigVisitor<R> {
  visitCard(config: CardViewConfig): R;
  visitTable(config: TableViewConfig): R;
  visitList(config: ListViewConfig): R;
}

export const builderFactory: ViewConfigVisitor<ViewConfigBuilder> = {
  visitCard: (config) => new CardViewBuilder(config),
  visitTable: (config) => new TableViewBuilder(config),
  visitList: (config) => new ListViewBuilder(config),
};
