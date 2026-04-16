import { Plugin } from 'obsidian';

import { ProgrammaticBasesAPI } from 'api';
import { createBaseFromTemplateCommand } from 'commands/createBaseFromTemplate';
import { updateBaseFromTemplateCommand } from 'commands/updateBaseFromTemplate';
import { ExternalSource, DEFAULT_SETTINGS, ProgrammaticBasesSettings, ProgrammaticBasesSettingTab} from "settings";

import { CardViewInstaller } from 'views/cardViewInstaller';
import { ListViewInstaller } from 'views/listViewInstaller';
import { TableViewInstaller } from 'views/tableViewInstaller';
import { ViewTypeInstaller } from 'views/viewTypeInstaller';
import { ViewRegistry } from 'views/viewRegistry';

import { BaseFileIO } from 'fileManagement/baseFileIO';
import { TemplateEvaluator } from 'fileManagement/templateEvaluator';
import { TemplateFileIO } from 'fileManagement/templateFileIO';
import { TemplateSourceResolver } from 'bases/templateSource';

import { PluginDependencyManager } from '../../pluginUtilsCommon/src/dependency';

// ── Programmatic Bases

export default class ProgrammaticBases extends Plugin {
  // ── Attributes

  // Instance
  private static _instance: ProgrammaticBases;
  static get instance(): ProgrammaticBases { return ProgrammaticBases._instance; }

  // File I/O
  private _baseFileIO: BaseFileIO;
  get baseFileIO(): BaseFileIO { return this._baseFileIO; }

  // Template file I/O
  private _templateFileIO: TemplateFileIO;
  get templateFileIO(): TemplateFileIO { return this._templateFileIO; }

  // API
  private _api: ProgrammaticBasesAPI;

  // Settings
  private _settings: ProgrammaticBasesSettings;
  get settings(): ProgrammaticBasesSettings { return this._settings; }

  /** External sources registered by other plugins at runtime. */
  get allSources(): Map<string, ExternalSource> {
    return this._api.registeredSources;
  }

  /** Vault-relative path to the components folder for unqualified !sub resolution. */
  get componentsFolder(): string {
    return this._settings.componentsFolder;
  }

  // View registry
  private _viewRegistry: ViewRegistry
  get viewRegistry(): ViewRegistry { return this._viewRegistry; }

  // Installers
  private _viewInstallers: ViewTypeInstaller[];

  // Dependency manager
  private dependencyManager: PluginDependencyManager;

  async onload() {
    this.loadPlugin();
  }

  private async loadPlugin() {
    try {
      // Set the instance
      ProgrammaticBases._instance = this;
      this._api = new ProgrammaticBasesAPI();
      window.programmaticBases = this._api;

      // Install the views
      this._viewRegistry = new ViewRegistry();
      this._viewInstallers = [
        new CardViewInstaller(),
        new ListViewInstaller(),
        new TableViewInstaller()
      ];
      this._viewInstallers.forEach(i => i.install(this.viewRegistry));

      // Create the file management layer
      const resolver = new TemplateSourceResolver(this.app, () => this.componentsFolder);
      const evaluator = new TemplateEvaluator(this.app, resolver, () => this.allSources);
      this._baseFileIO = new BaseFileIO(this.app, () => this._viewRegistry);
      this._templateFileIO = new TemplateFileIO(
        this._baseFileIO,
        () => this._viewRegistry,
        resolver,
        evaluator,
      );

      // Register commands
      this.addCommand(createBaseFromTemplateCommand(this));
      this.addCommand(updateBaseFromTemplateCommand(this));

      // Configure the settings
      await this.loadSettings();
      this.addSettingTab(new ProgrammaticBasesSettingTab(this.app, this));

      // Notify load success
      console.log("ProgrammaticBases loaded");
      this.app.workspace.trigger("programmatic-bases:loaded");
    } catch (e) {
      // Notify load failure
      const error = e instanceof Error ? e : new Error(String(e));
      console.log("ProgrammaticBases failed to load");
      this.app.workspace.trigger("programmatic-bases:loadFailed", error);
      throw error;
    }
  }

  onunload() {
    delete window.programmaticBases;
  }

  async loadSettings() {
    this._settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ProgrammaticBasesSettings>);
  }

  async saveSettings() {
    await this.saveData(this._settings);
  }

}
