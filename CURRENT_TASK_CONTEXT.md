# programmatic-bases: Current Task Context

## Current Goal
Wire up `task-base` to register its templates and components with `programmatic-bases` so users get task base templates without any vault setup.

---

## Architecture Summary

### External Source Registration (`programmatic-bases`)

Other plugins call `window.programmaticBases.registerSource(source, options?)` to contribute:
- **Components** — YAML parts resolved via qualified `!sub` refs (e.g. `!sub task-base:filter/isTask`)
- **Templates** — full base templates shown in the "Create base from template" picker

```ts
interface ExternalSource {
  name: string;                        // plugin id, used as !sub qualifier
  components?: Record<string, string>; // key → YAML content (no extension in key)
  templates?: Record<string, string>;  // templateName → YAML content
}
```

`registerSource(source, { append: true })` merges into an existing source rather than throwing.

### !sub Resolution (`VaultDeserializer`)

- **Unqualified** `!sub filter/isTask` → vault `componentsFolder` only (settings-configured)
- **Qualified** `!sub task-base:filter/isTask` → named external source only
- No cross-searching between vault and sources (avoids ordering ambiguity)
- Vault refs: `.yaml` appended automatically if missing
- External source keys: matched exactly as registered (no extension handling)

### Settings (`programmatic-bases`)
- `basesFolder: string` — vault folder for user's own base templates
- `componentsFolder: string` — vault folder for unqualified `!sub` resolution

### Template Picker
- Shows vault templates (from `basesFolder`) and plugin templates (from all registered sources) together
- Plugin templates display as `sourceName:templateName`

---

## What Needs to Happen in `task-base`

### 1. Bundle templates as TypeScript strings
Add esbuild `loader: { '.yaml': 'text' }` to `task-base/esbuild.config.mjs` so YAML files can be imported as strings.

Add a TypeScript declaration so TS accepts `*.yaml` imports:
```ts
// task-base/types/yaml.d.ts
declare module '*.yaml' {
  const content: string;
  export default content;
}
```

### 2. Create template files in `task-base/src/templates/`

Move the YAML content from `Templates/ProgrammaticBases/` into the plugin source:

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

Note: component files have no extension (keys match what `!sub task-base:filter/isTask` expects).
Base template files are full YAML and use qualified `!sub task-base:...` refs throughout.

### 3. Register with `programmatic-bases` on load

In `task-base/src/main.ts`, after `programmatic-bases:loaded`:

```ts
window.programmaticBases.registerSource({
  name: 'task-base',
  components: {
    'filter/inThisFolder': inThisFolder,
    'filter/isTask': isTask,
    // ...
  },
  templates: {
    'dashboard': dashboard,
  }
});
```

### 4. Update `dashboard.yaml` (the base template)
All `!sub` refs must be qualified since unqualified refs only search the vault:
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

---

## Pending: Unit Test Updates (`programmatic-bases`)

`VaultDeserializer` constructor changed from `(app)` to `(app, sources, componentsFolder)` — all test instantiations need updating.

`OutputPathModal` constructor changed from `(app, plugin, TFile)` to `(app, plugin, TemplateOption)` — test instantiations need wrapping in `{ source: 'vault', file: ... }`.
