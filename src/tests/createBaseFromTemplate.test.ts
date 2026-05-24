// createBaseFromTemplate.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile, TFolder, Modal, SuggestModal, Notice } from 'obsidian';
import {
  createBaseFromTemplateCommand,
  TemplatePicker,
  TemplateConfigurationModal,
  ConfirmOverwriteModal,
} from '../commands/createBaseFromTemplate';
import { VaultTemplateSource, QualifiedTemplateSource } from 'bases/templateSource';
import { HarvestedParams, ResolvedParams } from 'bases/templateParams';

vi.mock('main', () => ({ default: class {} }));
vi.mock('settings', () => ({
  FolderSuggest: class { constructor() {} },
  ExternalSource: {},
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTFile(basename = 'my-template', extension = 'yaml'): TFile {
  const f = new TFile();
  f.basename = basename;
  f.extension = extension;
  f.path = `Templates/${basename}.${extension}`;
  return f;
}

function makeTFolder(children: (TFile | TFolder)[] = []): TFolder {
  const folder = new TFolder();
  folder.children = children;
  return folder;
}

/** Wraps a TFile in a VaultTemplateSource using the file path as the ref. */
function makeVaultTemplate(file: TFile): VaultTemplateSource {
  return new VaultTemplateSource(file.path, file.path);
}

function makePlugin(overrides: {
  basesFolder?: string;
  folderResult?: TFolder | null;
  activeFile?: (TFile & { parent?: { path: string } | null }) | null;
  fileAtPath?: unknown;
  allSources?: Map<string, unknown>;
} = {}) {
  const {
    basesFolder = 'Templates/bases',
    folderResult = makeTFolder(),
    activeFile = null,
    fileAtPath = null,
    allSources = new Map(),
  } = overrides;

  const vault = {
    getFolderByPath: vi.fn().mockReturnValue(folderResult),
    getAbstractFileByPath: vi.fn().mockReturnValue(fileAtPath),
  };

  const workspace = {
    getActiveFile: vi.fn().mockReturnValue(activeFile),
  };

  const templateEvaluator = {
    collectTemplateParams: vi.fn().mockResolvedValue({}),
  };

  const templateFileIO = {
    createBaseFromTemplate: vi.fn().mockResolvedValue(undefined),
    writeBaseFromTemplate: vi.fn().mockResolvedValue(undefined),
  };

  const templateSourceResolver = {
    sourceFromFile: vi.fn((file: TFile, _context: string) => new VaultTemplateSource(file.path, file.path)),
  };

  return {
    app: { vault, workspace } as any,
    settings: { basesFolder, componentsFolder: 'Templates/components' },
    allSources,
    componentsFolder: 'Templates/components',
    viewRegistry: {} as any,
    templateEvaluator,
    templateFileIO,
    templateSourceResolver,
  } as any;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createBaseFromTemplateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a command with id "create-base-from-template"', () => {
    const cmd = createBaseFromTemplateCommand(makePlugin());
    expect(cmd.id).toBe('create-base-from-template');
  });

  it('shows a Notice when there are no vault templates and no plugin templates', () => {
    const openSpy = vi.spyOn(SuggestModal.prototype, 'open');
    const plugin = makePlugin({ folderResult: null, allSources: new Map() });
    createBaseFromTemplateCommand(plugin).callback?.();
    expect(Notice).toHaveBeenCalledOnce();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens a TemplatePicker when basesFolder is a valid TFolder', () => {
    const openSpy = vi.spyOn(SuggestModal.prototype, 'open');
    createBaseFromTemplateCommand(makePlugin()).callback?.();
    expect(openSpy).toHaveBeenCalledOnce();
  });

  it('opens a TemplatePicker when there are plugin templates even without a vault folder', () => {
    const openSpy = vi.spyOn(SuggestModal.prototype, 'open');
    const sources = new Map([['my-plugin', { name: 'my-plugin', templates: { 'dashboard': 'views: []' } }]]);
    const plugin = makePlugin({ folderResult: null, allSources: sources });
    createBaseFromTemplateCommand(plugin).callback?.();
    expect(openSpy).toHaveBeenCalledOnce();
    expect(Notice).not.toHaveBeenCalled();
  });
});

// ── TemplatePicker ────────────────────────────────────────────────────────────

describe('TemplatePicker', () => {
  let plugin: ReturnType<typeof makePlugin>;

  beforeEach(() => {
    vi.clearAllMocks();
    plugin = makePlugin();
  });

  describe('getSuggestions()', () => {
    it('returns [] when the bases folder is not found and there are no plugin templates', () => {
      plugin.app.vault.getFolderByPath.mockReturnValue(null);
      const picker = new TemplatePicker(plugin.app, plugin);
      expect(picker.getSuggestions('anything')).toEqual([]);
    });

    it('returns only .yaml files from the folder as VaultTemplateSources', () => {
      const yamlFile = makeTFile('template', 'yaml');
      const mdFile = makeTFile('notes', 'md');
      const folder = makeTFolder([yamlFile, mdFile, makeTFolder()]);
      plugin.app.vault.getFolderByPath.mockReturnValue(folder);
      const picker = new TemplatePicker(plugin.app, plugin);
      expect(picker.getSuggestions('')).toEqual([makeVaultTemplate(yamlFile)]);
    });

    it('filters vault files by query, case-insensitively', () => {
      const alpha = makeTFile('Alpha', 'yaml');
      const beta = makeTFile('Beta', 'yaml');
      plugin.app.vault.getFolderByPath.mockReturnValue(makeTFolder([alpha, beta]));
      const picker = new TemplatePicker(plugin.app, plugin);
      expect(picker.getSuggestions('alp')).toEqual([makeVaultTemplate(alpha)]);
      expect(picker.getSuggestions('ALP')).toEqual([makeVaultTemplate(alpha)]);
    });

    it('returns all .yaml files when query is empty', () => {
      const a = makeTFile('a', 'yaml');
      const b = makeTFile('b', 'yaml');
      plugin.app.vault.getFolderByPath.mockReturnValue(makeTFolder([a, b]));
      const picker = new TemplatePicker(plugin.app, plugin);
      expect(picker.getSuggestions('')).toEqual([makeVaultTemplate(a), makeVaultTemplate(b)]);
    });

    it('returns vault templates before plugin templates', () => {
      const vaultFile = makeTFile('my-vault-template', 'yaml');
      plugin.app.vault.getFolderByPath.mockReturnValue(makeTFolder([vaultFile]));
      plugin.allSources = new Map([
        ['my-plugin', { name: 'my-plugin', templates: { 'dashboard': 'views: []' } }],
      ]);
      const picker = new TemplatePicker(plugin.app, plugin);
      expect(picker.getSuggestions('')).toEqual([
        makeVaultTemplate(vaultFile),
        new QualifiedTemplateSource('my-plugin', 'dashboard'),
      ]);
    });

    it('returns plugin templates from registered sources', () => {
      plugin.app.vault.getFolderByPath.mockReturnValue(null);
      plugin.allSources = new Map([
        ['my-plugin', { name: 'my-plugin', templates: { 'dashboard': 'views: []' } }],
      ]);
      const picker = new TemplatePicker(plugin.app, plugin);
      expect(picker.getSuggestions('')).toEqual([
        new QualifiedTemplateSource('my-plugin', 'dashboard'),
      ]);
    });

    it('filters plugin templates by query against "sourceName:templateName"', () => {
      plugin.app.vault.getFolderByPath.mockReturnValue(null);
      plugin.allSources = new Map([
        ['my-plugin', { name: 'my-plugin', templates: { 'dashboard': 'v: []', 'task-list': 'v: []' } }],
      ]);
      const picker = new TemplatePicker(plugin.app, plugin);
      expect(picker.getSuggestions('dash')).toEqual([
        new QualifiedTemplateSource('my-plugin', 'dashboard'),
      ]);
    });
  });

  describe('onChooseSuggestion()', () => {
    it('opens TemplateConfigurationModal when the template has no params', async () => {
      plugin.templateEvaluator.collectTemplateParams.mockResolvedValue({});
      const openSpy = vi.spyOn(Modal.prototype, 'open');
      const picker = new TemplatePicker(plugin.app, plugin);
      await picker.onChooseSuggestion(makeVaultTemplate(makeTFile()));
      expect(openSpy).toHaveBeenCalledOnce();
      expect(openSpy.mock.contexts[0]).toBeInstanceOf(TemplateConfigurationModal);
    });

    it('opens TemplateConfigurationModal when the template has params', async () => {
      const harvested: HarvestedParams = {
        taskLocation: { specs: { '': { type: 'folder' } } },
      };
      plugin.templateEvaluator.collectTemplateParams.mockResolvedValue(harvested);
      const openSpy = vi.spyOn(Modal.prototype, 'open');
      const picker = new TemplatePicker(plugin.app, plugin);
      await picker.onChooseSuggestion(makeVaultTemplate(makeTFile()));
      expect(openSpy).toHaveBeenCalledOnce();
      expect(openSpy.mock.contexts[0]).toBeInstanceOf(TemplateConfigurationModal);
    });
  });
});

// ── TemplateConfigurationModal ───────────────────────────────────────────────────────────

describe('TemplateConfigurationModal', () => {
  let plugin: ReturnType<typeof makePlugin>;
  const templateFile = makeTFile('my-template');
  const template = makeVaultTemplate(templateFile);

  beforeEach(() => {
    vi.clearAllMocks();
    plugin = makePlugin();
  });

  // ── onClose ────────────────────────────────────────────────────────────────

  describe('onClose()', () => {
    it('empties contentEl', () => {
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      modal.onClose();
      expect(modal.contentEl.empty).toHaveBeenCalledOnce();
    });
  });

  // ── constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('defaults outputFolder to activeFile parent path and outputName to template name', () => {
      const activeFile = Object.assign(new TFile(), { parent: { path: 'Notes/Daily' } });
      plugin.app.workspace.getActiveFile.mockReturnValue(activeFile);
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      expect((modal as any).outputFolder).toBe('Notes/Daily');
      expect((modal as any).outputName).toBe('my-template');
    });

    it('uses empty folder and template name when there is no active file', () => {
      plugin.app.workspace.getActiveFile.mockReturnValue(null);
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      expect((modal as any).outputFolder).toBe('');
      expect((modal as any).outputName).toBe('my-template');
    });

    it('uses empty folder when the active file has no parent', () => {
      const activeFile = Object.assign(new TFile(), { parent: null });
      plugin.app.workspace.getActiveFile.mockReturnValue(activeFile);
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      expect((modal as any).outputFolder).toBe('');
      expect((modal as any).outputName).toBe('my-template');
    });

    it('uses the template name (without qualifier) as the file name for qualified templates', () => {
      const pluginTemplate = new QualifiedTemplateSource('my-plugin', 'dashboard');
      const modal = new TemplateConfigurationModal(plugin.app, plugin, pluginTemplate, {});
      expect((modal as any).outputName).toBe('dashboard');
    });

    it('pre-fills a string default into values at the template-level key', () => {
      const harvested: HarvestedParams = {
        taskLocation: { specs: { '': { type: 'string', default: 'Tasks' } } },
      };
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, harvested);
      expect((modal as any).values['taskLocation']).toBe('Tasks');
    });

    it('pre-fills boolean false when type is boolean and no default given', () => {
      const harvested: HarvestedParams = {
        flag: { specs: { '': { type: 'boolean' } } },
      };
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, harvested);
      expect((modal as any).values['flag']).toBe(false);
    });

    it('pre-fills default into each source-scoped key', () => {
      const harvested: HarvestedParams = {
        x: { specs: { 'a': { type: 'string', default: 'hello' }, 'b': { type: 'string', default: 'hello' } } },
      };
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, harvested);
      const vals = (modal as any).values as ResolvedParams;
      expect(vals['a>x']).toBe('hello');
      expect(vals['b>x']).toBe('hello');
      expect(vals['x']).toBeUndefined();
    });

    it('pre-fills default into a plain key for template-level params', () => {
      const harvested: HarvestedParams = {
        x: { specs: { '': { type: 'string', default: 'hello' } } },
      };
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, harvested);
      expect((modal as any).values['x']).toBe('hello');
    });

    it('pre-fills {{today}} token as a YYYY-MM-DD date string', () => {
      const harvested: HarvestedParams = {
        x: { specs: { '': { type: 'date', defaultExpr: '{{today}}' } } },
      };
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, harvested);
      expect((modal as any).values['x']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('defaultExpr token takes precedence over static default', () => {
      const harvested: HarvestedParams = {
        x: { specs: { '': { type: 'date', default: '2000-01-01', defaultExpr: '{{today}}' } } },
      };
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, harvested);
      expect((modal as any).values['x']).not.toBe('2000-01-01');
    });

    it('falls back to static default when defaultExpr token is unrecognized', () => {
      const harvested: HarvestedParams = {
        x: { specs: { '': { type: 'string', default: 'fallback', defaultExpr: '{{unknown}}' } } },
      };
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, harvested);
      expect((modal as any).values['x']).toBe('fallback');
    });

    it('falls back to empty string when defaultExpr token is unrecognized and no static default', () => {
      const harvested: HarvestedParams = {
        x: { specs: { '': { type: 'string', defaultExpr: '{{unknown}}' } } },
      };
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, harvested);
      expect((modal as any).values['x']).toBe('');
    });
  });

  // ── create() ───────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('calls templateFileManager.writeBaseFromTemplate with the template, output path, and values', async () => {
      const resolvedParams: ResolvedParams = { taskLocation: 'Tasks' };
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      (modal as any).values = resolvedParams;
      await (modal as any).create();
      expect(plugin.templateFileIO.writeBaseFromTemplate).toHaveBeenCalledWith(template, 'my-template', resolvedParams);
    });

    it('calls templateFileManager.writeBaseFromTemplate for plugin templates', async () => {
      const pluginTemplate = new QualifiedTemplateSource('my-plugin', 'dashboard');
      const modal = new TemplateConfigurationModal(plugin.app, plugin, pluginTemplate, {});
      await (modal as any).create();
      expect(plugin.templateFileIO.writeBaseFromTemplate).toHaveBeenCalledWith(pluginTemplate, 'dashboard', {});
    });

    it('calls templateFileManager.writeBaseFromTemplate and not createBaseFromTemplate when overwrite is confirmed', async () => {
      const resolvedParams: ResolvedParams = { x: 'val' };
      plugin.app.vault.getAbstractFileByPath.mockReturnValue({} /* existing file */);
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      (modal as any).values = resolvedParams;
      vi.spyOn(modal as any, 'confirmOverwrite').mockResolvedValue(true);
      await (modal as any).create();
      expect(plugin.templateFileIO.writeBaseFromTemplate).toHaveBeenCalledWith(template, 'my-template', resolvedParams);
      expect(plugin.templateFileIO.createBaseFromTemplate).not.toHaveBeenCalled();
    });

    it('does not write when file exists and user cancels the overwrite dialog', async () => {
      plugin.app.vault.getAbstractFileByPath.mockReturnValue({} /* existing file */);
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      vi.spyOn(modal as any, 'confirmOverwrite').mockResolvedValue(false);
      await (modal as any).create();
      expect(plugin.templateFileIO.writeBaseFromTemplate).not.toHaveBeenCalled();
    });

    it('shows a Notice containing "Created" after writing a new file', async () => {
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      await (modal as any).create();
      expect(Notice).toHaveBeenCalledWith(expect.stringContaining('Created'));
    });

    it('shows a Notice containing "Overwrote" after a confirmed overwrite', async () => {
      plugin.app.vault.getAbstractFileByPath.mockReturnValue({} /* existing file */);
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      vi.spyOn(modal as any, 'confirmOverwrite').mockResolvedValue(true);
      await (modal as any).create();
      expect(Notice).toHaveBeenCalledWith(expect.stringContaining('Overwrote'));
    });

    it('calls close() after a successful create', async () => {
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      const closeSpy = vi.spyOn(modal, 'close');
      await (modal as any).create();
      expect(closeSpy).toHaveBeenCalledOnce();
    });

    it('calls close() after a successful overwrite', async () => {
      plugin.app.vault.getAbstractFileByPath.mockReturnValue({} /* existing file */);
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      const closeSpy = vi.spyOn(modal, 'close');
      vi.spyOn(modal as any, 'confirmOverwrite').mockResolvedValue(true);
      await (modal as any).create();
      expect(closeSpy).toHaveBeenCalledOnce();
    });

    it('does not append .base when the combined path already has an extension', async () => {
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      (modal as any).outputFolder = '';
      (modal as any).outputName = 'my-file.base';
      await (modal as any).create();
      expect(plugin.app.vault.getAbstractFileByPath).toHaveBeenCalledWith('my-file.base');
    });

    it('appends .base for the existence check when the combined path has no extension', async () => {
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      (modal as any).outputFolder = '';
      (modal as any).outputName = 'my-file';
      await (modal as any).create();
      expect(plugin.app.vault.getAbstractFileByPath).toHaveBeenCalledWith('my-file.base');
    });

    it('shows an error Notice when templateFileManager.writeBaseFromTemplate throws', async () => {
      plugin.templateFileIO.writeBaseFromTemplate.mockRejectedValue(new Error('YAML parse error'));
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      await (modal as any).create();
      expect(Notice).toHaveBeenCalledWith(expect.stringContaining('YAML parse error'), 0);
    });

    it('shows an error Notice when templateFileManager.writeBaseFromTemplate throws on overwrite and does not rethrow', async () => {
      plugin.app.vault.getAbstractFileByPath.mockReturnValue({} /* existing file */);
      plugin.templateFileIO.writeBaseFromTemplate.mockRejectedValue(new Error('Disk full'));
      const modal = new TemplateConfigurationModal(plugin.app, plugin, template, {});
      vi.spyOn(modal as any, 'confirmOverwrite').mockResolvedValue(true);
      await expect((modal as any).create()).resolves.not.toThrow();
      expect(Notice).toHaveBeenCalledWith(expect.stringContaining('Disk full'), 0);
    });
  });
});

// ── ConfirmOverwriteModal ─────────────────────────────────────────────────────

describe('ConfirmOverwriteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('onClose empties contentEl', () => {
    const app = {} as any;
    const modal = new ConfirmOverwriteModal(app, 'some/path.base', vi.fn(), vi.fn());
    modal.onClose();
    expect(modal.contentEl.empty).toHaveBeenCalledOnce();
  });
});
