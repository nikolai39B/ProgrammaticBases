import { Plugin, View } from 'obsidian';

import { ProgrammaticBasesAPI } from 'api';
import { createBaseFromTemplateCommand } from 'commands/createBaseFromTemplate';
import { ComponentsFolder, DEFAULT_SETTINGS, ProgrammaticBasesSettings, ProgrammaticBasesSettingTab} from "settings";

import { CardViewInstaller } from 'views/cardViewInstaller';
import { ListViewInstaller } from 'views/listViewInstaller';
import { TableViewInstaller } from 'views/tableViewInstaller';
import { ViewTypeInstaller } from 'views/viewTypeInstaller';
import { ViewRegistry } from 'views/viewRegistry';

import { BaseFileManager } from 'fileManagement/baseFileManager';

import { PluginDependencyManager } from '../../pluginUtilsCommon/src/dependency';

// ─── Programmatic Bases ──────────────────────────────────────────────────────

export default class ProgrammaticBases extends Plugin {
  //-- ATTRIBUTES

  // Instance
  private static _instance: ProgrammaticBases;
  static get instance(): ProgrammaticBases { return ProgrammaticBases._instance; }

  // File manager
  private _fileManager: BaseFileManager;
  get fileManager(): BaseFileManager { return this._fileManager; }
  
  // Settings
  private _settings: ProgrammaticBasesSettings;
  get settings(): ProgrammaticBasesSettings { return this._settings; }

  /**
   * All component folders: settings-configured ones first (priority order),
   * followed by runtime-registered ones from other plugins.
   */
  get allComponentsFolders(): ComponentsFolder[] {
    return [
      ...this._settings.componentsFolders,
      ...window.programmaticBases.registeredComponentsFolders,
    ];
  }

  // View registry
  private _viewRegistry: ViewRegistry
  get viewRegistry(): ViewRegistry { return this._viewRegistry; }

  // Installers
  private _viewInstallers: ViewTypeInstaller[];

  async onload() {
    console.log("ProgrammaticBases onload() begin")

    // Load once dependencies are loaded
    this.dependencyManager = new PluginDependencyManager(this);
    //this.dependencyManager.addDependency("task-base", "task-base:loaded");
    await this.dependencyManager.registerPluginLoader(() => this.loadPlugin() );
    
    console.log("ProgrammaticBases onload() complete");
  }

  private async loadPlugin() {
    try {
      // Set the instance
      ProgrammaticBases._instance = this;
      window.programmaticBases = new ProgrammaticBasesAPI();

      // Install the views
      this._viewRegistry = new ViewRegistry();
      this._viewInstallers = [
        new CardViewInstaller(),
        new ListViewInstaller(),
        new TableViewInstaller()
      ];
      this._viewInstallers.forEach(i => i.install(this.viewRegistry));

      // Create the file manager
      this._fileManager = new BaseFileManager(this.app);

      // Register commands
      this.addCommand(createBaseFromTemplateCommand());

      // Configure the settings
      await this.loadSettings();
      this.addSettingTab(new ProgrammaticBasesSettingTab(this.app, this));

      // Notify load success
      this.app.workspace.trigger("programmatic-bases:loaded");

      console.log("ProgrammaticBases loaded");
    } catch (e) {
      // Notify load failure
      const error = e instanceof Error ? e : new Error(String(e));
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


  //-- ATTRIBUTES
  private dependencyManager: PluginDependencyManager;
}
