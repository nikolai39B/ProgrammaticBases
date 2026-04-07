import {App, PluginSettingTab, Setting} from "obsidian";
import ProgrammaticBases from "./main";

/** A named folder containing component YAML parts (views, filters, formulas, etc.). */
export interface ComponentsFolder {
  /** Short identifier used as the qualifier in !sub references, e.g. "programmatic-bases". */
  name: string;
  /** Vault-relative path to the folder root, e.g. "Templates/ProgrammaticBases/components". */
  path: string;
}

/**
 * A named in-memory component source contributed by a plugin.
 * Keys in `files` are vault-relative paths without the source root prefix,
 * e.g. `"filter/isTask.yaml"`.
 */
export interface ComponentSource {
  /** Short identifier used as the qualifier in !sub references, e.g. "task-base". */
  name: string;
  /**
   * Map of component key → raw YAML content.
   * Keys are path-like strings without extension, e.g. `"filter/isTask"` or `"view/focused"`.
   * The slash-separated structure is optional — flat keys like `"isTask"` are equally valid.
   */
  components: Record<string, string>;
}

/** A base template contributed by a plugin, shown alongside vault templates in the picker. */
export interface BaseTemplate {
  /** The plugin or source registering this template, e.g. "task-base". Used for uniqueness scoping. */
  source: string;
  /** Display name shown in the template picker. */
  name: string;
  /** Raw YAML content of the base template. */
  content: string;
}

export interface ProgrammaticBasesSettings {
  /** Vault-relative path to the folder containing full base templates. */
  basesFolder: string;
  /** Named folders containing component parts (views, filters, etc.), in priority order. */
  componentsFolders: ComponentsFolder[];
}

/** Default values applied on first install or when a setting key is missing. */
export const DEFAULT_SETTINGS: ProgrammaticBasesSettings = {
  basesFolder: 'Templates/ProgrammaticBases/bases',
  componentsFolders: [{ name: 'programmatic-bases', path: 'Templates/ProgrammaticBases/components' }],
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

    new Setting(containerEl)
      .setName('Bases folder')
      .setDesc('Vault-relative path to the folder containing full base templates.')
      .addText(text => {
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
      .setName('Components folders')
      .setDesc('One entry per line: "name: path". Priority ordered — first match wins for unqualified !sub references. Plugin-registered folders are merged at runtime.');
    componentsFolderSetting.settingEl.style.flexWrap = 'wrap';
    componentsFolderSetting.controlEl.style.width = '100%';
    componentsFolderSetting.addTextArea(text => {
        text.inputEl.style.width = '100%';
        text.inputEl.style.height = '8em';
        text.inputEl.style.resize = 'vertical';
        text
        .setPlaceholder('e.g.\nprogrammatic-bases: Templates/ProgrammaticBases/components')
        .setValue(this.plugin.settings.componentsFolders.map(f => `${f.name}: ${f.path}`).join('\n'))
        .onChange(async (value) => {
          this.plugin.settings.componentsFolders = value
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean) // remove empty lines (e.g. from trailing newlines)
            .map(line => {
              const colonIdx = line.indexOf(':');
              return {
                name: line.substring(0, colonIdx).trim(),
                path: line.substring(colonIdx + 1).trim(),
              };
            })
            .filter(f => f.name && f.path);
          await this.plugin.saveSettings();
        });
      });
  }
}
