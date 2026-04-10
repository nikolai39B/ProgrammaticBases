---
name: pb-add-base-property
description: 'Add a new top-level property to BaseConfig in the programmatic-bases plugin. Use when adding a new field that should serialize to/from .base YAML files, be accessible on BaseConfig instances, and be settable via BaseBuilder. Examples: adding a new metadata key, a new optional config section, or a new top-level YAML key.'
---

# Add a New Top-Level Property to BaseConfig

## When to Use
- Adding a new top-level YAML key to `.base` files (e.g. `pb-metadata`, `summaries`)
- Adding a field that needs to round-trip through serialize/deserialize
- Exposing a new option via the fluent `BaseBuilder` API

## Files to Touch (in order)

| File | Change |
|------|--------|
| `src/bases/<newType>.ts` | Define the type/class for the new property (if complex) |
| `src/bases/baseConfigOptions.ts` | Add the optional field to `BaseConfigOptions` |
| `src/bases/baseConfig.ts` | Add getter, serialize, deserialize |
| `src/bases/baseBuilder.ts` | Add setter method |
| `src/tests/base.test.ts` | Add round-trip and builder tests |

---

## Step-by-Step Procedure

### 1. Define the type (if complex)

Create `src/bases/<myType>.ts`. Implement serialize/deserialize as static methods. Use `Record<string, unknown>` (not `Record<string, string>`) for the `raw` parameter to be compatible with `SerializationUtils`.

```typescript
export interface MyType {
  someField?: string;
}

export class MyTypeUtils {
  static readonly KEY = 'my-yaml-key';

  static serialize(value: MyType): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    if (value.someField !== undefined) obj.someField = value.someField;
    return obj;
  }

  static deserialize(raw: Record<string, unknown>): MyType {
    return {
      someField: typeof raw.someField === 'string' ? raw.someField : undefined,
    };
  }
}
```

For simple scalar types (string, number), no separate file is needed.

---

### 2. Add to `BaseConfigOptions`

In `src/bases/baseConfigOptions.ts`, add an import and an optional field:

```typescript
import { MyType } from './myType';

export interface BaseConfigOptions {
  // ...existing fields...
  myField?: MyType;
}
```

---

### 3. Update `BaseConfig`

In `src/bases/baseConfig.ts`:

**Import:**
```typescript
import { MyType, MyTypeUtils } from './myType';
```

**Getter** (after existing getters):
```typescript
get myField(): MyType | undefined { return this._options.myField; }
```

**In `serialize()`** (after the `properties` block):
```typescript
if (this.myField) {
  obj[MyTypeUtils.KEY] = MyTypeUtils.serialize(this.myField);
}
```

**In `static deserialize()`** (before `return new BaseConfig(...)`):
```typescript
const myField = raw[MyTypeUtils.KEY]
  ? MyTypeUtils.deserialize(raw[MyTypeUtils.KEY] as Record<string, unknown>)
  : undefined;

return new BaseConfig(views, { filters, formulas, properties, metadata, myField });
```

---

### 4. Add to `BaseBuilder`

In `src/bases/baseBuilder.ts`:

**Import:**
```typescript
import { MyType } from './myType';
```

**Setter method** (before `addView()`):
```typescript
setMyField(value: MyType): this {
  this.options.myField = value;
  return this;
}
```

---

### 5. Write tests

In `src/tests/base.test.ts` (or a new focused test file):

- **Round-trip**: `BaseConfig.deserialize(config.serialize(), registry)` preserves the field
- **Builder**: `new BaseBuilder().setMyField(...).addView(...).build()` sets the field correctly
- **Optional**: omitting the field produces no key in the serialized output
- **Deserialize missing key**: `raw` without the key → field is `undefined` (no error)

---

## Key Conventions

- **YAML key naming**: use `kebab-case` (e.g. `pb-metadata`, not `pbMetadata`)
- **Plugin-owned keys**: prefix with `pb-` to avoid clashing with native Obsidian base keys
- **`raw` parameter type**: always `Record<string, unknown>` — validate types explicitly inside `deserialize()`
- **Omit-if-absent pattern**: only emit the key in `serialize()` when the value is present; never emit `null` or `{}`
- **`BaseConfigOptions` field**: always optional (`?`); `BaseConfig` constructor never requires it
- **`BaseBuilder.options`**: is a plain `BaseConfigOptions` object initialized to `{}`; setters assign directly to it

## Real Example: `pb-metadata`

- Type file: `src/bases/baseMetadata.ts` → `BaseMetadata` interface + `BaseMetadataUtils`
- YAML key: `pb-metadata`
- Field on options: `metadata?: BaseMetadata`
- Getter: `get metadata(): BaseMetadata | undefined`
- Builder method: `setMetadata(metadata: BaseMetadata): this`
