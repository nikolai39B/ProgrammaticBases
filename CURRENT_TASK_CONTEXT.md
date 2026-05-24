# Current Task Context — programmatic-bases

## Status

614 tests passing. Lint cleanup in progress — submission-blocking issues partially resolved.

---

## What was just completed

### `js-yaml` → `yaml` migration
Migrated from the abandoned `js-yaml` package to the actively maintained `yaml` package (eemeli). Resolves the `depend/ban-dependencies` ESLint error that was blocking submission.

**API changes applied across all files:**
- `yaml.load(str, opts)` → `yaml.parse(str, opts)`
- `yaml.dump(obj, { lineWidth: -1 })` → `yaml.stringify(obj, { lineWidth: 0 })`
- Custom tag system rewritten: `new yaml.Type('!tag', { kind, construct })` → plain object `{ tag: '!tag', resolve }` passed via `customTags` option
- `yaml.CORE_SCHEMA.extend([...])` pattern eliminated — tags passed directly to each `parse()` call
- `yaml.parse` uses CORE schema by default, so no special schema needed to prevent ISO date coercion (replaces the previous `{ schema: yaml.CORE_SCHEMA }` workaround)

**Files changed:** `templateEvaluator.ts`, `baseFileIO.ts`, `updateBaseFromTemplate.ts`, `debug/index.ts`, `baseConfig.ts` (removed unused import), and test files `baseFileManager.test.ts`, `roundtrip.test.ts`, `updateBaseFromTemplate.test.ts`.

### `!fnc` removed, `!exp` replaced with string interpolation
Dropped `!fnc` entirely (full JS function-body eval — no safe replacement). Replaced `!exp` JS expression eval with `{{paramName}}` string interpolation:

```yaml
filter: !exp '{{folderPath}}/tasks'   # → e.g. "Notes/tasks"
name: !exp '{{prefix}}-dashboard'     # → e.g. "work-dashboard"
```

**Important authoring note:** `!exp` values containing `{{` must be **quoted** in YAML (single or double quotes), since `{` is YAML's flow-mapping delimiter.

Resolves the `no-implied-eval` and `no-unsafe-call` ESLint errors from `templateEvaluator.ts`.

### `defaultExpr` replaced with named tokens
`evalDefaultExpr` in `paramConfigModal.ts` no longer uses `new Function()`. Now resolves a fixed set of built-in tokens:

| Token | Resolves to |
|---|---|
| `{{today}}` | `YYYY-MM-DD` (current date) |
| `{{now}}` | `YYYY-MM-DDTHH:MM` (current datetime, datetime-local format) |

Unknown tokens return `undefined`, triggering fallback to `spec.default` → type zero value. Resolves the remaining `no-implied-eval` ESLint error from `paramConfigModal.ts`.

---

## Remaining lint errors (next session)

458 errors → now fewer after the above changes. Remaining categories to fix:

- `no-static-styles-assignment` — inline `element.style.*` in `settings.ts`, `paramConfigModal.ts`, `createBaseFromTemplate.ts`
- `no-misused-promises` / `no-floating-promises` — async `onChooseSuggestion` in `createBaseFromTemplate.ts`, floating promises in `main.ts`, `updateBaseFromTemplate.ts`
- `no-console` — `console.log` in `main.ts`, `debug/index.ts`, `debug/debugSource.ts`
- `no-namespace` — namespaces in `filter.ts`, `property.ts`, `propertyOrder.ts`
- `unbound-method` — static methods passed as callbacks in `baseConfig.ts`, `debug/index.ts`, test files
- `no-unnecessary-type-assertion` — stale `as` casts in `templateParams.ts`, `paramConfigModal.ts`, `filter.ts`
- `import/no-extraneous-dependencies` — `debug` import in `api.ts` (not in package.json)
- `__mocks__/obsidian.ts` parsing error — needs `allowDefaultProject` in eslint config
- `ui/sentence-case` — one button label in `paramConfigModal.ts`
- Unused imports/warnings — scattered across source and test files
- Test file `unsafe-any` errors — multiple test files

Also still needed for submission:
- README needs rewriting (currently has sample plugin boilerplate)
- `manifest.json` — author/authorUrl are still "Obsidian"/"obsidian.md"
- `package.json` — name is still "obsidian-sample-plugin"

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

- **Pass 1** (`collectParams`): resolves `!sub`, no-ops `!exp`, harvests `pb-metadata.params` from template + all components → `HarvestedParams` shown in modal
- **Pass 2** (`evaluateTemplate`): resolves `!sub`, interpolates `!exp` `{{param}}` placeholders with user-supplied `ResolvedParams`; stamps `pb-metadata.template` (+ `pb-metadata.params` if non-empty)

### `!exp` interpolation syntax

Values with `{{...}}` placeholders must be quoted in YAML:
```yaml
filter: !exp '{{folderPath}}/tasks'
```
Plain strings (no `{{`) can be unquoted:
```yaml
label: !exp some static text
```

### `defaultExpr` tokens

Param specs can declare `defaultExpr: "{{today}}"` or `defaultExpr: "{{now}}"` to pre-fill date/datetime fields at modal-open time. Unknown tokens fall back to `spec.default`, then type zero value.

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
