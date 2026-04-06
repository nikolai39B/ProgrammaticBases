// api.ts
import DebugUtils from 'debug';
import ProgrammaticBases from 'main';
import { BaseBuilder } from 'bases/baseBuilder';
import { Property } from 'primitives/property';
import { CardViewBuilder } from 'views/cardViewBuilder';
import { TableViewBuilder } from 'views/tableViewBuilder';
import { ListViewBuilder } from 'views/listViewBuilder';
import { ComponentsFolder } from 'settings';

export class ProgrammaticBasesAPI {
  //-- CLASSES
  BaseBuilder = BaseBuilder;
  CardViewBuilder = CardViewBuilder;
  TableViewBuilder = TableViewBuilder;
  ListViewBuilder = ListViewBuilder;
  Property = Property;

  //-- COMPONENT FOLDERS
  private _registeredComponentsFolders: ComponentsFolder[] = [];

  /** Returns a copy of the runtime-registered component folders. */
  get registeredComponentsFolders(): ComponentsFolder[] {
    return [...this._registeredComponentsFolders];
  }

  /**
   * Registers a component folder at runtime (e.g. from another plugin).
   * Runtime-registered folders are appended after settings-configured ones.
   * @param folder - the named folder to register
   */
  registerComponentsFolder(folder: ComponentsFolder): void {
    this._registeredComponentsFolders.push(folder);
  }

  //-- METHODS
  get createBase(): typeof ProgrammaticBases.instance.fileManager.createBase {
    return ProgrammaticBases.instance.fileManager.createBase;
  }
  get writeBase(): typeof ProgrammaticBases.instance.fileManager.writeBase {
    return ProgrammaticBases.instance.fileManager.writeBase;
  }

  //-- DEBUG
  debug = DebugUtils;
}