// templateSource.test.ts

import { describe, it, expect } from 'vitest';
import { TFile } from 'obsidian';
import {
  VaultTemplateSource,
  QualifiedTemplateSource,
  TemplateSourceResolver,
} from 'bases/templateSource';

function makeTFile(path = 'Templates/my-template.yaml', basename = 'my-template'): TFile {
  const f = new TFile();
  f.path = path;
  f.basename = basename;
  return f;
}

// ── VaultTemplateSource ───────────────────────────────────────────────────────

describe('VaultTemplateSource', () => {
  it('exposes the vault-relative path via .path', () => {
    const source = new VaultTemplateSource('Templates/bases/board.yaml', 'board.yaml');
    expect(source.path).toBe('Templates/bases/board.yaml');
  });

  it('toRef() returns the folder-relative ref, not the vault path', () => {
    expect(new VaultTemplateSource('Templates/bases/task-board.yaml', 'task-board.yaml').toRef()).toBe('task-board.yaml');
  });

  it('toRef() preserves nested ref paths', () => {
    expect(new VaultTemplateSource('Templates/bases/boards/task-board.yaml', 'boards/task-board.yaml').toRef()).toBe('boards/task-board.yaml');
  });

  it('toName() strips the .yaml extension', () => {
    expect(new VaultTemplateSource('Templates/bases/board.yaml', 'board.yaml').toName()).toBe('board');
  });

  it('toName() strips folder segments, returning only the leaf name', () => {
    expect(new VaultTemplateSource('Templates/bases/boards/task-board.yaml', 'boards/task-board.yaml').toName()).toBe('task-board');
  });

  it('type is "vault"', () => {
    expect(new VaultTemplateSource('Templates/bases/board.yaml', 'board.yaml').type).toBe('vault');
  });
});

// ── QualifiedTemplateSource ───────────────────────────────────────────────────

describe('QualifiedTemplateSource', () => {
  it('stores sourceName and templateName', () => {
    const source = new QualifiedTemplateSource('task-base', 'dashboard');
    expect(source.sourceName).toBe('task-base');
    expect(source.templateName).toBe('dashboard');
  });

  it('toRef() returns "sourceName:templateName"', () => {
    expect(new QualifiedTemplateSource('task-base', 'dashboard').toRef()).toBe('task-base:dashboard');
  });

  it('toName() returns just the templateName without the source qualifier', () => {
    expect(new QualifiedTemplateSource('task-base', 'dashboard').toName()).toBe('dashboard');
  });

  it('type is "qualified"', () => {
    expect(new QualifiedTemplateSource('task-base', 'dashboard').type).toBe('qualified');
  });
});

// ── TemplateSourceResolver.parseRef ──────────────────────────────────────────

describe('TemplateSourceResolver.parseRef', () => {
  function makeResolver() {
    return new TemplateSourceResolver(() => 'components', () => 'bases');
  }

  it('returns QualifiedTemplateSource for a qualified "sourceName:templateName" ref', () => {
    const resolver = makeResolver();
    const result = resolver.parseRef('task-base:dashboard', 'base');
    expect(result).toBeInstanceOf(QualifiedTemplateSource);
    expect((result as QualifiedTemplateSource).sourceName).toBe('task-base');
    expect((result as QualifiedTemplateSource).templateName).toBe('dashboard');
  });

  it('splits on the first colon only, preserving the rest as templateName', () => {
    const resolver = makeResolver();
    const result = resolver.parseRef('my-plugin:some:template', 'base');
    expect(result).toBeInstanceOf(QualifiedTemplateSource);
    expect((result as QualifiedTemplateSource).sourceName).toBe('my-plugin');
    expect((result as QualifiedTemplateSource).templateName).toBe('some:template');
  });

  it('resolves an unqualified base ref against basesFolder', () => {
    const resolver = makeResolver();
    const result = resolver.parseRef('dashboard', 'base');
    expect(result).toBeInstanceOf(VaultTemplateSource);
    expect((result as VaultTemplateSource).path).toBe('bases/dashboard.yaml');
  });

  it('resolves an unqualified component ref against componentsFolder', () => {
    const resolver = makeResolver();
    const result = resolver.parseRef('filter/isTask', 'component');
    expect(result).toBeInstanceOf(VaultTemplateSource);
    expect((result as VaultTemplateSource).path).toBe('components/filter/isTask.yaml');
  });

  it('toRef() on a resolved vault source returns the original ref, not the vault path', () => {
    const resolver = makeResolver();
    const result = resolver.parseRef('dashboard', 'base') as VaultTemplateSource;
    expect(result.toRef()).toBe('dashboard');
  });

  it('appends .yaml when the ref has no extension', () => {
    const resolver = makeResolver();
    const result = resolver.parseRef('sub', 'component') as VaultTemplateSource;
    expect(result.path).toBe('components/sub.yaml');
  });

  it('does not double-append .yaml when the ref already has it', () => {
    const resolver = makeResolver();
    const result = resolver.parseRef('sub.yaml', 'component') as VaultTemplateSource;
    expect(result.path).toBe('components/sub.yaml');
  });

  it('throws on path traversal attempts (..)', () => {
    const resolver = makeResolver();
    expect(() => resolver.parseRef('../secret.yaml', 'component'))
      .toThrow('Invalid ref path: ../secret.yaml');
  });
});

// ── TemplateSourceResolver.sourceFromFile ────────────────────────────────────

describe('TemplateSourceResolver.sourceFromFile', () => {
  function makeResolver() {
    return new TemplateSourceResolver(() => 'components', () => 'bases');
  }

  it('strips basesFolder prefix for context "base"', () => {
    const resolver = makeResolver();
    const file = makeTFile('bases/dashboard.yaml');
    const source = resolver.sourceFromFile(file, 'base');
    expect(source.toRef()).toBe('dashboard.yaml');
    expect(source.path).toBe('bases/dashboard.yaml');
  });

  it('strips componentsFolder prefix for context "component"', () => {
    const resolver = makeResolver();
    const file = makeTFile('components/filter/isTask.yaml');
    const source = resolver.sourceFromFile(file, 'component');
    expect(source.toRef()).toBe('filter/isTask.yaml');
    expect(source.path).toBe('components/filter/isTask.yaml');
  });

  it('falls back to the full path as ref when the file is outside the folder', () => {
    const resolver = makeResolver();
    const file = makeTFile('elsewhere/board.yaml');
    const source = resolver.sourceFromFile(file, 'base');
    expect(source.toRef()).toBe('elsewhere/board.yaml');
  });

  it('returns a VaultTemplateSource', () => {
    const resolver = makeResolver();
    const file = makeTFile('bases/board.yaml');
    const source = resolver.sourceFromFile(file, 'base');
    expect(source).toBeInstanceOf(VaultTemplateSource);
    expect(source.path).toBe('bases/board.yaml');
  });
});
