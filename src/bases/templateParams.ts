// templateParams.ts

/**
 * Valid types for a template parameter. Determines the input control
 * rendered in the param collection modal.
 */
export type ParamType = 'string' | 'boolean' | 'folder' | 'number' | 'date' | 'datetime';

/** A single runtime param value. */
export type ParamValue = string | boolean | number;

/**
 * Declaration of a single parameter as written in a template's or
 * component's `metadata.params` block.
 */
export interface ParamSpec {
  /** Display label shown in the modal. Falls back to the param key if absent. */
  label?: string;
  /** Input type. Defaults to `'string'` for unknown or absent values. */
  type?: ParamType;
  /** Pre-filled default value shown in the modal. */
  default?: ParamValue;
}

/** Map of param name → spec, as declared in `metadata.params`. */
export type ParamSpecs = Record<string, ParamSpec>;

/**
 * A harvested param entry — the merged spec and the source paths of
 * every component that declared this param name.
 */
export interface HarvestedParam {
  spec: ParamSpec;
  /**
   * Source paths of every component that declared this param.
   * E.g. `["view/focused", "view/focused > filter/inThisFolder"]`.
   * Template-level params use an empty string `""` as their source.
   */
  sources: string[];
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

/**
 * Parses a raw `metadata.params` YAML value into a typed `ParamSpecs` map.
 * Returns `{}` for null, undefined, or non-object input.
 * Unknown `type` values coerce to `'string'`.
 */
export function parseParamSpecs(raw: unknown): ParamSpecs {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: ParamSpecs = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      result[key] = {};
      continue;
    }
    const v = value as Record<string, unknown>;
    const rawType = v['type'];
    const type: ParamType =
      rawType === 'boolean' || rawType === 'folder' ||
      rawType === 'number' || rawType === 'date' || rawType === 'datetime'
        ? (rawType as ParamType)
        : 'string';
    const defaultValue = v['default'];
    result[key] = {
      label: typeof v['label'] === 'string' ? v['label'] : undefined,
      type,
      default:
        type === 'boolean'
          ? Boolean(defaultValue)
          : type === 'number'
            ? (typeof defaultValue === 'number' ? defaultValue : undefined)
            : (typeof defaultValue === 'string' ? defaultValue : undefined),
    };
  }
  return result;
}

/**
 * Merges `specs` (from a component at `sourcePath`) into the running
 * `HarvestedParams` map. For params already present, the spec is
 * kept from the first declaration and `sourcePath` is appended to
 * the sources list.
 */
export function mergeHarvestedParams(
  into: HarvestedParams,
  specs: ParamSpecs,
  sourcePath: string,
): void {
  for (const [name, spec] of Object.entries(specs)) {
    if (into[name]) {
      into[name].sources.push(sourcePath);
    } else {
      into[name] = { spec, sources: [sourcePath] };
    }
  }
}

/**
 * Builds the `params` object passed to `!exp`/`!fnc` when evaluating
 * nodes inside a component at `sourcePath`.
 *
 * Looks up `"sourcePath>paramName"` keys first; falls back to plain
 * `"paramName"` template-level keys. This lets components always
 * reference `params.taskLocation` regardless of scoping.
 */
export function buildScopedParams(
  resolved: ResolvedParams,
  sourcePath: string,
): Record<string, ParamValue> {
  const prefix = sourcePath ? `${sourcePath}>` : '';
  const result: Record<string, ParamValue> = {};

  // First pass: collect template-level (unprefixed) values as fallbacks
  for (const [key, value] of Object.entries(resolved)) {
    if (!key.includes('>')) {
      result[key] = value;
    }
  }

  // Second pass: source-scoped values override fallbacks
  if (prefix) {
    for (const [key, value] of Object.entries(resolved)) {
      if (key.startsWith(prefix)) {
        result[key.slice(prefix.length)] = value;
      }
    }
  }

  return result;
}
