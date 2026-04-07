// api.ts
import DebugUtils from 'debug';
import ProgrammaticBases from 'main';
import { BaseBuilder } from 'bases/baseBuilder';
import { Property } from 'primitives/property';
import { CardViewBuilder } from 'views/cardViewBuilder';
import { TableViewBuilder } from 'views/tableViewBuilder';
import { ListViewBuilder } from 'views/listViewBuilder';
import { BaseTemplate, ComponentsFolder, ComponentSource } from 'settings';

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

  /** Registers a vault component folder at runtime (e.g. from another plugin). */
  registerComponentsFolder(folder: ComponentsFolder): void {
    this._registeredComponentsFolders.push(folder);
  }

  //-- COMPONENT SOURCES
  private _registeredComponentSources: ComponentSource[] = [];

  /** Returns a copy of the runtime-registered in-memory component sources. */
  get registeredComponentSources(): ComponentSource[] {
    return [...this._registeredComponentSources];
  }

  /** Registers an in-memory component source at runtime (e.g. from another plugin). */
  registerComponentSource(source: ComponentSource): void {
    if (this._registeredComponentSources.some(s => s.name === source.name)) {
      throw new Error(`A component source named "${source.name}" is already registered.`);
    }
    this._registeredComponentSources.push(source);
  }

  //-- BASE TEMPLATES
  private _registeredBaseTemplates: BaseTemplate[] = [];

  /** Returns a copy of the runtime-registered base templates. */
  get registeredBaseTemplates(): BaseTemplate[] {
    return [...this._registeredBaseTemplates];
  }

  /** Registers one or more base templates at runtime, shown alongside vault templates in the picker. */
  registerBaseTemplate(templates: BaseTemplate[]): void {
    for (const template of templates) {
      if (this._registeredBaseTemplates.some(t => t.source === template.source && t.name === template.name)) {
        throw new Error(`A base template named "${template.name}" is already registered for source "${template.source}".`);
      }
      this._registeredBaseTemplates.push(template);
    }
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