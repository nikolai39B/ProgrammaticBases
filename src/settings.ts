import {App, PluginSettingTab, Setting} from "obsidian";
import ProgrammaticBases from "./main";

/**
 * An external source contributed by a plugin, providing components and/or
 * base templates that integrate with the Programmatic Bases plugin.
 */
export interface ExternalSource {
  /** Unique identifier for this source, used as the qualifier in !sub references, e.g. "task-base". */
  name: string;
  /**
   * Map of component key → raw YAML content.
   * Keys are path-like strings without extension, e.g. `"filter/isTask"` or `"view/focused"`.
   * The slash-separated structure is optional — flat keys are equally valid.
   * Referenced in templates as `!sub name:key`.
   */
  components?: Record<string, string>;
  /**
   * Map of template name → raw YAML content.
   * Names are shown in the template picker as `"name: templateName"`.
   */
  templates?: Record<string, string>;
}

export interface ProgrammaticBasesSettings {
  /** Vault-relative path to the folder containing full base templates. */
  basesFolder: string;
  /** Vault-relative path to the folder containing component YAML parts for unqualified !sub references. */
  componentsFolder: string;
}

/** Default values applied on first install or when a setting key is missing. */
export const DEFAULT_SETTINGS: ProgrammaticBasesSettings = {
  basesFolder: 'Templates/ProgrammaticBases/bases',
  componentsFolder: 'Templates/ProgrammaticBases/components',
}

/** Obsidian settings tab for the Programmatic Bases plugin. */
export class ProgrammaticBasesSettingTab extends PluginSettingTab {
  plugin: ProgrammaticBases;

  constructor(app: App, plugin: ProgrammaticBases) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /** Renders all settings controls into the tab container. Called each time the tab is opened. */
  display(): void {
    const {containerEl} = this;

    containerEl.empty();

    const basesFolderSetting = new Setting(containerEl)
      .setName('Bases folder')
      .setDesc('Vault-relative path to the folder containing full base templates.');
    basesFolderSetting.settingEl.style.flexWrap = 'wrap';
    basesFolderSetting.controlEl.style.width = '100%';
    basesFolderSetting.addText(text => {
      text.inputEl.style.width = '100%';
      text
        .setPlaceholder('e.g. Templates/ProgrammaticBases/bases')
        .setValue(this.plugin.settings.basesFolder)
        .onChange(async (value) => {
          this.plugin.settings.basesFolder = value.trim();
          await this.plugin.saveSettings();
        });
    });

    const componentsFolderSetting = new Setting(containerEl)
      .setName('Components folder')
      .setDesc('Vault-relative path to the folder containing component YAML parts. Used to resolve unqualified !sub references.');
    componentsFolderSetting.settingEl.style.flexWrap = 'wrap';
    componentsFolderSetting.controlEl.style.width = '100%';
    componentsFolderSetting.addText(text => {
      text.inputEl.style.width = '100%';
      text
        .setPlaceholder('e.g. Templates/ProgrammaticBases/components')
        .setValue(this.plugin.settings.componentsFolder)
        .onChange(async (value) => {
          this.plugin.settings.componentsFolder = value.trim();
          await this.plugin.saveSettings();
        });
    });
  }
}
