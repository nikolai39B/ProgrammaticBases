import {App, Editor, MarkdownView, Modal, Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, ProgrammaticBasesSettings, ProgrammaticBasesSettingTab} from "./settings";


export default class ProgrammaticBases extends Plugin {

	settings: ProgrammaticBasesSettings;

	async onload() {
    console.log("ProgrammaticBases onload() begin")
    try {
      const tb = (this.app as any).plugins.plugins["task-base"];
      if (tb) {
        console.log("from PB: task base already loaded");
      } else {
        console.log("from PB: waiting for task base to load");
        this.registerEvent(
          (this.app as any).workspace.on("task-base:loaded", () => {
            console.log("from PB: task base loaded now");
          })
        );
        this.registerEvent(
          (this.app as any).workspace.on("task-base:loadFailed", () => {
            console.log("from PB: task base failed to load");
          })
        );
      }

      // Configure the settings
		  await this.loadSettings();
		  this.addSettingTab(new ProgrammaticBasesSettingTab(this.app, this));
      
      // Notify load success
      this.app.workspace.trigger("programmatic-bases:loaded");

    } catch (e) {
      // Notify load failure
      this.app.workspace.trigger("programmatic-bases:loadFailed", e instanceof Error ? e : new Error(String(e)));
    }
    
    console.log("ProgrammaticBases onload() complete");

	}

	onunload() {
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<ProgrammaticBasesSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
