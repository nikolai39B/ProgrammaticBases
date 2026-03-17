import {App, PluginSettingTab, Setting} from "obsidian";
import ProgrammaticBases from "./main";

export interface ProgrammaticBasesSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: ProgrammaticBasesSettings = {
	mySetting: 'default'
}

export class ProgrammaticBasesSettingTab extends PluginSettingTab {
	plugin: ProgrammaticBases;

	constructor(app: App, plugin: ProgrammaticBases) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Settings #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
