# programmatic-bases: Create Base from Template Command

## Goal
Add an Obsidian command that lets the user create a `.base` file from a YAML template, using the `VaultDeserializer` with `!sub` tag support to resolve components.

## What's Done

### Settings (`src/settings.ts`)
- Replaced `mySetting` with two new settings:
  - `basesFolder: string` — vault-relative path to the folder containing full base templates (scanned to populate the template picker modal). Default: `Templates/TaskBase/bases`
  - `componentsFolders: ComponentsFolder[]` — named, priority-ordered folders containing component YAML parts. Default: `[{ name: 'task-base', path: 'Templates/TaskBase/components' }]`
- `ComponentsFolder` interface exported from `settings.ts`: `{ name: string; path: string }`
- Settings UI uses a textarea (one `name: path` entry per line) for `componentsFolders`

### VaultDeserializer (`src/fileManagement/vaultDeserializer.ts`)
- Constructor now accepts optional `componentsFolders: ComponentsFolder[]`
- `!sub` refs are resolved via new `resolveComponentPath()` function:
  - **Unqualified** (`filter/focused.yaml`) → searched across all folders in priority order, first match wins
  - **Qualified** (`task-base:filter/focused.yaml`) → resolved against the named folder only; throws if qualifier is unknown
  - `normalizePath()` used for all path joins
  - Path traversal (`..`) is blocked on both qualified and unqualified refs
- `tsconfig.json` `lib` bumped from `["DOM","ES5","ES6","ES7"]` to `["DOM","ES2019"]` to fix `Object.entries`/`Object.fromEntries` type errors

### API (`src/api.ts`)
- `registerComponentsFolder(folder: ComponentsFolder): void` — plugins call this at runtime to contribute their own component folders (ephemeral, not persisted to settings)
- `registeredComponentsFolders: ComponentsFolder[]` — getter returning a copy of runtime-registered folders

### main.ts
- Imports `createBaseFromTemplateCommand` from `commands/createBaseFromTemplate`
- Imports `ComponentsFolder` from settings
- `allComponentsFolders` getter: merges `settings.componentsFolders` (first, higher priority) with `window.programmaticBases.registeredComponentsFolders` (appended)
- `loadSettings` must be called before `allComponentsFolders` is used

### Command (`src/commands/createBaseFromTemplate.ts`)
- File created, returns a stub `Command` object with `id: 'create-base-from-template'`
- Registered in `main.ts` via `this.addCommand(createBaseFromTemplateCommand())`
- **TODO**: implement the actual callback

## What's Next

### Immediate next step: implement the command callback
Planned flow:
1. Open a `SuggestModal` listing `.yaml` files in `settings.basesFolder`
2. User picks a template
3. Open a second modal pre-filled with `<active folder>/<template filename>` for the output path
4. User confirms
5. `VaultDeserializer.deserialize(templatePath)` with `allComponentsFolders`
6. `BaseConfig.deserialize(raw, viewRegistry)` 
7. `fileManager.createBase(config, outputPath)`

### Other pending work
- Vault folder restructure: move `Templates/TaskBase/{view,filter,formula,propertyDisplay}/` into `Templates/TaskBase/components/` and update `!sub` paths in `dashboard.yaml` accordingly (base template files moved to `Templates/TaskBase/bases/`)
- Tests for `VaultDeserializer` need updating/adding to cover the new search-path and qualifier behavior
- The command currently needs the plugin instance (for `app`, `settings`, `viewRegistry`) — need to decide how to pass it into the command factory (likely pass `ProgrammaticBases` instance as a parameter to `createBaseFromTemplateCommand`)
