# Current Task Context — programmatic-bases

## Status

All 596 tests pass. File management layer refactor complete. `TemplateConfigurationModal` is multi-page (one page per param source, output location last).

---

## Next steps

### 1. `TemplateConfigurationModal` UI gaps

- **date / datetime inputs** — currently render as plain text; should use `<input type="date">` / `<input type="datetime-local">`
- **number inputs** — no `min` / `max` / `step` support in `ParamSpec`; also renders as text
- **description / hint text** — `description` field exists on `ParamSpec` but is not displayed under fields
- **required / validation** — submitting with empty required fields gives no feedback
- **select / enum type** — no dropdown option for fixed-choice params; needs new type in `ParamSpec`
- **Split UX** — after splitting, labels show raw source paths (e.g. `view/focused > filter/inThisFolder`), which is noisy; needs friendlier display
- **Visual grouping** — flat param list within a page has no section breaks; component-sourced params could be grouped visually

### 2. Interactive testing

- Test full flow: pick template → param modal → create base
- Test `!exp` / `!fnc` with params flowing through
- Test nested component params appearing on separate pages with correct source paths
- Test "Update base from template" re-applies stored params without re-prompting
- Test external source templates (qualified `!sub` refs)

### 3. `task-base` integration

See "What Needs to Happen in `task-base`" section below.

---

## Architecture

### Class responsibilities

| Class | File | Responsibility |
|---|---|---|
| `TemplateSourceResolver` | `templateSource.ts` | Parses all ref formats; validates vault paths; single authoritative place for format 1 vs 2 distinction |
| `TemplateEvaluator` | `templateEvaluator.ts` | Evaluates YAML templates — resolves `!sub`/`!exp`/`!fnc` tags in two passes; stamps `pb-metadata`; all logic in private methods |
| `TemplateFileIO` | `templateFileIO.ts` | Orchestrates template → `.base` file pipeline; delegates evaluation to `TemplateEvaluator` and writes to `BaseFileIO` |
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
- **Pass 2** (`evaluateTemplate`): full evaluation with user-supplied `ResolvedParams`, `pb-metadata` stripped, result stamped with `pb-metadata.template` (+ `pb-metadata.params` if non-empty)

### Param scoping

`ResolvedParams` uses `"sourcePath>paramName"` keys for component-scoped values, plain `"paramName"` for template-level. The modal fans merged values out to all relevant scoped keys before storing. `buildScopedParams` exposes only keys for the exact `sourcePath` — no cross-scope fallback.

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
