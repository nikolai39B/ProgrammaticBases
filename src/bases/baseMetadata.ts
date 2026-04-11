// baseMetadata.ts

import { ResolvedParams } from './templateParams';

/**
 * Plugin-managed metadata stored in the `pb-metadata` key of a `.base` file.
 * All programmatic-bases metadata lives here to avoid polluting the top-level YAML.
 */
export interface BaseMetadata {
  /** Vault-relative path (or plugin ref) to the template this base was created from. */
  template?: string;
  /** The param values supplied at creation/update time, for re-use on subsequent updates. */
  params?: ResolvedParams;
}

export class BaseMetadataUtils {
  static readonly KEY = 'pb-metadata';

  static serialize(metadata: BaseMetadata): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    if (metadata.template !== undefined) {
      obj.template = metadata.template;
    }
    if (metadata.params !== undefined && Object.keys(metadata.params).length > 0) {
      obj.params = metadata.params;
    }
    return obj;
  }

  static deserialize(raw: Record<string, unknown>): BaseMetadata {
    const params =
      raw.params &&
      typeof raw.params === 'object' &&
      !Array.isArray(raw.params)
        ? (raw.params as ResolvedParams)
        : undefined;
    return {
      template: typeof raw.template === 'string' ? raw.template : undefined,
      params,
    };
  }
}
