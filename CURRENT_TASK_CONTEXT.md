# Current Task: `pb-metadata` key + Update Base command

## Goal
1. Add `pb-metadata` top-level YAML key to `.base` files to store plugin metadata (starting with `template` — the source template path).
2. Wire it through `BaseConfig` so it round-trips cleanly.
3. Implement "create base from template" command (emits metadata on create).
4. Implement "update base from template" command (reads `pb-metadata.template`, re-applies template, preserves metadata).

## Metadata format
```yaml
pb-metadata:
  template: Templates/TaskBase/bases/dashboard.yaml
views: ...
```

---

## Phase 1 — `pb-metadata` in the data model ✅ (execute next)

1. Create `src/bases/baseMetadata.ts` — `BaseMetadata` interface `{ template?: string }` with `serialize()` / `static deserialize()`
2. Add `metadata?: BaseMetadata` to `BaseConfigOptions` (`baseConfigOptions.ts`)
3. Update `BaseConfig`:
   - Add `get metadata()` accessor
   - `serialize()` — emit `pb-metadata` key if present
   - `static deserialize()` — read `pb-metadata` key if present
4. Update `BaseBuilder` — add `setMetadata(metadata: BaseMetadata)` method

## Phase 2 — Emit metadata on create

5. Update `createBaseFromTemplate` command callback: after picking template and output path, set `pb-metadata.template` on the builder before calling `fileManager.createBase()`

## Phase 3 — Update Base command

6. Create `src/commands/updateBaseFromTemplate.ts`:
   - Read active file (must be a `.base` file)
   - Read raw YAML, extract `pb-metadata.template`
   - If missing → show error notice "No template source found in pb-metadata"
   - Re-run: `VaultDeserializer.deserialize(templatePath)` → `BaseConfig.deserialize()` → preserve `pb-metadata` on the new config → `fileManager.writeBase()`
7. Register command in `main.ts`

## Phase 4 — Implement create command callback (parallel with Phase 3, depends on Phase 1)

8. Implement the stub `createBaseFromTemplate` callback:
   - `SuggestModal` listing `.yaml` files in `settings.basesFolder`
   - Output path modal pre-filled with `<active folder>/<template filename>`
   - Deserialize template → `BaseConfig.deserialize()` → set `pb-metadata.template` → `fileManager.createBase()`
   - Note: pass `ProgrammaticBases` plugin instance as parameter to `createBaseFromTemplateCommand(plugin)`

---

## Key files
| File | Purpose |
|------|---------|
| `src/bases/baseMetadata.ts` | NEW — `BaseMetadata` type |
| `src/bases/baseConfigOptions.ts` | Add `metadata?` |
| `src/bases/baseConfig.ts` | serialize/deserialize `pb-metadata` |
| `src/bases/baseBuilder.ts` | Add `setMetadata()` |
| `src/commands/createBaseFromTemplate.ts` | Set metadata on create |
| `src/commands/updateBaseFromTemplate.ts` | NEW — update command |
| `src/main.ts` | Register update command; pass plugin instance to command factories |

## Completed work (prior sessions)
- `ComponentsFolder` interface in `settings.ts` (`{ name, path }`)
- Settings: `basesFolder` (template root) + `componentsFolders` (named component roots)
- Settings UI: textarea for componentsFolders (one `name: path` per line)
- `VaultDeserializer` overhauled: search-path + qualifier (`name:path`) `!sub` resolution, `normalizePath`, `..` blocked
- `tsconfig.json` lib bumped to `ES2019`
- `api.ts`: `registerComponentsFolder()` + `registeredComponentsFolders`
- `main.ts`: `allComponentsFolders` getter (settings + runtime), `_api` private field
- `src/commands/createBaseFromTemplate.ts`: stub command registered


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
