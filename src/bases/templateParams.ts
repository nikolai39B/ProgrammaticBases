// templateParams.ts

/** A single runtime param value. */
export type ParamValue = string | boolean | number;

interface BaseParamSpec {
  /** Display label shown in the modal. Falls back to the param key if absent. */
  label?: string;
  /** Helper text shown below the input in the modal. */
  description?: string;
  /** Pre-filled default value shown in the modal. */
  default?: ParamValue;
  /**
   * When `true`, the field may be left blank. Absent or `false` means the
   * field is required — the modal will not advance until it is filled.
   */
  optional?: boolean;
}

/**
 * Declaration of a single parameter as written in a template's or
 * component's `metadata.params` block. Discriminated by `type`.
 */
export type ParamSpec =
  | (BaseParamSpec & { type: 'string' })
  | (BaseParamSpec & { type: 'boolean' })
  | (BaseParamSpec & { type: 'folder' })
  | (BaseParamSpec & { type: 'date' })
  | (BaseParamSpec & { type: 'datetime' })
  | (BaseParamSpec & { type: 'number'; min?: number; max?: number })
  | (BaseParamSpec & { type: 'enum'; options: string[] });

/** All valid param type names. Single source of truth for both the type and runtime checks. */
export const PARAM_TYPES = ['string', 'boolean', 'folder', 'date', 'datetime', 'number', 'enum'] as const;
export type ParamType = (typeof PARAM_TYPES)[number];

/** Returns true if `value` is a recognised `ParamType`. */
export function isParamType(value: unknown): value is ParamType {
  return (PARAM_TYPES as readonly string[]).includes(value as string);
}

/** Map of param name → spec, as declared in `metadata.params`. */
export type ParamSpecs = Record<string, ParamSpec>;

/**
 * A harvested param entry — every source's full spec, keyed by source path.
 * `""` is the template-level source; component paths are used for nested sources.
 * Insertion order mirrors discovery order.
 */
export interface HarvestedParam {
  specs: Record<string, ParamSpec>;
}

/**
 * All params discovered across a template and its transitive `!sub`
 * components, keyed by param name.
 */
export type HarvestedParams = Record<string, HarvestedParam>;

/**
 * The flat map of user-supplied values stored in `pb-metadata.params`
 * and passed to `VaultDeserializer` during Pass 2.
 *
 * Keys use the format `"sourcePath>paramName"` for component-scoped
 * values, or plain `"paramName"` for template-level values.
 * The modal is responsible for fanning merged values out to all
 * relevant source-scoped keys.
 */
export type ResolvedParams = Record<string, ParamValue>;

/** Returns a type-safe default value for a param, or `undefined` if the raw
 *  value doesn't match the expected JS type. Booleans are always coerced
 *  (so an absent default becomes `false`). */
function coerceDefault(type: ParamType, value: unknown): ParamValue | undefined {
  if (type === 'boolean') return Boolean(value);
  if (type === 'number') return typeof value === 'number' ? value : undefined;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Parses a raw `metadata.params` YAML value into a typed `ParamSpecs` map.
 * Returns `{}` for null, undefined, or non-object input.
 * Unknown `type` values coerce to `'string'`.
 */
export function parseParamSpecs(raw: unknown): ParamSpecs {
  // Skip non-objects
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};

  // Parse all the params
  const result: ParamSpecs = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    // Fall back to a plain string spec for non-object entry values
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      result[key] = { type: 'string' };
      continue;
    }

    // Get the value type
    const v = value as Record<string, unknown>;
    const rawType = v['type'];
    if (!isParamType(rawType)) throw new Error(`Unknown param type: ${String(rawType)}`);
    const type = rawType;

    // Shared base fields
    const base: BaseParamSpec = {
      label: typeof v['label'] === 'string' ? v['label'] : undefined,
      description: typeof v['description'] === 'string' ? v['description'] : undefined,
      default: coerceDefault(type, v['default']),
      optional: v['optional'] === true ? true : undefined,
    };

    if (type === 'number') {
      result[key] = {
        ...base,
        type,
        ...(typeof v['min'] === 'number' ? { min: v['min'] } : {}),
        ...(typeof v['max'] === 'number' ? { max: v['max'] } : {}),
      };
    } else if (type === 'enum') {
      const rawOptions = v['options'];
      const options = Array.isArray(rawOptions)
        ? rawOptions.filter((o): o is string => typeof o === 'string')
        : [];
      result[key] = { ...base, type, options };
    } else {
      result[key] = { ...base, type };
    }
  }
  return result;
}

/**
 * Records `specs` (from a source at `sourcePath`) into the running
 * `HarvestedParams` map. Each source's spec is stored independently
 * under its source path, preserving per-source labels, descriptions,
 * defaults, and types.
 */
export function mergeHarvestedParams(
  into: HarvestedParams,
  specs: ParamSpecs,
  sourcePath: string,
): void {
  for (const [name, spec] of Object.entries(specs)) {
    if (!into[name]) {
      into[name] = { specs: {} };
    }
    into[name]!.specs[sourcePath] = spec;
  }
}

/**
 * Builds the `params` object passed to `!exp`/`!fnc` when evaluating
 * nodes at `sourcePath`.
 *
 * At template level (`sourcePath` is empty): exposes plain unprefixed keys.
 * Inside a component: exposes only keys scoped to that exact path,
 * stripped of the `"sourcePath>"` prefix.
 *
 * The modal fans values out to all relevant scoped keys before storing
 * them, so no cross-scope fallback is needed here.
 */
export function buildScopedParams(
  resolved: ResolvedParams,
  sourcePath: string,
): Record<string, ParamValue> {
  const entries = Object.entries(resolved);

  // Handle base parameters
  if (!sourcePath) {
    return Object.fromEntries(entries.filter(([k]) => !k.includes('>')));
  }

  // Handle component parameters
  const prefix = `${sourcePath}>`;
  return Object.fromEntries(
    entries
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => [k.slice(prefix.length), v])
  );
}
