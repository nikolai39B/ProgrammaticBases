// api.ts
import DebugUtils from 'debug';
import ProgrammaticBases from 'main';
import { BaseBuilder } from 'bases/baseBuilder';
import { Property } from 'primitives/property';
import { CardViewBuilder } from 'views/cardViewBuilder';
import { TableViewBuilder } from 'views/tableViewBuilder';
import { ListViewBuilder } from 'views/listViewBuilder';
import { ExternalSource } from 'settings';

export interface RegisterSourceOptions {
  /** If true, merges with an existing source of the same name instead of throwing. Later keys win. */
  append?: boolean;
}

export class ProgrammaticBasesAPI {
  //-- CLASSES
  BaseBuilder = BaseBuilder;
  CardViewBuilder = CardViewBuilder;
  TableViewBuilder = TableViewBuilder;
  ListViewBuilder = ListViewBuilder;
  Property = Property;

  //-- EXTERNAL SOURCES
  private _registeredSources: Map<string, ExternalSource> = new Map();

  /** Returns a copy of the registered external sources map. */
  get registeredSources(): Map<string, ExternalSource> {
    return new Map(this._registeredSources);
  }

  /**
   * Registers an external source providing components and/or base templates.
   * Throws if a source with the same name is already registered, unless `append` is true,
   * in which case the components and templates are merged (later keys win).
   */
  registerSource(source: ExternalSource, options: RegisterSourceOptions = {}): void {
    const existing = this._registeredSources.get(source.name);
    if (existing) {
      if (!options.append) {
        throw new Error(`An external source named "${source.name}" is already registered.`);
      }
      this._registeredSources.set(source.name, {
        name: source.name,
        components: { ...existing.components, ...source.components },
        templates: { ...existing.templates, ...source.templates },
      });
    } else {
      this._registeredSources.set(source.name, source);
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
