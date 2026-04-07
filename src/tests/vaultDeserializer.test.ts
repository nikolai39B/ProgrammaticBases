// vaultDeserializer.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VaultDeserializer } from 'fileManagement/vaultDeserializer';
import { App } from 'obsidian';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeApp(files: Record<string, string>): App {
  return {
    vault: {
      getFileByPath: vi.fn((path: string) => {
        return path in files ? { path } : null;
      }),
      read: vi.fn((file: { path: string }) => {
        return Promise.resolve(files[file.path]);
      }),
    },
  } as unknown as App;
}

// ─── deserialize ──────────────────────────────────────────────────────────────

describe('VaultDeserializer.deserialize', () => {
  it('deserializes a simple YAML file', async () => {
    const app = makeApp({
      'test.yaml': 'name: hello\nvalue: 42',
    });

    const deserializer = new VaultDeserializer(app, new Map(), '');
    const result = await deserializer.deserialize('test.yaml');

    expect(result).toEqual({ name: 'hello', value: 42 });
  });

  it('throws if file is not found', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '');

    await expect(deserializer.deserialize('missing.yaml'))
      .rejects.toThrow('File not found: missing.yaml');
  });

  it('resolves !sub tags by loading the referenced file from the components folder', async () => {
    const app = makeApp({
      'base.yaml': 'filter: !sub sub',
      'components/sub.yaml': 'operator: and\nchildren: []',
    });

    const deserializer = new VaultDeserializer(app, new Map(), 'components');
    const result = await deserializer.deserialize('base.yaml') as Record<string, unknown>;

    expect(result.filter).toEqual({ operator: 'and', children: [] });
  });

  it('resolves nested !sub tags', async () => {
    const app = makeApp({
      'base.yaml': 'filter: !sub a',
      'components/a.yaml': 'nested: !sub b',
      'components/b.yaml': 'value: deep',
    });

    const deserializer = new VaultDeserializer(app, new Map(), 'components');
    const result = await deserializer.deserialize('base.yaml') as Record<string, unknown>;

    expect(result.filter).toEqual({ nested: { value: 'deep' } });
  });

  it('resolves !sub tags in arrays', async () => {
    const app = makeApp({
      'base.yaml': 'items:\n  - !sub a\n  - !sub b',
      'components/a.yaml': 'value: first',
      'components/b.yaml': 'value: second',
    });

    const deserializer = new VaultDeserializer(app, new Map(), 'components');
    const result = await deserializer.deserialize('base.yaml') as Record<string, unknown>;

    expect(result.items).toEqual([{ value: 'first' }, { value: 'second' }]);
  });

  it('resolves promises nested inside objects', async () => {
    const app = makeApp({
      'base.yaml': 'a: !sub a\nb: !sub b',
      'components/a.yaml': 'value: 1',
      'components/b.yaml': 'value: 2',
    });

    const deserializer = new VaultDeserializer(app, new Map(), 'components');
    const result = await deserializer.deserialize('base.yaml') as Record<string, unknown>;

    expect(result).toEqual({
      a: { value: 1 },
      b: { value: 2 },
    });
  });

  it('throws on circular !sub references', async () => {
    const app = makeApp({
      'base.yaml': 'ref: !sub a_comp',
      'components/a_comp.yaml': 'ref: !sub b_comp',
      'components/b_comp.yaml': 'ref: !sub a_comp',
    });

    const deserializer = new VaultDeserializer(app, new Map(), 'components');

    await expect(deserializer.deserialize('base.yaml'))
      .rejects.toThrow('Circular !sub reference detected: components/a_comp.yaml');
  });

  it('throws on path traversal attempts', async () => {
    const app = makeApp({
      'base.yaml': 'filter: !sub ../secret.yaml',
    });

    const deserializer = new VaultDeserializer(app, new Map(), 'components');

    await expect(deserializer.deserialize('base.yaml'))
      .rejects.toThrow('Invalid !sub path: ../secret.yaml');
  });

  it('deserializes a scalar value', async () => {
    const app = makeApp({
      'test.yaml': 'hello',
    });

    const deserializer = new VaultDeserializer(app, new Map(), '');
    const result = await deserializer.deserialize('test.yaml');

    expect(result).toBe('hello');
  });

  it('deserializes an array', async () => {
    const app = makeApp({
      'test.yaml': '- a\n- b\n- c',
    });

    const deserializer = new VaultDeserializer(app, new Map(), '');
    const result = await deserializer.deserialize('test.yaml');

    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('throws when an unqualified !sub component is not found in the vault folder', async () => {
    const app = makeApp({
      'base.yaml': 'filter: !sub missing',
    });

    const deserializer = new VaultDeserializer(app, new Map(), 'components');

    await expect(deserializer.deserialize('base.yaml'))
      .rejects.toThrow('Component not found: "missing"');
  });
});

// ─── resolveRef — qualified refs ──────────────────────────────────────────────

describe('VaultDeserializer — qualified !sub error cases', () => {
  it('throws when the source qualifier is unknown', async () => {
    const app = makeApp({ 'base.yaml': 'x: !sub unknown-plugin:some/key' });
    const deserializer = new VaultDeserializer(app, new Map(), '');
    await expect(deserializer.deserialize('base.yaml'))
      .rejects.toThrow('Unknown source qualifier "unknown-plugin"');
  });

  it('throws when the component key is not found in the source', async () => {
    const app = makeApp({ 'base.yaml': 'x: !sub my-plugin:missing/key' });
    const sources = new Map([['my-plugin', { name: 'my-plugin', components: {} }]]);
    const deserializer = new VaultDeserializer(app, sources, '');
    await expect(deserializer.deserialize('base.yaml'))
      .rejects.toThrow('Component "missing/key" not found in source "my-plugin"');
  });

  it('throws on path traversal in a qualified key', async () => {
    const app = makeApp({ 'base.yaml': 'x: !sub my-plugin:../secret' });
    const sources = new Map([['my-plugin', { name: 'my-plugin', components: {} }]]);
    const deserializer = new VaultDeserializer(app, sources, '');
    await expect(deserializer.deserialize('base.yaml'))
      .rejects.toThrow('Invalid !sub path: my-plugin:../secret');
  });
});

// ─── deserializeContent ───────────────────────────────────────────────────────

describe('VaultDeserializer.deserializeContent', () => {
  it('deserializes a raw YAML string', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '');
    const result = await deserializer.deserializeContent('name: hello\nvalue: 42', 'test');
    expect(result).toEqual({ name: 'hello', value: 42 });
  });

  it('resolves qualified !sub refs against registered sources', async () => {
    const app = makeApp({});
    const sources = new Map([
      ['my-plugin', { name: 'my-plugin', components: { 'filter/isTask': 'field: type\nvalue: task' } }],
    ]);
    const deserializer = new VaultDeserializer(app, sources, '');
    const result = await deserializer.deserializeContent('filter: !sub my-plugin:filter/isTask', 'base') as Record<string, unknown>;
    expect(result.filter).toEqual({ field: 'type', value: 'task' });
  });

  it('throws on circular references in memory content', async () => {
    const app = makeApp({});
    const sources = new Map([
      ['p', { name: 'p', components: { 'a': '!sub p:b', 'b': '!sub p:a' } }],
    ]);
    const deserializer = new VaultDeserializer(app, sources, '');
    await expect(deserializer.deserializeContent('!sub p:a', 'root'))
      .rejects.toThrow('Circular !sub reference detected: p:a');
  });
});
