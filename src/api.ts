// api.ts
import DebugUtils from 'debug';
import ProgrammaticBases from 'main';
import { BaseBuilder } from 'bases/baseBuilder';
import { BaseConfig } from 'bases/baseConfig';
import { Property } from 'primitives/property';
import { CardViewBuilder } from 'views/cardViewBuilder';
import { TableViewBuilder } from 'views/tableViewBuilder';
import { ListViewBuilder } from 'views/listViewBuilder';
import { QualifiedSource } from 'settings';

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

  //-- QUALIFIED SOURCES
  private _registeredSources: Map<string, QualifiedSource> = new Map();

  /** Returns a copy of the registered qualified sources map. */
  get registeredSources(): Map<string, QualifiedSource> {
    return new Map(this._registeredSources);
  }

  /**
   * Registers a qualified source providing components and/or base templates.
   * Throws if a source with the same name is already registered, unless `append` is true,
   * in which case the components and templates are merged (later keys win).
   */
  registerSource(source: QualifiedSource, options: RegisterSourceOptions = {}): void {
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
  readBase = (filePath: string) =>
    ProgrammaticBases.instance.baseFileIO.readBase(filePath);
  createBase = (config: BaseConfig, filePath: string) =>
    ProgrammaticBases.instance.baseFileIO.createBase(config, filePath);
  writeBase = (config: BaseConfig, filePath: string) =>
    ProgrammaticBases.instance.baseFileIO.writeBase(config, filePath);

  //-- DEBUG
  debug = DebugUtils;
}
