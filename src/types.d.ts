// types.d.ts
import { BaseBuilder } from './builders/baseBuilder';
import { CardViewBuilder, TableViewBuilder, ListViewBuilder } from './builders/viewBuilder';
import { Property } from './types/baseTypes';

import { debug } from './debug';

export type ProgrammaticBasesAPI = {
  //-- BUILDERS
  BaseBuilder: typeof BaseBuilder;
  CardViewBuilder: typeof CardViewBuilder;
  TableViewBuilder: typeof TableViewBuilder;
  ListViewBuilder: typeof ListViewBuilder;

  //-- PROPERTIES
  Property: typeof Property;

  //-- METHODS
  debug: typeof debug;
};

declare global {
  interface Window {
    programmaticBases?: ProgrammaticBasesAPI;
  }
}