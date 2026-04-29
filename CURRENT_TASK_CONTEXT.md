# Current Task Context — programmatic-bases

## Status

618 tests passing. The create and update flows are both fully implemented with multi-page param modals.

---

## What was just completed

### `ParamConfigModal` base class refactor
Shared param modal logic extracted from `createBaseFromTemplate.ts` into a new abstract base class `ParamConfigModal` (`src/commands/paramConfigModal.ts`). Both modals now extend it:

- `TemplateConfigurationModal` — adds an output-location final page; "Create" button
- `UpdateConfigurationModal` — no output-location page; "Update" button appears on last param page (or immediately if no params)

### Update command redesign
`updateBaseFromTemplate.ts` rewritten. Old flow: simple confirm dialog → re-evaluate from scratch. New flow:
1. Read `pb-metadata.template` and `pb-metadata.params` from the active `.base` file
2. Resolve template source via `templateSourceResolver.parseRef`
3. Harvest params from template + components
4. Open `UpdateConfigurationModal` pre-filled with the cached params
5. On confirm, call `templateFileIO.writeBaseFromTemplate` directly

**Date parsing fix**: `yaml.load` now uses `yaml.CORE_SCHEMA` to prevent ISO date strings (e.g. `2026-04-23`) from being coerced to `Date` objects.

### `VaultTemplateSource` pure-identifier refactor
`VaultTemplateSource` and `TemplateSourceResolver` are now pure path/identifier logic with no `App` or `TFile` dependencies. All vault I/O lives in `TemplateEvaluator.resolveContent`.

### `toName()` method
Both source types now have `toName()` for display-friendly names:
- `VaultTemplateSource`: leaf filename stripped of folder and `.yaml` extension
- `QualifiedTemplateSource`: just `templateName`

### `defaultExpr` support
Param specs can declare `defaultExpr: "<js expression>"` evaluated at modal-open time (no params context). Fallback chain: expr result → static `default` → type fallback.

### `pb-content` unwrapping fix
`unwrapContent` now strips `pb-content:` wrapper after stripping `pb-metadata:`, fixing a "no deserializer registered for view type undefined" error when vault components use `pb-content`.

---

## Next steps

### 1. Pending todos (from project-log.md)

- **Handle params declared by multiple templates under the same name** — currently, when the template and a component both declare a param with the same name, they appear on separate pages with separate values. There may be a case for merging/splitting these.

### 2. Interactive testing

- Full create flow with debug template: all param types, `defaultExpr` for date
- Full update flow: open existing `.base`, run update command, verify modal pre-fills correctly, verify date/datetime fields are populated as strings
- Nested component params appearing on correct pages
- External source templates (qualified `!sub` refs)
- `task-base` dashboard creation and update

### 3. `task-base` integration

See "What Needs to Happen in `task-base`" section below.

---

## Architecture

### Key files

| File | Responsibility |
|---|---|
| `src/commands/paramConfigModal.ts` | Abstract base class for param modals — page building, pre-fill, field rendering, validation, nav |
| `src/commands/createBaseFromTemplate.ts` | `TemplatePicker`, `TemplateConfigurationModal`, `ConfirmOverwriteModal` |
| `src/commands/updateBaseFromTemplate.ts` | `updateBaseFromTemplateCommand`, `UpdateConfigurationModal` |
| `src/bases/templateSource.ts` | `VaultTemplateSource`, `QualifiedTemplateSource`, `TemplateSourceResolver` |
| `src/fileManagement/templateEvaluator.ts` | Two-pass YAML evaluation (`collectParams` / `evaluateTemplate`) |
| `src/fileManagement/templateFileIO.ts` | Template → `.base` pipeline; delegates to evaluator + file I/O |

### Param key format

`ResolvedParams` uses scoped keys: `"sourcePath>paramName"` for component-level params, plain `"paramName"` for template-level. The modal pre-fill loop and `buildScopedParams` both use this format.

### Two-pass template evaluation

- **Pass 1** (`collectParams`): resolves `!sub`, no-ops `!exp`/`!fnc`, harvests `pb-metadata.params` from template + all components → `HarvestedParams` shown in modal
- **Pass 2** (`evaluateTemplate`): full evaluation with user-supplied `ResolvedParams`; stamps `pb-metadata.template` (+ `pb-metadata.params` if non-empty)

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
