// types.d.ts
import { BaseBuilder } from './builders/baseConfigBuilder';
import { CardViewBuilder, TableViewBuilder, ListViewBuilder } from './builders/viewConfigBuilder';
import { Property } from './types/baseTypes';

import { debugGame, debugTask, promiseTesting } from './debug';

export type ProgrammaticBasesAPI = {
  //-- BUILDERS
  BaseBuilder: typeof BaseBuilder;
  CardViewBuilder: typeof CardViewBuilder;
  TableViewBuilder: typeof TableViewBuilder;
  ListViewBuilder: typeof ListViewBuilder;

  //-- PROPERTIES
  Property: typeof Property;

  //-- METHODS
  debugGame: typeof debugGame;
  debugTask: typeof debugTask;
  promiseTesting: typeof promiseTesting;
};

declare global {
  interface Window {
    programmaticBases?: ProgrammaticBasesAPI;
  }
}