import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, ProgrammaticBasesSettings, ProgrammaticBasesSettingTab} from "./settings";
import { PluginDependencyManager } from '../../pluginUtilsCommon/dependency';

export default class ProgrammaticBases extends Plugin {

  settings: ProgrammaticBasesSettings;

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
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ProgrammaticBasesSettings>);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }


  //-- ATTRIBUTES
  private dependencyManager: PluginDependencyManager;
}
