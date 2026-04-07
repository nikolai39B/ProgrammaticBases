import { AbstractInputSuggest, App, PluginSettingTab, Setting, TFolder } from "obsidian";
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

/** Suggests vault folders as the user types into an input. */
class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, private inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  /** Returns all vault folders whose path contains the query string, sorted alphabetically. */
  getSuggestions(query: string): TFolder[] {
    return this.app.vault.getAllFolders()
      .filter(f => f.path.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => a.path.localeCompare(b.path));
  }

  /** Renders a folder suggestion as its vault-relative path. */
  renderSuggestion(folder: TFolder, el: HTMLElement) {
    el.setText(folder.path);
  }

  /** Writes the selected folder path into the input and triggers the change event. */
  selectSuggestion(folder: TFolder) {
    this.inputEl.value = folder.path;
    this.inputEl.trigger('input');
    this.close();
  }
}

/**
 * Adds a full-width text input with folder autocomplete and validation to a Setting.
 * On blur, highlights the border red if the value is not an existing vault folder.
 * On change, clears the red border immediately if the value becomes valid.
 * An empty value is considered valid.
 */
function addFolderInput(
  setting: Setting,
  app: App,
  placeholder: string,
  getValue: () => string,
  onChange: (value: string) => Promise<void>,
) {
  // Make the control full-width on its own line
  setting.settingEl.style.flexWrap = 'wrap';
  setting.controlEl.style.width = '100%';

  // Configure the text input
  setting.addText(text => {
    text.inputEl.style.width = '100%';
    text.setPlaceholder(placeholder).setValue(getValue());

    // Add a new folder suggest component which will attach itself in its constructor
    new FolderSuggest(app, text.inputEl);

    // Define a method to check if the string is a valid folder
    const isValid = (value: string) =>
      !value || app.vault.getFolderByPath(value) instanceof TFolder;

    // Define a method to color the input depending on whether the string is a valid folder
    const setError = (hasError: boolean) => {
      text.inputEl.style.borderColor = hasError ? 'var(--color-red)' : '';
    };

    // Show error on blur if invalid
    text.inputEl.addEventListener('blur', () => setError(!isValid(text.inputEl.value.trim())));

    // Clear error on change if now valid; always persist the value
    text.onChange(async (value) => {
      await onChange(value.trim());
      if (isValid(value.trim())) setError(false);
    });
  });
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
    const { containerEl } = this;
    containerEl.empty();

    // Add bases folder setting
    addFolderInput(
      new Setting(containerEl)
        .setName('Bases folder')
        .setDesc('Vault-relative path to the folder containing full base templates.'),
      this.app,
      'e.g. Templates/ProgrammaticBases/bases',
      () => this.plugin.settings.basesFolder,
      async (value) => {
        this.plugin.settings.basesFolder = value;
        await this.plugin.saveSettings();
      },
    );

    // Add components folder setting
    addFolderInput(
      new Setting(containerEl)
        .setName('Components folder')
        .setDesc('Vault-relative path to the folder containing component YAML parts. Used to resolve unqualified !sub references.'),
      this.app,
      'e.g. Templates/ProgrammaticBases/components',
      () => this.plugin.settings.componentsFolder,
      async (value) => {
        this.plugin.settings.componentsFolder = value;
        await this.plugin.saveSettings();
      },
    );
  }
}
