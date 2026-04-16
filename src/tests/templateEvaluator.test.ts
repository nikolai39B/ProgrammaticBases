// templateEvaluator.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateEvaluator } from 'fileManagement/templateEvaluator';
import { TemplateSourceResolver, ExternalTemplateSource, VaultTemplateSource } from 'bases/templateSource';
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

/**
 * Creates a TemplateEvaluator with a real TemplateSourceResolver backed by the mocked app.
 * Returns both the evaluator and app for use in assertions.
 */
function makeEvaluator(
  files: Record<string, string>,
  sources: Map<string, any> = new Map(),
  componentsFolder: string = '',
) {
  const app = makeApp(files);
  const resolver = new TemplateSourceResolver(app, () => componentsFolder);
  const evaluator = new TemplateEvaluator(app, resolver, () => sources);
  return { evaluator, app };
}

/** Creates a VaultTemplateSource using the lazy path+app constructor (for test entry points). */
function vaultSrc(path: string, app: App): VaultTemplateSource {
  return new VaultTemplateSource(path, app);
}

// ─── evaluate — vault sources ─────────────────────────────────────────────────

describe('TemplateEvaluator.evaluate (vault source)', () => {
  it('evaluates a simple YAML file', async () => {
    const { evaluator, app } = makeEvaluator({ 'test.yaml': 'name: hello\nvalue: 42' });
    const result = await evaluator.evaluate(vaultSrc('test.yaml', app));
    expect(result).toEqual({ name: 'hello', value: 42 });
  });

  it('throws if file is not found', async () => {
    const { evaluator, app } = makeEvaluator({});
    await expect(evaluator.evaluate(vaultSrc('missing.yaml', app)))
      .rejects.toThrow('File not found: missing.yaml');
  });

  it('resolves !sub tags by loading the referenced file from the components folder', async () => {
    const { evaluator, app } = makeEvaluator(
      {
        'base.yaml': 'filter: !sub sub',
        'components/sub.yaml': 'operator: and\nchildren: []',
      },
      new Map(),
      'components',
    );
    const result = await evaluator.evaluate(vaultSrc('base.yaml', app)) as Record<string, unknown>;
    expect(result.filter).toEqual({ operator: 'and', children: [] });
  });

  it('resolves nested !sub tags', async () => {
    const { evaluator, app } = makeEvaluator(
      {
        'base.yaml': 'filter: !sub a',
        'components/a.yaml': 'nested: !sub b',
        'components/b.yaml': 'value: deep',
      },
      new Map(),
      'components',
    );
    const result = await evaluator.evaluate(vaultSrc('base.yaml', app)) as Record<string, unknown>;
    expect(result.filter).toEqual({ nested: { value: 'deep' } });
  });

  it('resolves !sub tags in arrays', async () => {
    const { evaluator, app } = makeEvaluator(
      {
        'base.yaml': 'items:\n  - !sub a\n  - !sub b',
        'components/a.yaml': 'value: first',
        'components/b.yaml': 'value: second',
      },
      new Map(),
      'components',
    );
    const result = await evaluator.evaluate(vaultSrc('base.yaml', app)) as Record<string, unknown>;
    expect(result.items).toEqual([{ value: 'first' }, { value: 'second' }]);
  });

  it('resolves promises nested inside objects', async () => {
    const { evaluator, app } = makeEvaluator(
      {
        'base.yaml': 'a: !sub a\nb: !sub b',
        'components/a.yaml': 'value: 1',
        'components/b.yaml': 'value: 2',
      },
      new Map(),
      'components',
    );
    const result = await evaluator.evaluate(vaultSrc('base.yaml', app)) as Record<string, unknown>;
    expect(result).toEqual({ a: { value: 1 }, b: { value: 2 } });
  });

  it('throws on circular !sub references', async () => {
    const { evaluator, app } = makeEvaluator(
      {
        'base.yaml': 'ref: !sub a_comp',
        'components/a_comp.yaml': 'ref: !sub b_comp',
        'components/b_comp.yaml': 'ref: !sub a_comp',
      },
      new Map(),
      'components',
    );
    await expect(evaluator.evaluate(vaultSrc('base.yaml', app)))
      .rejects.toThrow('Circular !sub reference detected: components/a_comp.yaml');
  });

  it('throws on path traversal attempts', async () => {
    const { evaluator, app } = makeEvaluator(
      { 'base.yaml': 'filter: !sub ../secret.yaml' },
      new Map(),
      'components',
    );
    await expect(evaluator.evaluate(vaultSrc('base.yaml', app)))
      .rejects.toThrow('Invalid !sub path: ../secret.yaml');
  });

  it('evaluates a scalar value', async () => {
    const { evaluator, app } = makeEvaluator({ 'test.yaml': 'hello' });
    const result = await evaluator.evaluate(vaultSrc('test.yaml', app));
    expect(result).toBe('hello');
  });

  it('evaluates an array', async () => {
    const { evaluator, app } = makeEvaluator({ 'test.yaml': '- a\n- b\n- c' });
    const result = await evaluator.evaluate(vaultSrc('test.yaml', app));
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('throws when an unqualified !sub component is not found in the vault folder', async () => {
    const { evaluator, app } = makeEvaluator(
      { 'base.yaml': 'filter: !sub missing' },
      new Map(),
      'components',
    );
    await expect(evaluator.evaluate(vaultSrc('base.yaml', app)))
      .rejects.toThrow('Component not found: "missing"');
  });

  it('strips pb-metadata and returns remaining top-level keys', async () => {
    const { evaluator, app } = makeEvaluator({
      'template.yaml': 'pb-metadata:\n  params: {}\nname: hello\nvalue: 42',
    });
    const result = await evaluator.evaluate(vaultSrc('template.yaml', app));
    expect(result).toEqual({ name: 'hello', value: 42 });
  });

  it('strips pb-metadata from component files resolved via !sub', async () => {
    const { evaluator, app } = makeEvaluator(
      {
        'base.yaml': 'filter: !sub comp',
        'components/comp.yaml': 'pb-metadata:\n  params:\n    x:\n      type: string\noperator: and',
      },
      new Map(),
      'components',
    );
    const result = await evaluator.evaluate(vaultSrc('base.yaml', app)) as Record<string, unknown>;
    expect(result.filter).toEqual({ operator: 'and' });
  });
});

// ─── evaluate — qualified !sub error cases ────────────────────────────────────

describe('TemplateEvaluator — qualified !sub error cases', () => {
  it('throws when the source qualifier is unknown', async () => {
    const { evaluator, app } = makeEvaluator({ 'base.yaml': 'x: !sub unknown-plugin:some/key' });
    await expect(evaluator.evaluate(vaultSrc('base.yaml', app)))
      .rejects.toThrow('Unknown source: "unknown-plugin"');
  });

  it('throws when the component key is not found in the source', async () => {
    const { evaluator, app } = makeEvaluator(
      { 'base.yaml': 'x: !sub my-plugin:missing/key' },
      new Map([['my-plugin', { name: 'my-plugin', components: {} }]]),
    );
    await expect(evaluator.evaluate(vaultSrc('base.yaml', app)))
      .rejects.toThrow('Component "missing/key" not found in source "my-plugin"');
  });

  it('throws when a qualified key is not found in the source', async () => {
    const { evaluator, app } = makeEvaluator(
      { 'base.yaml': 'x: !sub my-plugin:missing' },
      new Map([['my-plugin', { name: 'my-plugin', components: {} }]]),
    );
    await expect(evaluator.evaluate(vaultSrc('base.yaml', app)))
      .rejects.toThrow('Component "missing" not found in source "my-plugin"');
  });
});

// ─── evaluate — external sources ─────────────────────────────────────────────

describe('TemplateEvaluator.evaluate (external source)', () => {
  it('evaluates a raw YAML string from a registered template', async () => {
    const sources = new Map([
      ['test', { name: 'test', templates: { 'main': 'name: hello\nvalue: 42' } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluate(new ExternalTemplateSource('test', 'main'));
    expect(result).toEqual({ name: 'hello', value: 42 });
  });

  it('resolves qualified !sub refs against registered sources', async () => {
    const sources = new Map([
      ['base-src', { name: 'base-src', templates: { 'main': 'filter: !sub my-plugin:filter/isTask' } }],
      ['my-plugin', { name: 'my-plugin', components: { 'filter/isTask': 'field: type\nvalue: task' } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluate(new ExternalTemplateSource('base-src', 'main')) as Record<string, unknown>;
    expect(result.filter).toEqual({ field: 'type', value: 'task' });
  });

  it('throws on circular references in memory content', async () => {
    const sources = new Map([
      ['root', { name: 'root', templates: { 'main': '!sub p:a' } }],
      ['p', { name: 'p', components: { 'a': '!sub p:b', 'b': '!sub p:a' } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    await expect(evaluator.evaluate(new ExternalTemplateSource('root', 'main')))
      .rejects.toThrow('Circular !sub reference detected: p:a');
  });

  it('throws when the template is not registered', async () => {
    const { evaluator } = makeEvaluator({}, new Map());
    await expect(evaluator.evaluate(new ExternalTemplateSource('unknown', 'main')))
      .rejects.toThrow('Unknown source: "unknown"');
  });
});

// ─── !exp tag ─────────────────────────────────────────────────────────────────

describe('TemplateEvaluator — !exp tag', () => {
  it('evaluates a simple expression with params in scope', async () => {
    const sources = new Map([
      ['test', { name: 'test', templates: { 'main': 'value: !exp params.taskLocation' } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluate(
      new ExternalTemplateSource('test', 'main'),
      { taskLocation: 'Tasks' },
    ) as Record<string, unknown>;
    expect(result.value).toBe('Tasks');
  });

  it('evaluates an arithmetic expression', async () => {
    const sources = new Map([
      ['test', { name: 'test', templates: { 'main': 'value: !exp params.count * 2' } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluate(
      new ExternalTemplateSource('test', 'main'),
      { count: 5 },
    ) as Record<string, unknown>;
    expect(result.value).toBe(10);
  });

  it('returns null for !exp when params is empty and expression references params', async () => {
    const sources = new Map([
      ['test', { name: 'test', templates: { 'main': 'value: !exp params.x ?? null' } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluate(new ExternalTemplateSource('test', 'main')) as Record<string, unknown>;
    expect(result.value).toBeNull();
  });

  it('throws a descriptive error for syntax errors', async () => {
    const sources = new Map([
      ['test', { name: 'test', templates: { 'main': 'value: !exp a @@ b' } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    await expect(evaluator.evaluate(new ExternalTemplateSource('test', 'main')))
      .rejects.toThrow('!exp evaluation failed');
  });
});

// ─── !fnc tag ─────────────────────────────────────────────────────────────────

describe('TemplateEvaluator — !fnc tag', () => {
  it('evaluates a function body with params in scope', async () => {
    const yaml = "value: !fnc |\n  if (params.flag) { return 'yes'; } return 'no';";
    const sources = new Map([['test', { name: 'test', templates: { 'main': yaml } }]]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluate(
      new ExternalTemplateSource('test', 'main'),
      { flag: true },
    ) as Record<string, unknown>;
    expect(result.value).toBe('yes');
  });

  it('evaluates a multi-line block scalar function body', async () => {
    const yaml = 'value: !fnc |\n  return params.items.length;';
    const sources = new Map([['test', { name: 'test', templates: { 'main': yaml } }]]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluate(
      new ExternalTemplateSource('test', 'main'),
      { items: ['a', 'b'] as any },
    ) as Record<string, unknown>;
    expect(result.value).toBe(2);
  });

  it('resolves a Promise returned from !fnc via resolvePromises', async () => {
    const yaml = 'value: !fnc |\n  return Promise.resolve(params.x);';
    const sources = new Map([['test', { name: 'test', templates: { 'main': yaml } }]]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluate(
      new ExternalTemplateSource('test', 'main'),
      { x: 42 },
    ) as Record<string, unknown>;
    expect(result.value).toBe(42);
  });

  it('throws a descriptive error for runtime errors', async () => {
    const yaml = 'value: !fnc |\n  throw new Error("intentional");';
    const sources = new Map([['test', { name: 'test', templates: { 'main': yaml } }]]);
    const { evaluator } = makeEvaluator({}, sources);
    await expect(evaluator.evaluate(new ExternalTemplateSource('test', 'main')))
      .rejects.toThrow('!fnc evaluation failed');
  });
});

// ─── collectParams — vault sources ───────────────────────────────────────────

describe('TemplateEvaluator.collectParams (vault source)', () => {
  it('harvests params from a vault file by path', async () => {
    const { evaluator, app } = makeEvaluator({
      'templates/board.yaml':
        'pb-metadata:\n  params:\n    taskLocation:\n      type: folder\nviews: []',
    });
    const result = await evaluator.collectParams(vaultSrc('templates/board.yaml', app));
    expect(result.taskLocation).toBeDefined();
    expect(result.taskLocation!.spec.type).toBe('folder');
    expect(result.taskLocation!.sources).toContain('');
  });

  it('harvests params from the template and its components', async () => {
    const { evaluator, app } = makeEvaluator(
      {
        'templates/board.yaml': 'pb-metadata:\n  params:\n    x:\n      type: string\nfilter: !sub comp',
        'components/comp.yaml': 'pb-metadata:\n  params:\n    y:\n      type: folder\nv: 1',
      },
      new Map(),
      'components',
    );
    const result = await evaluator.collectParams(vaultSrc('templates/board.yaml', app));
    expect(result.x).toBeDefined();
    expect(result.x!.sources).toContain('');
    expect(result.y).toBeDefined();
    expect(result.y!.sources).toContain('comp');
  });

  it('throws when the file does not exist', async () => {
    const { evaluator, app } = makeEvaluator({});
    await expect(evaluator.collectParams(vaultSrc('missing.yaml', app)))
      .rejects.toThrow('File not found: missing.yaml');
  });
});

// ─── collectParams — external sources ────────────────────────────────────────

describe('TemplateEvaluator.collectParams (external source)', () => {
  it('returns empty HarvestedParams for content with no pb-metadata.params', async () => {
    const sources = new Map([['test', { name: 'test', templates: { 'main': 'views: []' } }]]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.collectParams(new ExternalTemplateSource('test', 'main'));
    expect(result).toEqual({});
  });

  it('harvests params from a directly referenced vault component', async () => {
    const sources = new Map([['test', { name: 'test', templates: { 'main': 'filter: !sub comp' } }]]);
    const { evaluator } = makeEvaluator(
      { 'components/comp.yaml': 'pb-metadata:\n  params:\n    taskLocation:\n      type: folder\ntype: text' },
      sources,
      'components',
    );
    const result = await evaluator.collectParams(new ExternalTemplateSource('test', 'main'));
    expect(result.taskLocation).toBeDefined();
    expect(result.taskLocation!.spec.type).toBe('folder');
    expect(result.taskLocation!.sources).toContain('comp');
  });

  it('harvests params from nested components and builds correct source paths', async () => {
    const sources = new Map([['test', { name: 'test', templates: { 'main': 'thing: !sub outer' } }]]);
    const { evaluator } = makeEvaluator(
      {
        'components/outer.yaml': 'pb-metadata:\n  params: {}\ninner: !sub inner',
        'components/inner.yaml': 'pb-metadata:\n  params:\n    x:\n      type: string\nvalue: 1',
      },
      sources,
      'components',
    );
    const result = await evaluator.collectParams(new ExternalTemplateSource('test', 'main'));
    expect(result.x).toBeDefined();
    expect(result.x!.sources[0]).toContain('outer');
    expect(result.x!.sources[0]).toContain('inner');
  });

  it('merges same-named params from multiple components, keeping first spec', async () => {
    const sources = new Map([['test', { name: 'test', templates: { 'main': 'x: !sub a\ny: !sub b' } }]]);
    const { evaluator } = makeEvaluator(
      {
        'components/a.yaml': 'pb-metadata:\n  params:\n    loc:\n      type: folder\nv: 1',
        'components/b.yaml': 'pb-metadata:\n  params:\n    loc:\n      type: string\nv: 2',
      },
      sources,
      'components',
    );
    const result = await evaluator.collectParams(new ExternalTemplateSource('test', 'main'));
    expect(result.loc).toBeDefined();
    expect(result.loc!.sources).toHaveLength(2);
    expect(result.loc!.spec.type).toBe('folder'); // first declaration wins
  });

  it('treats !exp and !fnc as no-ops during harvest', async () => {
    const sources = new Map([['test', { name: 'test', templates: { 'main': 'value: !exp params.x' } }]]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.collectParams(new ExternalTemplateSource('test', 'main'));
    expect(result).toEqual({});
  });
});
