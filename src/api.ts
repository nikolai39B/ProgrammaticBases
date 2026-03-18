// api.ts
import { BaseBuilder } from './builders/baseConfigBuilder';
import { 
  CardViewBuilder,
  TableViewBuilder,
  ListViewBuilder
} from './builders/viewConfigBuilder';
import { Property } from './config/baseTypes';
import { debugGame, debugTask, promiseTesting } from './debug';

export class ProgrammaticBasesAPI {
  BaseBuilder = BaseBuilder;
  CardViewBuilder = CardViewBuilder;
  TableViewBuilder = TableViewBuilder;
  ListViewBuilder = ListViewBuilder;
  
  //-- PROPERTIES
  Property = Property;
  
  //-- METHODS
  debugGame = debugGame;
  debugTask = debugTask;
  promiseTesting = promiseTesting;
}