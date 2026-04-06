import {App, PluginSettingTab, Setting} from "obsidian";
import ProgrammaticBases from "./main";

export interface ProgrammaticBasesSettings {
	templateDirectory: string;
}

export const DEFAULT_SETTINGS: ProgrammaticBasesSettings = {
	templateDirectory: ''
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
			.setName('Template directory')
			.setDesc('Vault-relative path used as the base directory when resolving !sub references in YAML templates.')
			.addText(text => text
				.setPlaceholder('e.g. Templates/TaskBase')
				.setValue(this.plugin.settings.templateDirectory)
				.onChange(async (value) => {
					this.plugin.settings.templateDirectory = value;
					await this.plugin.saveSettings();
				}));
	}
}
