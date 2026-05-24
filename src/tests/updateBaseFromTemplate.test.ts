// updateBaseFromTemplate.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Modal, Notice, TFile } from 'obsidian';
import { updateBaseFromTemplateCommand, UpdateConfigurationModal } from '../commands/updateBaseFromTemplate';
import { VaultTemplateSource } from 'bases/templateSource';
import { HarvestedParams, ResolvedParams } from 'bases/templateParams';
import * as yaml from 'yaml';

vi.mock('main', () => ({ default: class {} }));
vi.mock('settings', () => ({
  FolderSuggest: class { constructor() {} },
}));
vi.mock('yaml');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeActiveFile(extension = 'base'): TFile {
  const f = new TFile();
  f.extension = extension;
  f.name = 'my-board.base';
  f.path = 'Bases/my-board.base';
  return f;
}

const mockSource = new VaultTemplateSource('Templates/board.yaml', 'board');

function makePlugin(overrides: {
  activeFile?: TFile | null;
  fileContent?: string;
  harvested?: HarvestedParams;
} = {}) {
  const { activeFile = null, fileContent = '', harvested = {} } = overrides;

  const app = {
    workspace: { getActiveFile: vi.fn().mockReturnValue(activeFile) },
    vault: { read: vi.fn().mockResolvedValue(fileContent) },
  };

  const templateFileIO = {
    writeBaseFromTemplate: vi.fn().mockResolvedValue(undefined),
  };

  const templateEvaluator = {
    collectTemplateParams: vi.fn().mockResolvedValue(harvested),
  };

  const templateSourceResolver = {
    parseRef: vi.fn().mockReturnValue(mockSource),
  };

  return { app, templateFileIO, templateEvaluator, templateSourceResolver } as any;
}

/** Sets yaml.parse to return a base with pb-metadata.template (and optionally params). */
function withTemplate(templateRef: string, params?: ResolvedParams) {
  vi.mocked(yaml.parse).mockReturnValue({
    'pb-metadata': { template: templateRef, ...(params ? { params } : {}) },
  });
}

/** Sets yaml.parse to return a base with no pb-metadata section. */
function withNoMetadata() {
  vi.mocked(yaml.parse).mockReturnValue({});
}

/** Sets yaml.parse to return a base with pb-metadata but no template field. */
function withMetadataNoTemplate() {
  vi.mocked(yaml.parse).mockReturnValue({ 'pb-metadata': {} });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('updateBaseFromTemplateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a command with id "update-base-from-template"', () => {
    const cmd = updateBaseFromTemplateCommand(makePlugin());
    expect(cmd.id).toBe('update-base-from-template');
  });

  // ── Guard: no .base file open ───────────────────────────────────────────────

  it('shows a Notice and does not read the vault when no active file is open', async () => {
    const plugin = makePlugin({ activeFile: null });
    await updateBaseFromTemplateCommand(plugin).callback?.();
    expect(Notice).toHaveBeenCalledOnce();
    expect(plugin.app.vault.read).not.toHaveBeenCalled();
  });

  it('shows a Notice and does not read the vault when the active file is not a .base file', async () => {
    const plugin = makePlugin({ activeFile: makeActiveFile('md') });
    await updateBaseFromTemplateCommand(plugin).callback?.();
    expect(Notice).toHaveBeenCalledOnce();
    expect(plugin.app.vault.read).not.toHaveBeenCalled();
  });

  // ── Guard: no template in metadata ─────────────────────────────────────────

  it('shows a Notice when the base has no pb-metadata section', async () => {
    withNoMetadata();
    const plugin = makePlugin({ activeFile: makeActiveFile() });
    await updateBaseFromTemplateCommand(plugin).callback?.();
    expect(Notice).toHaveBeenCalledOnce();
  });

  it('shows a Notice when pb-metadata exists but has no template field', async () => {
    withMetadataNoTemplate();
    const plugin = makePlugin({ activeFile: makeActiveFile() });
    await updateBaseFromTemplateCommand(plugin).callback?.();
    expect(Notice).toHaveBeenCalledOnce();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('opens an UpdateConfigurationModal when a template ref is found', async () => {
    withTemplate('board');
    const openSpy = vi.spyOn(Modal.prototype, 'open');
    const plugin = makePlugin({ activeFile: makeActiveFile() });
    await updateBaseFromTemplateCommand(plugin).callback?.();
    expect(plugin.templateEvaluator.collectTemplateParams).toHaveBeenCalledOnce();
    expect(openSpy).toHaveBeenCalledOnce();
    expect(Notice).not.toHaveBeenCalled();
  });

  it('passes cached params from pb-metadata as initial values', async () => {
    const harvested: HarvestedParams = {
      count: { specs: { '': { type: 'number', label: 'Count', optional: false } } },
    };
    withTemplate('board', { count: 10 });
    const openSpy = vi.spyOn(Modal.prototype, 'open');
    const plugin = makePlugin({ activeFile: makeActiveFile(), harvested });
    await updateBaseFromTemplateCommand(plugin).callback?.();
    const modal = openSpy.mock.contexts[0] as UpdateConfigurationModal;
    expect((modal as any).values).toMatchObject({ count: 10 });
  });

  it('calls writeBaseFromTemplate with the source, active file path, and values on update', async () => {
    withTemplate('board');
    const openSpy = vi.spyOn(Modal.prototype, 'open');
    const activeFile = makeActiveFile();
    const plugin = makePlugin({ activeFile });
    await updateBaseFromTemplateCommand(plugin).callback?.();
    const modal = openSpy.mock.contexts[0] as any;
    await modal.onFinalAction();
    expect(plugin.templateFileIO.writeBaseFromTemplate).toHaveBeenCalledOnce();
    expect(plugin.templateFileIO.writeBaseFromTemplate).toHaveBeenCalledWith(
      mockSource,
      activeFile.path,
      expect.any(Object),
    );
  });

  it('shows a success Notice after update', async () => {
    withTemplate('board');
    const openSpy = vi.spyOn(Modal.prototype, 'open');
    const plugin = makePlugin({ activeFile: makeActiveFile() });
    await updateBaseFromTemplateCommand(plugin).callback?.();
    const modal = openSpy.mock.contexts[0] as any;
    await modal.onFinalAction();
    expect(Notice).toHaveBeenCalledWith(expect.stringContaining('my-board.base'));
  });

  it('preserves date and datetime params as strings rather than Date objects', async () => {
    const actualYaml = await vi.importActual<typeof import('yaml')>('yaml');
    vi.mocked(yaml.parse).mockImplementationOnce(actualYaml.parse as typeof yaml.parse);
    const fileContent = [
      'pb-metadata:',
      '  template: board',
      '  params:',
      '    sinceDate: 2026-04-23',
      '    sinceDateTime: 2000-01-01T00:00',
    ].join('\n');
    const harvested: HarvestedParams = {
      sinceDate: { specs: { '': { type: 'date', label: 'Since date', optional: true } } },
      sinceDateTime: { specs: { '': { type: 'datetime', label: 'Since datetime', optional: false } } },
    };
    const openSpy = vi.spyOn(Modal.prototype, 'open');
    const plugin = makePlugin({ activeFile: makeActiveFile(), fileContent, harvested });
    await updateBaseFromTemplateCommand(plugin).callback?.();
    const modal = openSpy.mock.contexts[0] as any;
    expect(modal.values['sinceDate']).toBe('2026-04-23');
    expect(modal.values['sinceDateTime']).toBe('2000-01-01T00:00');
  });

  it('shows an error Notice and does not rethrow when writeBaseFromTemplate throws', async () => {
    withTemplate('board');
    const openSpy = vi.spyOn(Modal.prototype, 'open');
    const plugin = makePlugin({ activeFile: makeActiveFile() });
    plugin.templateFileIO.writeBaseFromTemplate.mockRejectedValue(new Error('Template gone'));
    await updateBaseFromTemplateCommand(plugin).callback?.();
    const modal = openSpy.mock.contexts[0] as any;
    await expect((modal as any).update()).resolves.not.toThrow();
    expect(Notice).toHaveBeenCalledWith(expect.stringContaining('Template gone'), 0);
  });
});
