import { BaseBuilder } from './builders/baseBuilder';
import { CardViewBuilder, TableViewBuilder, ListViewBuilder } from './builders/viewBuilder';
import { FilterGroup, Formula, Property } from './types/baseTypes';

export function debug() {
  let viewBuilder = new CardViewBuilder('Test');
  viewBuilder.setFilter(new FilterGroup('and', 'file.hasProperty("year_rank")'));

  let baseBuilder = new BaseBuilder();
  baseBuilder.addView(viewBuilder);
  baseBuilder.addFormula(new Formula("Rank Title", "file.properties[\"rank\"] + \" \" + file.properties[\"name\"]"))
  
  let base = baseBuilder.build();
  let yaml = base.serialize();
  return yaml;
}