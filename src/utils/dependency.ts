import { Plugin } from 'obsidian'

type Status = 
  "not_enabled" | // The plugin is not enabled 
  "unloaded" |    // The plugin has not yet loaded or failed to load
  "loaded";       // The plugin loaded successuflly

export class PluginDependency {
  //-- CONSTRUCTOR
  constructor(
    public manager: PluginDependencyManager, // The dependency manager
    public readonly dependencyName: string,  // The name of the plugin which is depended upon
    public readonly loadEvent: string,       // The name of the event which fires when the plugin is loaded
  ) {
    // Identify the current state of the dependency
    const depPlugin = manager.dependentPlugin;
    if (!(depPlugin.app as any).plugins.enabledPlugins.has(dependencyName)) {
      this._status = "not_enabled";
    } else if (!(depPlugin.app as any).plugins.plugins[dependencyName]) {
      this._status = "unloaded";
    } else {
      this._status = "loaded";
    }

    // If the plugin is unloaded, register the load event
    if (this._status == "unloaded") {
      depPlugin.registerEvent(
        (depPlugin.app as any).workspace.on(loadEvent, () => {
          // Update the status
          this._status = "loaded";

          // Notify the manager
          this.manager.onDependencyLoaded(this);
        })
      );
    }
  }

  //-- ATTRIBUTES
  private _status: Status;
  get status() { return this._status; }
}

export class PluginDependencyManager {
  //-- CONSTRUCTOR
  constructor(
    public readonly dependentPlugin: Plugin
  ) {
    // Initialize attributes
    this.pluginLoaded = false;
    this.pluginLoader = null;
    this.dependencies = new Map<string, PluginDependency>;

    // Check that we have loaded by the time the layout is ready
    dependentPlugin.app.workspace.onLayoutReady(() => {
      if (!this.pluginLoaded) {
        let debugMessage = [ 'Plugin never loaded due to following dependencies failing to load:' ];
        for (const dependency of this.dependencies.values()) {
          if (dependency.status != "loaded") {
            debugMessage.push(`  ${dependency.dependencyName} (${dependency.status})`);
          }
        };
        console.warn(debugMessage.join("\n"));
      }
    })
  }


  //-- DEPENDENCIES
  addDependency(dependencyName: string, loadEvent: string) {
    // Check for duplicates
    if (this.dependencies.has(dependencyName)) {
      console.warn(`Dependency on ${dependencyName} already exists`);
      return;
    }

    // Add the dependency
    this.dependencies.set(dependencyName, new PluginDependency(this, dependencyName, loadEvent));
  }

  onDependencyLoaded(dependency: PluginDependency) {
    // Attempt to load the plugin
    this.attemptLoadPlugin();
  }

  get dependenciesLoaded() {
    for (const dependency of this.dependencies.values()) {
      if (dependency.status != 'loaded') {
        return false;
      }
    }
    return true;
  }


  //-- PLUGIN LOADING
  registerPluginLoader(pluginLoader: () => void) {
    // Make sure we only register once
    if (this.pluginLoader) {
      console.warn(`Plugin loader already registered`);
      return;
    }
    this.pluginLoader = pluginLoader;

    // Attempt to load the plugin now in case all dependencies are already loaded
    this.attemptLoadPlugin();
  }

  private attemptLoadPlugin() {
    // If the plugin is already loaded, nothing to do
    if (this.pluginLoaded) {
      console.warn('Plugin already loaded - subsequent calls to this method unexpected');
      return;
    }

    // Check that we have a loader
    if (!this.pluginLoader) {
      console.warn('Plugin loader was never registered');
      return;
    }

    // If all dependencies are loaded, load the plugin
    if (this.dependenciesLoaded) {
      this.pluginLoader();
      this.pluginLoaded = true;
    }
  }

  //-- ATTRIBUTES
  private pluginLoaded: boolean;
  private pluginLoader: (() => void) | null;
  private dependencies: Map<string, PluginDependency>;
}