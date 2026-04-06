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

    const deserializer = new VaultDeserializer(app);
    const result = await deserializer.deserialize('test.yaml');

    expect(result).toEqual({ name: 'hello', value: 42 });
  });

  it('throws if file is not found', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app);

    await expect(deserializer.deserialize('missing.yaml'))
      .rejects.toThrow('File not found: missing.yaml');
  });

  it('resolves !sub tags by loading the referenced file', async () => {
    const app = makeApp({
      'base.yaml': 'filter: !sub sub.yaml',
      'sub.yaml': 'operator: and\nchildren: []',
    });

    const deserializer = new VaultDeserializer(app);
    const result = await deserializer.deserialize('base.yaml') as Record<string, unknown>;

    expect(result.filter).toEqual({ operator: 'and', children: [] });
  });

  it('resolves nested !sub tags', async () => {
    const app = makeApp({
      'base.yaml': 'filter: !sub a.yaml',
      'a.yaml': 'nested: !sub b.yaml',
      'b.yaml': 'value: deep',
    });

    const deserializer = new VaultDeserializer(app);
    const result = await deserializer.deserialize('base.yaml') as Record<string, unknown>;

    expect(result.filter).toEqual({ nested: { value: 'deep' } });
  });

  it('resolves !sub tags in arrays', async () => {
    const app = makeApp({
      'base.yaml': 'items:\n  - !sub a.yaml\n  - !sub b.yaml',
      'a.yaml': 'value: first',
      'b.yaml': 'value: second',
    });

    const deserializer = new VaultDeserializer(app);
    const result = await deserializer.deserialize('base.yaml') as Record<string, unknown>;

    expect(result.items).toEqual([{ value: 'first' }, { value: 'second' }]);
  });

  it('resolves promises nested inside objects', async () => {
    const app = makeApp({
      'base.yaml': 'a: !sub a.yaml\nb: !sub b.yaml',
      'a.yaml': 'value: 1',
      'b.yaml': 'value: 2',
    });

    const deserializer = new VaultDeserializer(app);
    const result = await deserializer.deserialize('base.yaml') as Record<string, unknown>;

    expect(result).toEqual({
      a: { value: 1 },
      b: { value: 2 },
    });
  });

  it('throws on circular !sub references', async () => {
    const app = makeApp({
      'a.yaml': 'ref: !sub b.yaml',
      'b.yaml': 'ref: !sub a.yaml',
    });

    const deserializer = new VaultDeserializer(app);

    await expect(deserializer.deserialize('a.yaml'))
      .rejects.toThrow('Circular !sub reference detected: a.yaml');
  });

  it('throws on path traversal attempts', async () => {
    const app = makeApp({
      'base.yaml': 'filter: !sub ../secret.yaml',
    });

    const deserializer = new VaultDeserializer(app);

    await expect(deserializer.deserialize('base.yaml'))
      .rejects.toThrow('Invalid !sub path: ../secret.yaml');
  });

  it('deserializes a scalar value', async () => {
    const app = makeApp({
      'test.yaml': 'hello',
    });

    const deserializer = new VaultDeserializer(app);
    const result = await deserializer.deserialize('test.yaml');

    expect(result).toBe('hello');
  });

  it('deserializes an array', async () => {
    const app = makeApp({
      'test.yaml': '- a\n- b\n- c',
    });

    const deserializer = new VaultDeserializer(app);
    const result = await deserializer.deserialize('test.yaml');

    expect(result).toEqual(['a', 'b', 'c']);
  });
});