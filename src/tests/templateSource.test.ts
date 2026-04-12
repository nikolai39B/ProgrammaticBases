// templateSource.test.ts

import { describe, it, expect, vi } from 'vitest';
import { TFile } from 'obsidian';
import { VaultTemplateSource, ExternalTemplateSource, parseTemplateRef } from 'bases/templateSource';

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

  it('type is "plugin"', () => {
    expect(new ExternalTemplateSource('task-base', 'dashboard').type).toBe('external');
  });
});

// ── parseTemplateRef ──────────────────────────────────────────────────────────

describe('parseTemplateRef', () => {
  const app = { vault: { getFileByPath: vi.fn() } } as any;

  it('returns a ExternalTemplateSource for a qualified "sourceName:templateName" ref', () => {
    const result = parseTemplateRef('task-base:dashboard', app);
    expect(result).toBeInstanceOf(ExternalTemplateSource);
    expect((result as ExternalTemplateSource).sourceName).toBe('task-base');
    expect((result as ExternalTemplateSource).templateName).toBe('dashboard');
  });

  it('returns a VaultTemplateSource for an unqualified path', () => {
    const result = parseTemplateRef('Templates/board.yaml', app);
    expect(result).toBeInstanceOf(VaultTemplateSource);
    expect((result as VaultTemplateSource).path).toBe('Templates/board.yaml');
  });

  it('splits on the first colon only, preserving rest as templateName', () => {
    const result = parseTemplateRef('my-plugin:some:template', app);
    expect(result).toBeInstanceOf(ExternalTemplateSource);
    expect((result as ExternalTemplateSource).sourceName).toBe('my-plugin');
    expect((result as ExternalTemplateSource).templateName).toBe('some:template');
  });
});
