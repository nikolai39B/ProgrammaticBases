// viewConfigVisitor.ts
import { CardViewBuilder, ListViewBuilder, TableViewBuilder, ViewConfigBuilder } from "builders/viewConfigBuilder";
import { CardViewConfig, ListViewConfig, TableViewConfig } from "./viewConfig";

/**
 * Defines a visitor over the {@link ViewConfig} class hierarchy.
 * Implement this interface to define operations that vary by view type
 * without modifying the view config classes themselves.
 *
 * @template R - The return type of each visit method.
 */
export interface ViewConfigVisitor<R> {
  /**
   * Visits a {@link CardViewConfig}.
   *
   * @param config - The card view configuration to visit.
   * @returns A value of type `R` produced by this visit.
   */
  visitCard(config: CardViewConfig): R;

  /**
   * Visits a {@link TableViewConfig}.
   *
   * @param config - The table view configuration to visit.
   * @returns A value of type `R` produced by this visit.
   */
  visitTable(config: TableViewConfig): R;

  /**
   * Visits a {@link ListViewConfig}.
   *
   * @param config - The list view configuration to visit.
   * @returns A value of type `R` produced by this visit.
   */
  visitList(config: ListViewConfig): R;
}

/**
 * A {@link ViewConfigVisitor} that produces a {@link ViewConfigBuilder} for each view type.
 * Used to obtain a pre-populated builder from an existing view config,
 * allowing it to be modified and rebuilt without constructing a builder from scratch.
 */
export const builderFactory: ViewConfigVisitor<ViewConfigBuilder> = {
  visitCard: (config) => new CardViewBuilder(config),
  visitTable: (config) => new TableViewBuilder(config),
  visitList: (config) => new ListViewBuilder(config),
};