# TODO

## Next Session

### 1. Wire up task-base as an external source
- Move component files (`filter/`, `formula/`, `view/`, `propertyDisplay/`) from `Templates/ProgrammaticBases/components/` into `task-base/src/templates/components/`
- Move base template files from `Templates/ProgrammaticBases/bases/` into `task-base/src/templates/bases/`
- Update `dashboard.yaml` so all `!sub` refs are qualified: `!sub task-base:filter/isTask` etc.
- Add `loader: { '.yaml': 'text' }` to `task-base/esbuild.config.mjs`
- Add `task-base/types/yaml.d.ts` so TypeScript accepts `*.yaml` imports
- In `task-base/src/main.ts`, call `window.programmaticBases.registerSource(...)` on load with all components and the dashboard template

### 2. Add vault-local template files
- Create a couple of new base templates under `Templates/ProgrammaticBases/bases/` to exercise the vault template picker path

### 3. End-to-end test
- Verify plugin templates show in the picker (with `task-base` flair)
- Verify vault templates show alongside them
- Verify `!sub` resolution works for both qualified (plugin) and unqualified (vault) refs
- Verify overwrite flow, output path defaulting, and error notices

### Also pending
- Unit test fixes in `programmatic-bases` (VaultDeserializer and OutputPathModal constructor signatures changed)
