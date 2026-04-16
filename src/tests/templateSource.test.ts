// templateSource.test.ts

import { describe, it, expect, vi } from 'vitest';
import { TFile } from 'obsidian';
import {
  VaultTemplateSource,
  ExternalTemplateSource,
  TemplateSourceResolver,
} from 'bases/templateSource';

function makeTFile(path = 'Templates/my-template.yaml', basename = 'my-template'): TFile {
  const f = new TFile();
  f.path = path;
  f.basename = basename;
  return f;
}

// ── VaultTemplateSource (file constructor) ────────────────────────────────────

describe('VaultTemplateSource (file constructor)', () => {
  it('exposes the file path via .path', () => {
    const file = makeTFile('Templates/board.yaml');
    const source = new VaultTemplateSource(file);
    expect(source.path).toBe('Templates/board.yaml');
  });

  it('returns the file directly via .file', () => {
    const file = makeTFile();
    const source = new VaultTemplateSource(file);
    expect(source.file).toBe(file);
  });

  it('toRef() returns the vault-relative path', () => {
    const file = makeTFile('Bases/task-board.yaml');
    expect(new VaultTemplateSource(file).toRef()).toBe('Bases/task-board.yaml');
  });

  it('type is "vault"', () => {
    expect(new VaultTemplateSource(makeTFile()).type).toBe('vault');
  });
});

// ── VaultTemplateSource (path + app constructor) ──────────────────────────────

describe('VaultTemplateSource (path + app constructor)', () => {
  it('exposes the stored path via .path', () => {
    const app = { vault: { getFileByPath: vi.fn() } } as any;
    const source = new VaultTemplateSource('Templates/board.yaml', app);
    expect(source.path).toBe('Templates/board.yaml');
  });

  it('resolves the file lazily on first .file access', () => {
    const file = makeTFile();
    const getFileByPath = vi.fn().mockReturnValue(file);
    const app = { vault: { getFileByPath } } as any;
    const source = new VaultTemplateSource('Templates/board.yaml', app);
    expect(getFileByPath).not.toHaveBeenCalled();
    const result = source.file;
    expect(getFileByPath).toHaveBeenCalledWith('Templates/board.yaml');
    expect(result).toBe(file);
  });

  it('caches the resolved file after first .file access', () => {
    const file = makeTFile();
    const getFileByPath = vi.fn().mockReturnValue(file);
    const app = { vault: { getFileByPath } } as any;
    const source = new VaultTemplateSource('Templates/board.yaml', app);
    source.file;
    source.file;
    expect(getFileByPath).toHaveBeenCalledOnce();
  });

  it('throws when the vault path cannot be resolved', () => {
    const app = { vault: { getFileByPath: vi.fn().mockReturnValue(null) } } as any;
    const source = new VaultTemplateSource('Missing/file.yaml', app);
    expect(() => source.file).toThrow('File not found: Missing/file.yaml');
  });

  it('toRef() returns the stored path', () => {
    const app = { vault: { getFileByPath: vi.fn() } } as any;
    expect(new VaultTemplateSource('Bases/board.yaml', app).toRef()).toBe('Bases/board.yaml');
  });
});

// ── ExternalTemplateSource ──────────────────────────────────────────────────────

describe('ExternalTemplateSource', () => {
  it('stores sourceName and templateName', () => {
    const source = new ExternalTemplateSource('task-base', 'dashboard');
    expect(source.sourceName).toBe('task-base');
    expect(source.templateName).toBe('dashboard');
  });

  it('toRef() returns "sourceName:templateName"', () => {
    expect(new ExternalTemplateSource('task-base', 'dashboard').toRef()).toBe('task-base:dashboard');
  });

  it('type is "external"', () => {
    expect(new ExternalTemplateSource('task-base', 'dashboard').type).toBe('external');
  });
});

// ── TemplateSourceResolver ────────────────────────────────────────────────────

describe('TemplateSourceResolver.parseHeaderRef', () => {
  it('returns ExternalTemplateSource for a qualified "sourceName:templateName" ref', () => {
    const app = { vault: { getFileByPath: vi.fn() } } as any;
    const resolver = new TemplateSourceResolver(app, () => 'components');
    const result = resolver.parseHeaderRef('task-base:dashboard');
    expect(result).toBeInstanceOf(ExternalTemplateSource);
    expect((result as ExternalTemplateSource).sourceName).toBe('task-base');
    expect((result as ExternalTemplateSource).templateName).toBe('dashboard');
  });

  it('splits on the first colon only, preserving rest as templateName', () => {
    const app = { vault: { getFileByPath: vi.fn() } } as any;
    const resolver = new TemplateSourceResolver(app, () => 'components');
    const result = resolver.parseHeaderRef('my-plugin:some:template');
    expect(result).toBeInstanceOf(ExternalTemplateSource);
    expect((result as ExternalTemplateSource).sourceName).toBe('my-plugin');
    expect((result as ExternalTemplateSource).templateName).toBe('some:template');
  });

  it('returns VaultTemplateSource (with TFile) for an unqualified path when the file exists', () => {
    const file = makeTFile('Templates/board.yaml');
    const app = { vault: { getFileByPath: vi.fn().mockReturnValue(file) } } as any;
    const resolver = new TemplateSourceResolver(app, () => 'components');
    const result = resolver.parseHeaderRef('Templates/board.yaml');
    expect(result).toBeInstanceOf(VaultTemplateSource);
    expect((result as VaultTemplateSource).file).toBe(file);
  });

  it('throws with a "file was moved?" message when the unqualified path is not found', () => {
    const app = { vault: { getFileByPath: vi.fn().mockReturnValue(null) } } as any;
    const resolver = new TemplateSourceResolver(app, () => 'components');
    expect(() => resolver.parseHeaderRef('Templates/missing.yaml'))
      .toThrow('If you moved the file, update the path in pb-metadata.template');
  });
});

describe('TemplateSourceResolver.parseSubRef', () => {
  it('returns ExternalTemplateSource for a qualified "sourceName:key" ref', () => {
    const app = { vault: { getFileByPath: vi.fn() } } as any;
    const resolver = new TemplateSourceResolver(app, () => 'components');
    const result = resolver.parseSubRef('task-base:filter/isTask');
    expect(result).toBeInstanceOf(ExternalTemplateSource);
    expect((result as ExternalTemplateSource).sourceName).toBe('task-base');
    expect((result as ExternalTemplateSource).templateName).toBe('filter/isTask');
  });

  it('returns VaultTemplateSource (with TFile) for an unqualified ref when the file exists', () => {
    const file = makeTFile('components/filter/isTask.yaml');
    const app = {
      vault: { getFileByPath: vi.fn((p: string) => p === 'components/filter/isTask.yaml' ? file : null) },
    } as any;
    const resolver = new TemplateSourceResolver(app, () => 'components');
    const result = resolver.parseSubRef('filter/isTask');
    expect(result).toBeInstanceOf(VaultTemplateSource);
    expect((result as VaultTemplateSource).file).toBe(file);
  });

  it('appends .yaml when the ref has no extension', () => {
    const file = makeTFile('components/sub.yaml');
    const getFileByPath = vi.fn((p: string) => p === 'components/sub.yaml' ? file : null);
    const app = { vault: { getFileByPath } } as any;
    const resolver = new TemplateSourceResolver(app, () => 'components');
    resolver.parseSubRef('sub');
    expect(getFileByPath).toHaveBeenCalledWith('components/sub.yaml');
  });

  it('does not double-append .yaml when the ref already has it', () => {
    const file = makeTFile('components/sub.yaml');
    const getFileByPath = vi.fn((p: string) => p === 'components/sub.yaml' ? file : null);
    const app = { vault: { getFileByPath } } as any;
    const resolver = new TemplateSourceResolver(app, () => 'components');
    resolver.parseSubRef('sub.yaml');
    expect(getFileByPath).toHaveBeenCalledWith('components/sub.yaml');
  });

  it('throws when the unqualified component file is not found', () => {
    const app = { vault: { getFileByPath: vi.fn().mockReturnValue(null) } } as any;
    const resolver = new TemplateSourceResolver(app, () => 'components');
    expect(() => resolver.parseSubRef('missing/component'))
      .toThrow('Component not found: "missing/component"');
  });

  it('throws on path traversal attempts (..)', () => {
    const app = { vault: { getFileByPath: vi.fn() } } as any;
    const resolver = new TemplateSourceResolver(app, () => 'components');
    expect(() => resolver.parseSubRef('../secret.yaml'))
      .toThrow('Invalid !sub path: ../secret.yaml');
  });
});
