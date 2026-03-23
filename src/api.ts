// api.ts
import { BaseBuilder } from './bases/baseConfigBuilder';
import { 
  CardViewBuilder,
  TableViewBuilder,
  ListViewBuilder
} from './views/viewConfigBuilder';
import { Property } from './bases/baseTypes';
import ProgrammaticBases from './main';
import { debugGame, debugTask, promiseTesting } from './debug';

export class ProgrammaticBasesAPI {
  //-- CLASSES
  BaseBuilder = BaseBuilder;
  CardViewBuilder = CardViewBuilder;
  TableViewBuilder = TableViewBuilder;
  ListViewBuilder = ListViewBuilder;
  Property = Property;
  
  //-- METHODS
  get createBase(): typeof ProgrammaticBases.instance.fileManager.createBase {
    return ProgrammaticBases.instance.fileManager.createBase;
  }
  get writeBase(): typeof ProgrammaticBases.instance.fileManager.writeBase {
    return ProgrammaticBases.instance.fileManager.writeBase;
  }

  //-- DEBUG
  debugGame = debugGame;
  debugTask = debugTask;
  promiseTesting = promiseTesting;
}