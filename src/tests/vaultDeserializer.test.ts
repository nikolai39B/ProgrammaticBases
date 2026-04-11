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

  it('strips pb-metadata and returns remaining top-level keys', async () => {
    const app = makeApp({
      'template.yaml': 'pb-metadata:\n  params: {}\nname: hello\nvalue: 42',
    });
    const deserializer = new VaultDeserializer(app, new Map(), '');
    const result = await deserializer.deserialize('template.yaml');
    expect(result).toEqual({ name: 'hello', value: 42 });
  });

  it('strips pb-metadata from component files resolved via !sub', async () => {
    const app = makeApp({
      'base.yaml': 'filter: !sub comp',
      'components/comp.yaml': 'pb-metadata:\n  params:\n    x:\n      type: string\noperator: and',
    });
    const deserializer = new VaultDeserializer(app, new Map(), 'components');
    const result = await deserializer.deserialize('base.yaml') as Record<string, unknown>;
    expect(result.filter).toEqual({ operator: 'and' });
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

// ─── !exp tag ─────────────────────────────────────────────────────────────────

describe('VaultDeserializer — !exp tag', () => {
  it('evaluates a simple expression with params in scope', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '', { taskLocation: 'Tasks' });
    const result = await deserializer.deserializeContent('value: !exp params.taskLocation', 'test') as Record<string, unknown>;
    expect(result.value).toBe('Tasks');
  });

  it('evaluates an arithmetic expression', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '', { count: 5 });
    const result = await deserializer.deserializeContent('value: !exp params.count * 2', 'test') as Record<string, unknown>;
    expect(result.value).toBe(10);
  });

  it('returns null for !exp when params is empty and expression references params', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '');
    const result = await deserializer.deserializeContent('value: !exp params.x ?? null', 'test') as Record<string, unknown>;
    expect(result.value).toBeNull();
  });

  it('throws a descriptive error for syntax errors', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '');
    await expect(deserializer.deserializeContent('value: !exp a @@ b', 'test'))
      .rejects.toThrow('!exp evaluation failed');
  });
});

// ─── !fnc tag ─────────────────────────────────────────────────────────────────

describe('VaultDeserializer — !fnc tag', () => {
  it('evaluates a function body with params in scope', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '', { flag: true });
    const yaml = "value: !fnc |\n  if (params.flag) { return 'yes'; } return 'no';";
    const result = await deserializer.deserializeContent(yaml, 'test') as Record<string, unknown>;
    expect(result.value).toBe('yes');
  });

  it('evaluates a multi-line block scalar function body', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '', { items: ['a', 'b'] });
    const yaml = 'value: !fnc |\n  return params.items.length;';
    const result = await deserializer.deserializeContent(yaml, 'test') as Record<string, unknown>;
    expect(result.value).toBe(2);
  });

  it('resolves a Promise returned from !fnc via resolvePromises', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '', { x: 42 });
    const yaml = 'value: !fnc |\n  return Promise.resolve(params.x);';
    const result = await deserializer.deserializeContent(yaml, 'test') as Record<string, unknown>;
    expect(result.value).toBe(42);
  });

  it('throws a descriptive error for runtime errors', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '');
    const yaml = 'value: !fnc |\n  throw new Error("intentional");';
    await expect(deserializer.deserializeContent(yaml, 'test'))
      .rejects.toThrow('!fnc evaluation failed');
  });
});

// ─── harvestParams ────────────────────────────────────────────────────────────

describe('VaultDeserializer.harvestParams', () => {
  it('returns empty HarvestedParams for content with no !sub refs', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '');
    const result = await deserializer.harvestParams('views: []', 'test');
    expect(result).toEqual({});
  });

  it('harvests params from a directly referenced vault component', async () => {
    const app = makeApp({
      'components/comp.yaml':
        'pb-metadata:\n  params:\n    taskLocation:\n      type: folder\ntype: text',
    });
    const deserializer = new VaultDeserializer(app, new Map(), 'components');
    const result = await deserializer.harvestParams('filter: !sub comp', 'test');
    expect(result.taskLocation).toBeDefined();
    expect(result.taskLocation.spec.type).toBe('folder');
    expect(result.taskLocation.sources).toContain('comp');
  });

  it('harvests params from nested components and builds correct source paths', async () => {
    const app = makeApp({
      'components/outer.yaml':
        'pb-metadata:\n  params: {}\ninner: !sub inner',
      'components/inner.yaml':
        'pb-metadata:\n  params:\n    x:\n      type: string\nvalue: 1',
    });
    const deserializer = new VaultDeserializer(app, new Map(), 'components');
    const result = await deserializer.harvestParams('thing: !sub outer', 'test');
    expect(result.x).toBeDefined();
    // Source path should chain outer > inner
    expect(result.x.sources[0]).toContain('outer');
    expect(result.x.sources[0]).toContain('inner');
  });

  it('merges same-named params from multiple components, keeping first spec', async () => {
    const app = makeApp({
      'components/a.yaml':
        'pb-metadata:\n  params:\n    loc:\n      type: folder\nv: 1',
      'components/b.yaml':
        'pb-metadata:\n  params:\n    loc:\n      type: string\nv: 2',
    });
    const deserializer = new VaultDeserializer(app, new Map(), 'components');
    const result = await deserializer.harvestParams('x: !sub a\ny: !sub b', 'test');
    expect(result.loc.sources).toHaveLength(2);
    expect(result.loc.spec.type).toBe('folder'); // first declaration wins
  });

  it('treats !exp and !fnc as no-ops during harvest', async () => {
    const app = makeApp({});
    const deserializer = new VaultDeserializer(app, new Map(), '');
    // Should not throw even though params is empty
    const result = await deserializer.harvestParams('value: !exp params.x', 'test');
    expect(result).toEqual({});
  });
});
