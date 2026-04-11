# Current Task Context — programmatic-bases

## Status

All major implementation work from the original plan is complete. Remaining work is testing, one error message improvement, and the `task-base` integration.

---

## Completed this session

### `updateBaseFromTemplate` command
- `src/commands/updateBaseFromTemplate.ts` — reads `pb-metadata.template` from the active `.base` file, shows a destructive-action confirmation modal, then re-applies the stored template via `TemplateFileManager`. Supports both vault-path and plugin-registered template refs.

### `TemplateSource` abstraction (`src/bases/templateSource.ts`)
- `VaultTemplateSource` — constructed from either a `TFile` (path + file available immediately) or a `path + App` (file resolved lazily, cached on first access). `toRef()` returns vault-relative path.
- `PluginTemplateSource` — stores `sourceName` + `templateName`. Content is NOT cached; looked up fresh from sources map at write time. `toRef()` returns `"sourceName:templateName"`.
- `parseTemplateRef(ref, app)` — reconstructs a `TemplateSource` from a stored ref string.

### `TemplateFileManager` (`src/fileManagement/templateFileManager.ts`)
- Owns the full "template → BaseConfig → .base file" pipeline.
- Routes via `VaultDeserializer.deserialize` (vault) or `deserializeContent` (plugin).
- Stamps `pb-metadata.template` on every write via `BaseBuilder.setMetadata`.
- Exposed on plugin as `plugin.templateFileManager`.

### Refactored `createBaseFromTemplate.ts`
- `TemplateOption` type removed — replaced throughout with `TemplateSource`.
- `TemplatePicker` yields `TemplateSource[]` directly; plugin template loop drops unused `content` field.
- `OutputPathModal.create()` passes `this.template` straight to `templateFileManager`.
- `templateDisplayName(source, basesFolder)` — strips `basesFolder` prefix + extension for vault templates (settings-relative); returns `toRef()` for plugin templates.

---

## Next steps

### 1. Interactive testing
- Create a base from a vault template → verify `pb-metadata.template` is written with correct vault-relative path
- Create a base from a plugin-registered template → verify `pb-metadata.template` written as `"source:name"`
- Run "Update base from template" → confirm modal shows correct file name + template path, file is overwritten correctly
- Update on a base with no `pb-metadata` → Notice fires, no modal
- Update on a base whose template file has been deleted → clear error Notice fires

### 2. Update `createBaseFromTemplate.test.ts`
The existing tests mock `VaultDeserializer` and `BaseConfig` directly — those now live inside `TemplateFileManager`. Also has a `makeVaultTemplate` helper that constructs the old `TemplateOption` shape.
- Replace `VaultDeserializer`/`BaseConfig` mocks with a `templateFileManager` mock on the plugin instance
- Replace `makeVaultTemplate` (old `TemplateOption`) with `new VaultTemplateSource(file)`
- Update all `getSuggestions` / `renderSuggestion` / `onChooseSuggestion` / `create` tests

### 3. New test files needed
- `src/tests/templateSource.test.ts` — `VaultTemplateSource` (file constructor, path+app constructor with lazy resolution, `toRef`), `PluginTemplateSource`, `parseTemplateRef`
- `src/tests/templateFileManager.test.ts` — vault template path, plugin template path, metadata stamping, error cases (unknown source, missing template, missing vault file)
- `src/tests/updateBaseFromTemplate.test.ts` — guard cases (no active file, wrong extension, missing metadata), modal behaviour, successful update, error handling

### 4. Improve missing-template error message
`TemplateFileManager` currently surfaces `VaultDeserializer`'s raw `File not found: ${path}`. Wrap it with a clearer message:
> `Template file not found: "${path}". If you moved your bases folder, update the path in pb-metadata.template.`

---

## Architecture Summary

### External Source Registration
Other plugins call `window.programmaticBases.registerSource(source, options?)` to contribute:
- **Components** — YAML parts resolved via qualified `!sub` refs (e.g. `!sub task-base:filter/isTask`)
- **Templates** — full base templates shown in the "Create base from template" picker

```ts
interface ExternalSource {
  name: string;
  components?: Record<string, string>; // key → YAML content (no extension in key)
  templates?: Record<string, string>;  // templateName → YAML content
}
```

### !sub Resolution (`VaultDeserializer`)
- **Unqualified** `!sub filter/isTask` → vault `componentsFolder` only
- **Qualified** `!sub task-base:filter/isTask` → named external source only
- Vault refs: `.yaml` appended automatically if missing
- External source keys: matched exactly as registered

### Settings
- `basesFolder: string` — vault folder for user's own base templates
- `componentsFolder: string` — vault folder for unqualified `!sub` resolution

### Template Picker
- Shows vault templates (from `basesFolder`) and plugin templates (from all registered sources)
- Display names are settings-relative for vault templates; `sourceName:templateName` for plugin templates

---

## What Needs to Happen in `task-base`

### 1. Bundle templates as TypeScript strings
Add esbuild `loader: { '.yaml': 'text' }` to `task-base/esbuild.config.mjs`.

Add a TypeScript declaration:
```ts
// task-base/types/yaml.d.ts
declare module '*.yaml' {
  const content: string;
  export default content;
}
```

### 2. Create template files in `task-base/src/templates/`
```
src/templates/
  components/
    filter/inThisFolder
    filter/isTask
    filter/notTemplate
    filter/pastWeek
    formula/category
    formula/color
    formula/effort
    formula/links
    formula/resolved
    propertyDisplay/taskProperties
    view/due
    view/focused
    view/resolved
    view/unresolved
  bases/
    dashboard.yaml
```
Component files have no extension. Base template files use qualified `!sub task-base:...` refs.

### 3. Register with `programmatic-bases` on load
```ts
window.programmaticBases.registerSource({
  name: 'task-base',
  components: { 'filter/isTask': isTask, ... },
  templates: { 'dashboard': dashboard }
});
```

### 4. Update `dashboard.yaml`
All `!sub` refs must be qualified:
```yaml
filters:
  and:
    - !sub task-base:filter/inThisFolder
    - !sub task-base:filter/isTask
    - !sub task-base:filter/notTemplate
formulas:
  Color: !sub task-base:formula/color
views:
  - !sub task-base:view/focused
  - !sub task-base:view/due
  - !sub task-base:view/unresolved
  - !sub task-base:view/resolved
```
