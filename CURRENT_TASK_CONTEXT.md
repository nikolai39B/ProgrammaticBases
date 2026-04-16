# Current Task Context — programmatic-bases

## Status

All 599 tests pass. Major implementation is complete.

**Current work (in progress):** Architectural refactor of the file management layer.
Plan fully designed — ready to implement. Plan file: `C:\Users\nikol\.claude\plans\goofy-gliding-blum.md`

---

## Next steps

### 1. Implement file management layer refactor (plan ready)

See plan file for full detail. Summary of what changes:

- **`templateSource.ts`** — add `TemplateSourceResolver` class (`parseHeaderRef` / `parseSubRef`); remove `parseTemplateRef` free function
- **`vaultDeserializer.ts` → `templateEvaluator.ts`** — rename class to `TemplateEvaluator`; move all free functions to private methods; unify public API to `collectParams` / `evaluate`; remove `resolvedParams` from constructor
- **`templateFileManager.ts` → `templateFileIO.ts`** — rename class to `TemplateFileIO`; constructor simplifies to 4 args (injected evaluator); rename `loadTemplate` → `evaluateTemplate`; add `writeBaseFromStoredRef` (reads cached params internally)
- **`baseFileManager.ts` → `baseFileIO.ts`** — rename only, no functional changes
- **`updateBaseFromTemplate.ts`** — fix bug (templateSource constructed but never passed on line 43); simplify to call `writeBaseFromStoredRef` with no params
- **`main.ts`** — create `TemplateSourceResolver` + `TemplateEvaluator`; pass both to `TemplateFileIO`

Also: custom tag review (`buildSchema` / `buildHarvestSchema`, `sourcePath` threading) happens naturally during the refactor as those functions become private methods.

### 2. Interactive testing (after refactor)

- Test full flow: pick template → param modal → create base
- Test `!exp` / `!fnc` with params flowing through
- Test nested component params appearing in modal with correct source paths
- Test "Update base from template" re-applies stored params without re-prompting
- Test external source templates (qualified `!sub` refs)

### 3. `task-base` integration (deferred)

See "What Needs to Happen in `task-base`" section below.

---

## Architecture (post-refactor)

### Class responsibilities

| Class | File | Responsibility |
|---|---|---|
| `TemplateSourceResolver` | `templateSource.ts` | Parses all ref formats; validates vault paths; single authoritative place for format 1 vs 2 distinction |
| `TemplateEvaluator` | `templateEvaluator.ts` | Evaluates YAML templates — resolves `!sub`/`!exp`/`!fnc` tags in two passes; all logic in private methods |
| `TemplateFileIO` | `templateFileIO.ts` | Orchestrates template → BaseConfig pipeline; stamps `pb-metadata`; delegates writes to `BaseFileIO` |
| `BaseFileIO` | `baseFileIO.ts` | Read/create/write `.base` files; path normalization; directory creation |

### Three template ref formats

| # | Format | Example | Parsed by |
|---|---|---|---|
| 1 | Unqualified `!sub` — components-folder-relative | `filter/isTask` | `resolver.parseSubRef` |
| 2 | Qualified `!sub` — external source component | `task-base:filter/isTask` | `resolver.parseSubRef` |
| 3 | Header ref — stored in `pb-metadata.template` | `Templates/board.yaml` or `task-base:dashboard` | `resolver.parseHeaderRef` |

### External Source Registration

Other plugins call `window.programmaticBases.registerSource(source)` to contribute:
- **Components** — YAML parts resolved via qualified `!sub` refs (e.g. `!sub task-base:filter/isTask`)
- **Templates** — full base templates shown in the "Create base from template" picker

```ts
interface ExternalSource {
  name: string;
  components?: Record<string, string>; // key → YAML content
  templates?: Record<string, string>;  // templateName → YAML content
}
```

### Two-pass template evaluation

- **Pass 1** (`collectParams`): `!sub` resolved, `!exp`/`!fnc` no-ops, `pb-metadata.params` harvested from template + all components → `HarvestedParams` shown in modal
- **Pass 2** (`evaluate`): full evaluation with user-supplied `ResolvedParams`, `pb-metadata` stripped, result stamped with `pb-metadata.template` (+ `pb-metadata.params` if non-empty)

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
