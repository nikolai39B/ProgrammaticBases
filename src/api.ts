// api.ts
import DebugUtils from 'debug';
import ProgrammaticBases from 'main';
import { BaseBuilder } from 'bases/baseConfigBuilder';
import { Property } from 'primitives/property';
import { CardViewBuilder } from 'views/cardViewBuilder';
import { TableViewBuilder } from 'views/tableViewBuilder';
import { ListViewBuilder } from 'views/listViewBuilder';

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
  debug = DebugUtils;
  //debugGame = DebugUtils.debugGame;
  //debugTask = DebugUtils.debugTask;
  //promiseTesting = DebugUtils.promiseTesting;
  //testJsYaml = DebugUtils.testJsYaml;
  //testJsYamlLoad = DebugUtils.testJsYamlLoad;
}