// templateEvaluator.test.ts

import { describe, it, expect, vi } from 'vitest';
import { TemplateEvaluator } from 'fileManagement/templateEvaluator';
import { TemplateSourceResolver, QualifiedTemplateSource, VaultTemplateSource } from 'bases/templateSource';
import { App } from 'obsidian';

// BaseConfig.deserialize and BaseBuilder are pass-through mocks so the raw
// YAML object flows through evaluateTemplate unchanged, letting assertions
// check the resolved YAML structure directly.
vi.mock('bases/baseConfig', () => ({
  BaseConfig: { deserialize: vi.fn((raw: unknown) => raw) },
}));
vi.mock('bases/baseBuilder', () => ({
  BaseBuilder: vi.fn().mockImplementation(function (this: any, config: unknown) {
    this.setMetadata = vi.fn().mockReturnThis();
    this.build = vi.fn(() => config);
  }),
}));

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
  basesFolder: string = '',
) {
  const app = makeApp(files);
  const resolver = new TemplateSourceResolver(() => componentsFolder, () => basesFolder);
  const evaluator = new TemplateEvaluator(app, resolver, () => sources, () => ({} as any));
  return { evaluator, app };
}

function vaultSrc(path: string): VaultTemplateSource {
  return new VaultTemplateSource(path, path);
}

// ─── evaluateTemplate — vault sources ────────────────────────────────────────

describe('TemplateEvaluator.evaluateTemplate (vault source)', () => {
  it('evaluates a simple YAML file', async () => {
    const { evaluator, app } = makeEvaluator({ 'test.yaml': 'name: hello\nvalue: 42' });
    const result = await evaluator.evaluateTemplate(vaultSrc('test.yaml'));
    expect(result).toEqual({ name: 'hello', value: 42 });
  });

  it('throws if file is not found', async () => {
    const { evaluator, app } = makeEvaluator({});
    await expect(evaluator.evaluateTemplate(vaultSrc('missing.yaml')))
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
    const result = await evaluator.evaluateTemplate(vaultSrc('base.yaml')) as unknown as Record<string, unknown>;
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
    const result = await evaluator.evaluateTemplate(vaultSrc('base.yaml')) as unknown as Record<string, unknown>;
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
    const result = await evaluator.evaluateTemplate(vaultSrc('base.yaml')) as unknown as Record<string, unknown>;
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
    const result = await evaluator.evaluateTemplate(vaultSrc('base.yaml')) as unknown as Record<string, unknown>;
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
    await expect(evaluator.evaluateTemplate(vaultSrc('base.yaml')))
      .rejects.toThrow('Circular !sub reference detected: a_comp');
  });

  it('throws on path traversal attempts', async () => {
    const { evaluator, app } = makeEvaluator(
      { 'base.yaml': 'filter: !sub ../secret.yaml' },
      new Map(),
      'components',
    );
    await expect(evaluator.evaluateTemplate(vaultSrc('base.yaml')))
      .rejects.toThrow('Invalid ref path: ../secret.yaml');
  });

  it('throws when the template evaluates to a scalar', async () => {
    const { evaluator } = makeEvaluator({ 'test.yaml': 'hello' });
    await expect(evaluator.evaluateTemplate(vaultSrc('test.yaml')))
      .rejects.toThrow('Template "test.yaml" must evaluate to a YAML object');
  });

  it('throws when the template evaluates to an array', async () => {
    const { evaluator } = makeEvaluator({ 'test.yaml': '- a\n- b\n- c' });
    await expect(evaluator.evaluateTemplate(vaultSrc('test.yaml')))
      .rejects.toThrow('Template "test.yaml" must evaluate to a YAML object');
  });

  it('resolves a !sub component that is a bare scalar', async () => {
    const { evaluator } = makeEvaluator(
      {
        'base.yaml': 'filter: !sub scalar-comp',
        'components/scalar-comp.yaml': 'status == "done"',
      },
      new Map(),
      'components',
    );
    const result = await evaluator.evaluateTemplate(vaultSrc('base.yaml')) as unknown as Record<string, unknown>;
    expect(result.filter).toBe('status == "done"');
  });

  it('resolves a !sub component that is a bare array', async () => {
    const { evaluator } = makeEvaluator(
      {
        'base.yaml': 'tags: !sub array-comp',
        'components/array-comp.yaml': '- work\n- active',
      },
      new Map(),
      'components',
    );
    const result = await evaluator.evaluateTemplate(vaultSrc('base.yaml')) as unknown as Record<string, unknown>;
    expect(result.tags).toEqual(['work', 'active']);
  });

  it('throws when an unqualified !sub component is not found in the vault folder', async () => {
    const { evaluator, app } = makeEvaluator(
      { 'base.yaml': 'filter: !sub missing' },
      new Map(),
      'components',
    );
    await expect(evaluator.evaluateTemplate(vaultSrc('base.yaml')))
      .rejects.toThrow('File not found: components/missing.yaml');
  });

  it('strips pb-metadata and returns remaining top-level keys', async () => {
    const { evaluator, app } = makeEvaluator({
      'template.yaml': 'pb-metadata:\n  params: {}\nname: hello\nvalue: 42',
    });
    const result = await evaluator.evaluateTemplate(vaultSrc('template.yaml'));
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
    const result = await evaluator.evaluateTemplate(vaultSrc('base.yaml')) as unknown as Record<string, unknown>;
    expect(result.filter).toEqual({ operator: 'and' });
  });

  it('unwraps pb-content, returning its value as the resolved content', async () => {
    const { evaluator } = makeEvaluator({
      'template.yaml': 'pb-metadata:\n  params: {}\npb-content:\n  name: hello\n  value: 42',
    });
    const result = await evaluator.evaluateTemplate(vaultSrc('template.yaml'));
    expect(result).toEqual({ name: 'hello', value: 42 });
  });

  it('unwraps pb-content from !sub components', async () => {
    const { evaluator } = makeEvaluator(
      {
        'base.yaml': 'filter: !sub comp',
        'components/comp.yaml': 'pb-metadata:\n  params: {}\npb-content:\n  operator: and\n  children: []',
      },
      new Map(),
      'components',
    );
    const result = await evaluator.evaluateTemplate(vaultSrc('base.yaml')) as unknown as Record<string, unknown>;
    expect(result.filter).toEqual({ operator: 'and', children: [] });
  });

  it('unwraps pb-content without pb-metadata present', async () => {
    const { evaluator } = makeEvaluator({
      'template.yaml': 'pb-content:\n  name: hello',
    });
    const result = await evaluator.evaluateTemplate(vaultSrc('template.yaml'));
    expect(result).toEqual({ name: 'hello' });
  });
});

// ─── evaluate — qualified !sub error cases ────────────────────────────────────

describe('TemplateEvaluator — qualified !sub error cases', () => {
  it('throws when the source qualifier is unknown', async () => {
    const { evaluator, app } = makeEvaluator({ 'base.yaml': 'x: !sub unknown-plugin:some/key' });
    await expect(evaluator.evaluateTemplate(vaultSrc('base.yaml')))
      .rejects.toThrow('Unknown source: "unknown-plugin"');
  });

  it('throws when the component key is not found in the source', async () => {
    const { evaluator, app } = makeEvaluator(
      { 'base.yaml': 'x: !sub my-plugin:missing/key' },
      new Map([['my-plugin', { name: 'my-plugin', components: {} }]]),
    );
    await expect(evaluator.evaluateTemplate(vaultSrc('base.yaml')))
      .rejects.toThrow('Component "missing/key" not found in source "my-plugin"');
  });

  it('throws when a qualified key is not found in the source', async () => {
    const { evaluator, app } = makeEvaluator(
      { 'base.yaml': 'x: !sub my-plugin:missing' },
      new Map([['my-plugin', { name: 'my-plugin', components: {} }]]),
    );
    await expect(evaluator.evaluateTemplate(vaultSrc('base.yaml')))
      .rejects.toThrow('Component "missing" not found in source "my-plugin"');
  });
});

// ─── evaluate — external sources ─────────────────────────────────────────────

describe('TemplateEvaluator.evaluateTemplate (external source)', () => {
  it('evaluates a raw YAML string from a registered template', async () => {
    const sources = new Map([
      ['test', { name: 'test', templates: { 'main': 'name: hello\nvalue: 42' } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluateTemplate(new QualifiedTemplateSource('test', 'main'));
    expect(result).toEqual({ name: 'hello', value: 42 });
  });

  it('resolves qualified !sub refs against registered sources', async () => {
    const sources = new Map([
      ['base-src', { name: 'base-src', templates: { 'main': 'filter: !sub my-plugin:filter/isTask' } }],
      ['my-plugin', { name: 'my-plugin', components: { 'filter/isTask': 'field: type\nvalue: task' } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluateTemplate(new QualifiedTemplateSource('base-src', 'main')) as unknown as Record<string, unknown>;
    expect(result.filter).toEqual({ field: 'type', value: 'task' });
  });

  it('throws on circular references in memory content', async () => {
    const sources = new Map([
      ['root', { name: 'root', templates: { 'main': '!sub p:a' } }],
      ['p', { name: 'p', components: { 'a': '!sub p:b', 'b': '!sub p:a' } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    await expect(evaluator.evaluateTemplate(new QualifiedTemplateSource('root', 'main')))
      .rejects.toThrow('Circular !sub reference detected: p:a');
  });

  it('throws when the template is not registered', async () => {
    const { evaluator } = makeEvaluator({}, new Map());
    await expect(evaluator.evaluateTemplate(new QualifiedTemplateSource('unknown', 'main')))
      .rejects.toThrow('Unknown source: "unknown"');
  });
});

// ─── !param tag ─────────────────────────────────────────────────────────────────

describe('TemplateEvaluator — !param tag', () => {
  // Note: !param values containing {{ must be quoted in YAML since { is a
  // flow-mapping delimiter. E.g.  filter: !param "{{folder}}/tasks"

  it('interpolates a param value into a string', async () => {
    const sources = new Map([
      ['test', { name: 'test', templates: { 'main': "value: !param '{{taskLocation}}/boards'" } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluateTemplate(
      new QualifiedTemplateSource('test', 'main'),
      { taskLocation: 'Tasks' },
    ) as unknown as Record<string, unknown>;
    expect(result.value).toBe('Tasks/boards');
  });

  it('substitutes multiple params in one expression', async () => {
    const sources = new Map([
      ['test', { name: 'test', templates: { 'main': "value: !param '{{prefix}}-{{suffix}}'" } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluateTemplate(
      new QualifiedTemplateSource('test', 'main'),
      { prefix: 'foo', suffix: 'bar' },
    ) as unknown as Record<string, unknown>;
    expect(result.value).toBe('foo-bar');
  });

  it('replaces missing params with empty string', async () => {
    const sources = new Map([
      ['test', { name: 'test', templates: { 'main': "value: !param 'hello {{missing}} world'" } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluateTemplate(
      new QualifiedTemplateSource('test', 'main'),
    ) as unknown as Record<string, unknown>;
    expect(result.value).toBe('hello  world');
  });

  it('returns the string unchanged when no placeholders are present', async () => {
    const sources = new Map([
      ['test', { name: 'test', templates: { 'main': 'value: !param just a string' } }],
    ]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.evaluateTemplate(
      new QualifiedTemplateSource('test', 'main'),
    ) as unknown as Record<string, unknown>;
    expect(result.value).toBe('just a string');
  });
});

// ─── collectParams — vault sources ───────────────────────────────────────────

describe('TemplateEvaluator.collectParams (vault source)', () => {
  it('harvests params from a vault file by path', async () => {
    const { evaluator, app } = makeEvaluator({
      'templates/board.yaml':
        'pb-metadata:\n  params:\n    taskLocation:\n      type: folder\nviews: []',
    });
    const result = await evaluator.collectTemplateParams(vaultSrc('templates/board.yaml'));
    expect(result.taskLocation).toBeDefined();
    expect(result.taskLocation!.specs['']!.type).toBe('folder');
    expect(Object.keys(result.taskLocation!.specs)).toContain('');
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
    const result = await evaluator.collectTemplateParams(vaultSrc('templates/board.yaml'));
    expect(result.x).toBeDefined();
    expect(Object.keys(result.x!.specs)).toContain('');
    expect(result.y).toBeDefined();
    expect(Object.keys(result.y!.specs)).toContain('comp');
  });

  it('throws when the file does not exist', async () => {
    const { evaluator, app } = makeEvaluator({});
    await expect(evaluator.collectTemplateParams(vaultSrc('missing.yaml')))
      .rejects.toThrow('File not found: missing.yaml');
  });
});

// ─── collectParams — external sources ────────────────────────────────────────

describe('TemplateEvaluator.collectParams (external source)', () => {
  it('returns empty HarvestedParams for content with no pb-metadata.params', async () => {
    const sources = new Map([['test', { name: 'test', templates: { 'main': 'views: []' } }]]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.collectTemplateParams(new QualifiedTemplateSource('test', 'main'));
    expect(result).toEqual({});
  });

  it('harvests params from a directly referenced vault component', async () => {
    const sources = new Map([['test', { name: 'test', templates: { 'main': 'filter: !sub comp' } }]]);
    const { evaluator } = makeEvaluator(
      { 'components/comp.yaml': 'pb-metadata:\n  params:\n    taskLocation:\n      type: folder\ntype: text' },
      sources,
      'components',
    );
    const result = await evaluator.collectTemplateParams(new QualifiedTemplateSource('test', 'main'));
    expect(result.taskLocation).toBeDefined();
    expect(result.taskLocation!.specs['comp']!.type).toBe('folder');
    expect(Object.keys(result.taskLocation!.specs)).toContain('comp');
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
    const result = await evaluator.collectTemplateParams(new QualifiedTemplateSource('test', 'main'));
    expect(result.x).toBeDefined();
    const srcPath = Object.keys(result.x!.specs)[0]!;
    expect(srcPath).toContain('outer');
    expect(srcPath).toContain('inner');
  });

  it('stores each component\'s spec independently for same-named params', async () => {
    const sources = new Map([['test', { name: 'test', templates: { 'main': 'x: !sub a\ny: !sub b' } }]]);
    const { evaluator } = makeEvaluator(
      {
        'components/a.yaml': 'pb-metadata:\n  params:\n    loc:\n      type: folder\nv: 1',
        'components/b.yaml': 'pb-metadata:\n  params:\n    loc:\n      type: string\nv: 2',
      },
      sources,
      'components',
    );
    const result = await evaluator.collectTemplateParams(new QualifiedTemplateSource('test', 'main'));
    expect(result.loc).toBeDefined();
    expect(Object.keys(result.loc!.specs)).toHaveLength(2);
    expect(result.loc!.specs['a']!.type).toBe('folder');
    expect(result.loc!.specs['b']!.type).toBe('string');
  });

  it('treats !param as a no-op during harvest', async () => {
    const sources = new Map([['test', { name: 'test', templates: { 'main': "value: !param '{{x}}'" } }]]);
    const { evaluator } = makeEvaluator({}, sources);
    const result = await evaluator.collectTemplateParams(new QualifiedTemplateSource('test', 'main'));
    expect(result).toEqual({});
  });
});
