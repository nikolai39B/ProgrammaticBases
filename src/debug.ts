import { BaseBuilder } from './builders/baseConfigBuilder';
import { CardViewBuilder, TableViewBuilder, ListViewBuilder } from './builders/viewConfigBuilder';
import { FilterGroup, Formula, Property } from './types/baseTypes';

export function debugGame() {
  let viewBuilder = new CardViewBuilder();
  viewBuilder.setName('Game');
  viewBuilder.setFilter(new FilterGroup('and', 'file.hasProperty("year_rank")'));

  let baseBuilder = new BaseBuilder();
  baseBuilder.addView(viewBuilder);
  baseBuilder.addFormula(new Formula("Rank Title", "file.properties[\"rank\"] + \" \" + file.properties[\"name\"]"))
  
  let base = baseBuilder.build();
  let yaml = base.serialize();
  return yaml;
}

export function debugTask() {
  let viewBuilder = new CardViewBuilder();
  viewBuilder.setName('Task');
  viewBuilder.setFilter(new FilterGroup('and', 'file.hasProperty("status")'));

  let baseBuilder = new BaseBuilder();
  baseBuilder.addView(viewBuilder);
  baseBuilder.addFormula(new Formula("Color", 'if(file.properties["Priority"] == 1, "#c00000", if(file.properties["Priority"] == 2, "#c8c800", "#00c000"))'));
  
  let base = baseBuilder.build();
  let yaml = base.serialize();
  return yaml;
}