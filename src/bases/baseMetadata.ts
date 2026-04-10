// baseMetadata.ts

/**
 * Plugin-managed metadata stored in the `pb-metadata` key of a `.base` file.
 * All programmatic-bases metadata lives here to avoid polluting the top-level YAML.
 */
export interface BaseMetadata {
  /** Vault-relative path to the template this base was created from. */
  template?: string;
}

export class BaseMetadataUtils {
  static readonly KEY = 'pb-metadata';

  static serialize(metadata: BaseMetadata): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    if (metadata.template !== undefined) {
      obj.template = metadata.template;
    }
    return obj;
  }

  static deserialize(raw: Record<string, unknown>): BaseMetadata {
    return {
      template: typeof raw.template === 'string' ? raw.template : undefined,
    };
  }
}
