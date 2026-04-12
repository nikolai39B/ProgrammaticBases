# Current Task Context — programmatic-bases

## Status

All major implementation work from the original plan is complete. The codebase has been significantly refactored for type safety and consistency. All 599 tests pass. Remaining work is code review/cleanup, interactive testing, and `task-base` integration.

---

## Completed last session (refactoring sprint)

### Modal consolidation
- Merged `ParamCollectionModal` into `OutputPathModal` — single modal with param fields, folder suggest, filename field, and Create/Cancel buttons
- `FolderSuggest` on the folder field; filename typed manually
- Sources description and Split button both gated on `namedSources.length > 1` (filters out `''` sources)

### `pb-metadata` / `pb-content` simplification
- Removed `pb-content:` wrapper key entirely — `unwrapContent()` now just strips `pb-metadata` and returns the remaining top-level keys
- Templates and components use the same flat format

### Template loading via `VaultDeserializer` (both passes)
- Vault templates now flow through `deserializeFile` / `collectFileParams` — same path as components, no special raw-string read
- External templates flow through `deserializeContent` / `collectContentParams`

### Naming refactor — `VaultDeserializer` public API
```typescript
// Pass 1
collectFileParams(source: VaultTemplateSource): Promise<HarvestedParams>
collectContentParams(source: ExternalTemplateSource, content: string): Promise<HarvestedParams>
// Pass 2
deserializeFile(source: VaultTemplateSource): Promise<unknown>
deserializeContent(source: ExternalTemplateSource, content: string): Promise<unknown>
```

### Renamed `PluginTemplateSource` → `ExternalTemplateSource`
- `TemplateSourceType`: `'plugin'` → `'external'`
- All call sites, tests, variable names, method names updated

### `resolveRef()` refactored to use `parseTemplateRef()`
- `resolveRef` now calls `parseTemplateRef(ref, app, componentsFolder)` and dispatches on `instanceof`
- `parseTemplateRef` overloaded: with `componentsFolder` resolves vault path eagerly and returns `null` if not found; without it, existing lazy behaviour
- `resolveVaultPath` moved from `vaultDeserializer.ts` into `templateSource.ts` as `resolveComponentPath` (private)
- `normalizePath` import moved from `vaultDeserializer.ts` to `templateSource.ts`

### `ResolvedRef` type cleanup
```typescript
type ResolvedRef =
  | { type: 'vault'; source: VaultTemplateSource }
  | { type: 'external'; source: ExternalTemplateSource; content: string };
```
- `resolvedPath` field removed — `source.path` is now always vault-relative (resolved by `parseTemplateRef`)
- `id` field removed from external branch — circular detection uses `resolved.source.toRef()` for both branches

---

## Next steps

### 1. Review/audit deserialization code and custom tags
- Review `buildSchema` / `buildHarvestSchema` and the `!sub` / `!exp` / `!fnc` tag implementations
- Verify `sourcePath` threading for scoped params works correctly end-to-end

### 2. Finish auditing `templateSource.ts` design
- `parseTemplateRef()` with two overloads feels off — one overload for stored template refs (lazy, no folder), one for `!sub` component refs (eager, with folder). Consider whether these should be two separate functions with clearer names
- Review `getTemplateRefSourceType` — still useful?

### 3. Interactive testing and bug fixing
- Test full flow: pick template → param modal → create base
- Test `!exp` / `!fnc` with params flowing through
- Test nested component params appearing in modal with correct source paths
- Test "Update base from template" re-applies stored params without re-prompting
- Test external source templates (qualified `!sub` refs)

### 4. `task-base` integration (deferred)
See "What Needs to Happen in `task-base`" section below.

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

### `!sub` Resolution (`VaultDeserializer`)
- **Unqualified** `!sub filter/isTask` → vault `componentsFolder` only
- **Qualified** `!sub task-base:filter/isTask` → named external source only
- Vault refs: `.yaml` appended automatically if missing; full vault path resolved by `parseTemplateRef`
- External source keys: matched exactly as registered

### `TemplateSource` types (`templateSource.ts`)
- `VaultTemplateSource` — vault-relative path always canonical; `file` getter lazy-resolves `TFile`
- `ExternalTemplateSource` — `sourceName` + `templateName`; `toRef()` → `"sourceName:templateName"`
- `parseTemplateRef(ref, app)` — for stored refs (lazy vault path)
- `parseTemplateRef(ref, app, componentsFolder)` — for `!sub` refs (eager vault path resolution, returns `null` if not found)

### Two-pass template loading
- **Pass 1** (`readParamSpecsFromTemplate`): `!sub` resolved, `!exp`/`!fnc` no-ops, `pb-metadata.params` harvested from template + all components → `HarvestedParams` shown in modal
- **Pass 2** (`loadTemplate`): full evaluation with user-supplied `ResolvedParams`, `pb-metadata` stripped, result stamped with `pb-metadata.template` (+ `pb-metadata.params` if non-empty)

### Settings
- `basesFolder: string` — vault folder for user's own base templates
- `componentsFolder: string` — vault folder for unqualified `!sub` resolution

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
