# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Build in watch mode (development)
npm run build        # Type-check + production bundle
npm run lint         # Run ESLint
npm test             # Run all tests (vitest)
npm run test:watch   # Run tests in watch mode
```

Run a single test file:
```bash
npx vitest run src/tests/baseBuilder.test.ts
```

## Architecture

This is an Obsidian community plugin ("Programmatic Bases") that exposes a `window.programmaticBases` API so other plugins/scripts can create `.base` files programmatically.

### Entry point & startup

`src/main.ts` → `ProgrammaticBases` (Plugin subclass). On load it:
1. Uses `PluginDependencyManager` (from `../pluginUtilsCommon/`) to defer initialization until dependencies are ready.
2. Registers view type installers with a `ViewRegistry`.
3. Creates a `BaseFileManager` for vault I/O.
4. Exposes `window.programmaticBases = new ProgrammaticBasesAPI()`.

### Core data model

`BaseConfig` (`src/bases/baseConfig.ts`) is the top-level configuration object. It holds:
- A list of `ViewConfig` instances (at least one required).
- Optional: `FilterGroup`, `Formula[]`, `PropertyDisplay[]`.

All config objects implement a symmetric `serialize() / static deserialize()` pattern — they round-trip through plain JS objects and YAML (via `js-yaml`).

### View type system

Views follow a three-layer pattern for each type (card, list, table):

| Layer | Files | Purpose |
|---|---|---|
| Config | `*ViewConfig.ts` | Holds immutable view data; extends `ViewConfig` |
| Builder | `*ViewBuilder.ts` | Fluent builder; extends `BaseViewBuilder<T>` |
| Installer | `*ViewInstaller.ts` | Registers the type with `ViewRegistry`; extends `ViewTypeInstallerBase<K>` |

`ViewRegistry` is the runtime registry — it maps `ViewType` string keys to `ViewRegistration` entries (builder factory + deserializer). To add a new view type, extend `ViewTypeRegistry` via declaration merging in `viewType.ts`, implement the three files above, and add an installer to the array in `main.ts`.

### Builder pattern

`BaseBuilder` (`src/bases/baseBuilder.ts`) assembles a `BaseConfig` via chaining (`addView`, `setFilter`, `addFormula`, `addProperty`) then `.build()`. View builders follow the same pattern via `BaseViewBuilder`.

`BaseBuilder` can also be initialized from an existing `BaseConfig` + `ViewRegistry` to reconstruct mutable builders for editing.

### File management

`BaseFileManager` (`src/fileManagement/baseFileManager.ts`) wraps the Obsidian vault API. `createBase` throws if the file exists; `writeBase` upserts. Automatically appends `.base` extension and creates intermediate directories.

### Path aliases

`tsconfig.json` sets `baseUrl: "src"`, so imports use short paths: `'bases/baseConfig'`, `'views/viewRegistry'`, etc. The vitest config mirrors these aliases. The `obsidian` module is mocked at `__mocks__/obsidian.ts` for tests.

### Public API

`src/api.ts` → `ProgrammaticBasesAPI` exposes `BaseBuilder`, the three view builders, `Property`, `createBase`, and `writeBase` as `window.programmaticBases.*`.

### Primitives

`src/primitives/` contains the leaf value types: `Property`, `Filter`/`FilterGroup`, `Formula`, `PropertyDisplay`, `PropertyOrder`. All serialize/deserialize symmetrically.
