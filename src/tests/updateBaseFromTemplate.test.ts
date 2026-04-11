// updateBaseFromTemplate.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Modal, Notice, TFile } from 'obsidian';
import { updateBaseFromTemplateCommand } from '../commands/updateBaseFromTemplate';
import * as yaml from 'js-yaml';

vi.mock('main', () => ({ default: class {} }));
vi.mock('js-yaml');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeActiveFile(extension = 'base'): TFile {
  const f = new TFile();
  f.extension = extension;
  f.name = 'my-board.base';
  f.path = 'Bases/my-board.base';
  return f;
}

function makePlugin(overrides: {
  activeFile?: TFile | null;
  fileContent?: string;
} = {}) {
  const { activeFile = null, fileContent = '' } = overrides;

  const app = {
    workspace: { getActiveFile: vi.fn().mockReturnValue(activeFile) },
    vault: { read: vi.fn().mockResolvedValue(fileContent) },
  };

  const templateFileManager = {
    writeBaseFromTemplate: vi.fn().mockResolvedValue(undefined),
  };

  return { app, templateFileManager } as any;
}

/** Sets yaml.load to return YAML with a pb-metadata.template value. */
function withTemplate(templatePath: string) {
  vi.mocked(yaml.load).mockReturnValue({ 'pb-metadata': { template: templatePath } });
}

/** Sets yaml.load to return YAML with no pb-metadata section. */
function withNoMetadata() {
  vi.mocked(yaml.load).mockReturnValue({});
}

/** Sets yaml.load to return YAML with pb-metadata but no template. */
function withMetadataNoTemplate() {
  vi.mocked(yaml.load).mockReturnValue({ 'pb-metadata': {} });
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

  it('opens a ConfirmUpdateModal when a template path is found in metadata', async () => {
    withTemplate('Templates/board.yaml');
    const openSpy = vi.spyOn(Modal.prototype, 'open');
    const plugin = makePlugin({ activeFile: makeActiveFile() });
    await updateBaseFromTemplateCommand(plugin).callback?.();
    expect(openSpy).toHaveBeenCalledOnce();
    expect(Notice).not.toHaveBeenCalled();
  });

  it('calls templateFileManager.writeBaseFromTemplate with the active file path on confirm', async () => {
    withTemplate('Templates/board.yaml');
    const openSpy = vi.spyOn(Modal.prototype, 'open');
    const activeFile = makeActiveFile();
    const plugin = makePlugin({ activeFile });
    await updateBaseFromTemplateCommand(plugin).callback?.();
    const modal = openSpy.mock.contexts[0] as any;
    await modal.onConfirm();
    expect(plugin.templateFileManager.writeBaseFromTemplate).toHaveBeenCalledOnce();
    expect(plugin.templateFileManager.writeBaseFromTemplate.mock.calls[0][1]).toBe(activeFile.path);
  });

  it('shows an error Notice and does not rethrow when writeBaseFromTemplate throws', async () => {
    withTemplate('Templates/board.yaml');
    const openSpy = vi.spyOn(Modal.prototype, 'open');
    const plugin = makePlugin({ activeFile: makeActiveFile() });
    plugin.templateFileManager.writeBaseFromTemplate.mockRejectedValue(new Error('Template gone'));
    await updateBaseFromTemplateCommand(plugin).callback?.();
    const modal = openSpy.mock.contexts[0] as any;
    await expect(modal.onConfirm()).resolves.not.toThrow();
    expect(Notice).toHaveBeenCalledWith(expect.stringContaining('Template gone'), 0);
  });
});
