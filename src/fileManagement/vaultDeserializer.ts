import * as yaml from 'js-yaml';
import { App } from 'obsidian';

export class VaultDeserializer {
    constructor(private app: App) {}

    deserialize(path: string): Promise<unknown> {
        return deserialize(path, this.app);
    }
}

async function deserialize(path: string, app: App): Promise<unknown> {
    const file = app.vault.getFileByPath(path);
    if (!file) {
        throw new Error(`File not found: ${path}`);
    }

    const content = await app.vault.read(file);
    const schema = buildSchema(app);
    const raw = yaml.load(content, { schema });

    return resolvePromises(raw);
}

function buildSchema(app: App): yaml.Schema {
    const subTag = new yaml.Type('!sub', {
        kind: 'scalar',
        resolve: (data: unknown) => typeof data === 'string',
        construct: (path: string) => deserialize(path, app),
    });

    return yaml.DEFAULT_SCHEMA.extend([subTag]);
}

async function resolvePromises(value: unknown): Promise<unknown> {
    if (value instanceof Promise) {
        return resolvePromises(await value);
    }

    if (Array.isArray(value)) {
        return Promise.all(value.map(resolvePromises));
    }

    if (value !== null && typeof value === 'object') {
        const entries = await Promise.all(
            Object.entries(value as Record<string, unknown>).map(
                async ([k, v]) => [k, await resolvePromises(v)] as const
            )
        );
        return Object.fromEntries(entries);
    }

    return value;
}