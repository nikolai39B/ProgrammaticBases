# Copilot Instructions

## Commands

```bash
npm install          # Install dependencies
npm run build        # Type-check (tsc -noEmit) then bundle with esbuild → main.js
npm run dev          # Watch mode build (no type-check, inline sourcemaps)
npm run lint         # ESLint across the project
npm run test         # Run all tests once (vitest run)
npm run test:watch   # Run tests in watch mode
```

Run a single test file:
```bash
npx vitest run src/tests/<test-file>.test.ts
```

## Architecture

This plugin exposes a programmatic API for creating and modifying Obsidian [Bases](https://obsidian.md/bases) files (`.base`). The public API is mounted on `window.programmaticBases` (`ProgrammaticBasesAPI`) when the plugin loads.

### Data flow

1. Caller uses `BaseBuilder` + view builders (`CardViewBuilder`, `TableViewBuilder`, `ListViewBuilder`) to construct a `BaseConfig` in memory.
2. `BaseFileManager.createBase()` / `.writeBase()` serializes the config to YAML via `js-yaml` and writes a `.base` file to the vault.
3. Reading back: `VaultDeserializer` / `BaseConfig.deserialize()` parses raw YAML back into typed config objects using `ViewRegistry.deserialize()`.

### View type extension system

Each view type follows a three-layer pattern:

| Layer | Files | Purpose |
|---|---|---|
| Config | `*ViewConfig.ts` | Holds immutable view data; extends `ViewConfig` |
| Builder | `*ViewBuilder.ts` | Fluent builder; extends `BaseViewBuilder<T>` |
| Installer | `*ViewInstaller.ts` | Registers the type with `ViewRegistry`; extends `ViewTypeInstallerBase<K>` |

To add a new view type:
1. **Declare** it in `ViewTypeRegistry` via declaration merging in `src/views/viewType.ts`.
2. **Implement** the three files above.
3. **Register** the installer in `main.ts` alongside the existing three.

`ViewRegistry` enforces uniqueness — registering a duplicate type throws. Deregistration is always a no-op if not found.

### Builder pattern

All config classes use a **builder → validate → build** pattern:
- Builders accumulate options via fluent setters (all return `this`).
- `build()` calls `validate()` then `buildInternal()` (for view builders) or constructs directly (for `BaseBuilder`).
- `BaseBuilder` can be initialized from an existing `BaseConfig` + `ViewRegistry` to reconstruct mutable builders for editing.

### File management

`BaseFileManager` wraps the Obsidian vault API:
- `createBase` — throws if the file already exists.
- `writeBase` — upserts (creates or overwrites).
- Automatically appends `.base` extension if omitted and creates intermediate directories.

### Public API surface

`src/api.ts` → `ProgrammaticBasesAPI` exposes on `window.programmaticBases`:
- Classes: `BaseBuilder`, `CardViewBuilder`, `TableViewBuilder`, `ListViewBuilder`, `Property`
- Methods: `createBase`, `writeBase` (delegated from `BaseFileManager`)

### Plugin lifecycle

- Plugin defers initialization until all declared dependencies are ready via `PluginDependencyManager` (from sibling repo `../../pluginUtilsCommon`).
- On load success, fires `programmatic-bases:loaded`; on failure, fires `programmatic-bases:loadFailed`.
- `onunload` cleans up by deleting `window.programmaticBases`.

## Key Conventions

### Module resolution

`tsconfig.json` sets `baseUrl: "src"`, so imports resolve from `src/` without relative paths:
```ts
import { BaseConfig } from 'bases/baseConfig';  // → src/bases/baseConfig.ts
import { ViewRegistry } from 'views/viewRegistry';
```
`vitest.config.ts` mirrors these aliases explicitly — update **both** when adding new top-level directories under `src/`.

### Serialization

Every config class implements a symmetric `serialize() / static deserialize()` pair. Serialized output is a plain object (not a YAML string); `js-yaml` handles string conversion at the file manager layer. The `roundtrip.test.ts` test and `src/tests/fixtures/exampleBase.yaml` guard this contract.

### Testing with Obsidian mocks

Tests run in Node environment. `__mocks__/obsidian.ts` provides lightweight stubs for `TFile`, `TFolder`, `App`, `Plugin`, etc. vitest resolves `import ... from 'obsidian'` to this mock automatically via the alias in `vitest.config.ts`. Extend the mock there when tests need additional Obsidian APIs.

### TypeScript strictness

The project uses strict null checks and `noUncheckedIndexedAccess` but not the full `"strict": true` flag. All catch variables are typed as `unknown` (`useUnknownInCatchVariables: true`).

### File/folder structure

| Path | Purpose |
|---|---|
| `src/main.ts` | Plugin lifecycle only — onload, onunload, installer registration |
| `src/api.ts` | Public API surface (`window.programmaticBases`) |
| `src/bases/` | `BaseConfig`, `BaseBuilder`, options types |
| `src/views/` | View configs, builders, installers, registry, type system |
| `src/primitives/` | Leaf value types: `Property`, `Filter`/`FilterGroup`, `Formula`, `PropertyDisplay`, `PropertyOrder` — all serialize/deserialize symmetrically |
| `src/fileManagement/` | Vault I/O: create/write `.base` files, deserialization |
| `src/utils/` | `SerializationUtils` (serialize/deserialize arrays/records) |
| `src/tests/` | All vitest tests + `fixtures/` (YAML samples) |
| `__mocks__/obsidian.ts` | Obsidian SDK stub for tests |
| `types/types.d.ts` | Global augmentations: `Window.programmaticBases`, workspace events |
