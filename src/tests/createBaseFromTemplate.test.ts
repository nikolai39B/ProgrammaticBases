// createBaseFromTemplate.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile, TFolder, Modal, SuggestModal, Notice } from 'obsidian';
import {
  createBaseFromTemplateCommand,
  TemplatePicker,
  OutputPathModal,
  ConfirmOverwriteModal,
} from '../commands/createBaseFromTemplate';
import { VaultDeserializer } from 'fileManagement/vaultDeserializer';
import { BaseConfig } from 'bases/baseConfig';

vi.mock('main', () => ({ default: class {} }));
vi.mock('fileManagement/vaultDeserializer', () => ({
  VaultDeserializer: vi.fn(),
}));
vi.mock('bases/baseConfig', () => ({
  BaseConfig: { deserialize: vi.fn() },
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

/** Wraps a TFile in a vault TemplateOption. */
function makeVaultTemplate(file: TFile) {
  return { source: 'vault' as const, file };
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

  const fileManager = {
    createBase: vi.fn().mockResolvedValue(undefined),
    writeBase: vi.fn().mockResolvedValue(undefined),
  };

  return {
    app: { vault, workspace } as any,
    settings: { basesFolder, componentsFolder: 'Templates/components' },
    allSources,
    componentsFolder: 'Templates/components',
    viewRegistry: {} as any,
    fileManager,
  } as any;
}

/** Creates a mock VaultDeserializer with configurable deserialize/deserializeContent spies. */
function mockDeserializer(result: unknown = { views: [] }) {
  const deserialize = vi.fn().mockResolvedValue(result);
  const deserializeContent = vi.fn().mockResolvedValue(result);
  vi.mocked(VaultDeserializer).mockImplementation(function() {
    return { deserialize, deserializeContent };
  } as any);
  return { deserialize, deserializeContent };
}

/** Wires BaseConfig.deserialize to return a mock config object. */
function mockBaseConfig(config: unknown = {}) {
  vi.mocked(BaseConfig.deserialize).mockReturnValue(config as BaseConfig);
  return config as BaseConfig;
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

    it('returns only .yaml files from the folder as vault TemplateOptions', () => {
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
        { source: 'plugin', sourceName: 'my-plugin', templateName: 'dashboard', content: 'views: []' },
      ]);
    });

    it('returns plugin templates from registered sources', () => {
      plugin.app.vault.getFolderByPath.mockReturnValue(null);
      plugin.allSources = new Map([
        ['my-plugin', { name: 'my-plugin', templates: { 'dashboard': 'views: []' } }],
      ]);
      const picker = new TemplatePicker(plugin.app, plugin);
      expect(picker.getSuggestions('')).toEqual([
        { source: 'plugin', sourceName: 'my-plugin', templateName: 'dashboard', content: 'views: []' },
      ]);
    });

    it('filters plugin templates by query against "sourceName:templateName"', () => {
      plugin.app.vault.getFolderByPath.mockReturnValue(null);
      plugin.allSources = new Map([
        ['my-plugin', { name: 'my-plugin', templates: { 'dashboard': 'v: []', 'task-list': 'v: []' } }],
      ]);
      const picker = new TemplatePicker(plugin.app, plugin);
      expect(picker.getSuggestions('dash')).toEqual([
        { source: 'plugin', sourceName: 'my-plugin', templateName: 'dashboard', content: 'v: []' },
      ]);
    });
  });

  describe('onChooseSuggestion()', () => {
    it('opens an OutputPathModal for the chosen template', () => {
      const openSpy = vi.spyOn(Modal.prototype, 'open');
      const picker = new TemplatePicker(plugin.app, plugin);
      picker.onChooseSuggestion(makeVaultTemplate(makeTFile()));
      expect(openSpy).toHaveBeenCalledOnce();
    });
  });
});

// ── OutputPathModal ───────────────────────────────────────────────────────────

describe('OutputPathModal', () => {
  let plugin: ReturnType<typeof makePlugin>;
  const templateFile = makeTFile('my-template');
  const template = makeVaultTemplate(templateFile);

  beforeEach(() => {
    vi.clearAllMocks();
    plugin = makePlugin();
    mockDeserializer();
    mockBaseConfig();
  });

  // ── onClose ────────────────────────────────────────────────────────────────

  describe('onClose()', () => {
    it('empties contentEl', () => {
      const modal = new OutputPathModal(plugin.app, plugin, template);
      modal.onClose();
      expect(modal.contentEl.empty).toHaveBeenCalledOnce();
    });
  });

  // ── constructor ─────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('defaults outputPath to activeFile parent path + template basename', () => {
      const activeFile = Object.assign(new TFile(), { parent: { path: 'Notes/Daily' } });
      plugin.app.workspace.getActiveFile.mockReturnValue(activeFile);
      const modal = new OutputPathModal(plugin.app, plugin, template);
      expect((modal as any).outputPath).toBe('Notes/Daily/my-template');
    });

    it('uses template basename alone when there is no active file', () => {
      plugin.app.workspace.getActiveFile.mockReturnValue(null);
      const modal = new OutputPathModal(plugin.app, plugin, template);
      expect((modal as any).outputPath).toBe('my-template');
    });

    it('uses template basename alone when the active file has no parent', () => {
      const activeFile = Object.assign(new TFile(), { parent: null });
      plugin.app.workspace.getActiveFile.mockReturnValue(activeFile);
      const modal = new OutputPathModal(plugin.app, plugin, template);
      expect((modal as any).outputPath).toBe('my-template');
    });

    it('uses templateName as the basename for plugin templates', () => {
      const pluginTemplate = { source: 'plugin' as const, sourceName: 'my-plugin', templateName: 'dashboard', content: '' };
      const modal = new OutputPathModal(plugin.app, plugin, pluginTemplate);
      expect((modal as any).outputPath).toBe('dashboard');
    });
  });

  // ── create() ───────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('calls VaultDeserializer.deserialize with the template path for vault templates', async () => {
      const { deserialize } = mockDeserializer();
      const modal = new OutputPathModal(plugin.app, plugin, template);
      await (modal as any).create();
      expect(deserialize).toHaveBeenCalledWith(templateFile.path);
    });

    it('calls VaultDeserializer.deserializeContent for plugin templates', async () => {
      const { deserializeContent } = mockDeserializer();
      const pluginTemplate = { source: 'plugin' as const, sourceName: 'my-plugin', templateName: 'dashboard', content: 'views: []' };
      const modal = new OutputPathModal(plugin.app, plugin, pluginTemplate);
      await (modal as any).create();
      expect(deserializeContent).toHaveBeenCalledWith('views: []', 'my-plugin:dashboard');
    });

    it('calls BaseConfig.deserialize with the raw data and view registry', async () => {
      const raw = { views: [{ type: 'table' }] };
      mockDeserializer(raw);
      const modal = new OutputPathModal(plugin.app, plugin, template);
      await (modal as any).create();
      expect(vi.mocked(BaseConfig.deserialize)).toHaveBeenCalledWith(raw, plugin.viewRegistry);
    });

    it('calls fileManager.createBase when the output file does not exist', async () => {
      plugin.app.vault.getAbstractFileByPath.mockReturnValue(null);
      const config = mockBaseConfig();
      const modal = new OutputPathModal(plugin.app, plugin, template);
      await (modal as any).create();
      expect(plugin.fileManager.createBase).toHaveBeenCalledWith(config, 'my-template');
    });

    it('calls fileManager.writeBase and not createBase when overwrite=true', async () => {
      const config = mockBaseConfig();
      const modal = new OutputPathModal(plugin.app, plugin, template);
      await (modal as any).create(true);
      expect(plugin.fileManager.writeBase).toHaveBeenCalledWith(config, 'my-template');
      expect(plugin.fileManager.createBase).not.toHaveBeenCalled();
    });

    it('opens a ConfirmOverwriteModal and does not call createBase when file exists', async () => {
      plugin.app.vault.getAbstractFileByPath.mockReturnValue({} /* existing file */);
      const openSpy = vi.spyOn(Modal.prototype, 'open');
      const modal = new OutputPathModal(plugin.app, plugin, template);
      await (modal as any).create(false);
      expect(openSpy).toHaveBeenCalledOnce();
      expect(plugin.fileManager.createBase).not.toHaveBeenCalled();
    });

    it('shows a Notice containing "Created" after a successful createBase', async () => {
      plugin.app.vault.getAbstractFileByPath.mockReturnValue(null);
      const modal = new OutputPathModal(plugin.app, plugin, template);
      await (modal as any).create();
      expect(Notice).toHaveBeenCalledWith(expect.stringContaining('Created'));
    });

    it('shows a Notice containing "Overwrote" after a successful writeBase', async () => {
      const modal = new OutputPathModal(plugin.app, plugin, template);
      await (modal as any).create(true);
      expect(Notice).toHaveBeenCalledWith(expect.stringContaining('Overwrote'));
    });

    it('calls close() after a successful create', async () => {
      plugin.app.vault.getAbstractFileByPath.mockReturnValue(null);
      const modal = new OutputPathModal(plugin.app, plugin, template);
      const closeSpy = vi.spyOn(modal, 'close');
      await (modal as any).create();
      expect(closeSpy).toHaveBeenCalledOnce();
    });

    it('calls close() after a successful overwrite', async () => {
      const modal = new OutputPathModal(plugin.app, plugin, template);
      const closeSpy = vi.spyOn(modal, 'close');
      await (modal as any).create(true);
      expect(closeSpy).toHaveBeenCalledOnce();
    });

    it('does not append .base when outputPath already has an extension', async () => {
      plugin.app.vault.getAbstractFileByPath.mockReturnValue(null);
      const modal = new OutputPathModal(plugin.app, plugin, template);
      (modal as any).outputPath = 'my-file.base';
      await (modal as any).create();
      expect(plugin.app.vault.getAbstractFileByPath).toHaveBeenCalledWith('my-file.base');
    });

    it('appends .base for the existence check when outputPath has no extension', async () => {
      plugin.app.vault.getAbstractFileByPath.mockReturnValue(null);
      const modal = new OutputPathModal(plugin.app, plugin, template);
      (modal as any).outputPath = 'my-file';
      await (modal as any).create();
      expect(plugin.app.vault.getAbstractFileByPath).toHaveBeenCalledWith('my-file.base');
    });

    it('shows an error Notice when deserialization throws', async () => {
      vi.mocked(VaultDeserializer).mockImplementation(function() {
        return {
          deserialize: vi.fn().mockRejectedValue(new Error('YAML parse error')),
          deserializeContent: vi.fn().mockRejectedValue(new Error('YAML parse error')),
        };
      } as any);
      const modal = new OutputPathModal(plugin.app, plugin, template);
      await (modal as any).create();
      expect(Notice).toHaveBeenCalledWith(expect.stringContaining('YAML parse error'), 0);
    });

    it('shows an error Notice when fileManager throws and does not rethrow', async () => {
      plugin.app.vault.getAbstractFileByPath.mockReturnValue(null);
      plugin.fileManager.createBase.mockRejectedValue(new Error('Disk full'));
      const modal = new OutputPathModal(plugin.app, plugin, template);
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
    const modal = new ConfirmOverwriteModal(app, 'some/path.base', vi.fn());
    modal.onClose();
    expect(modal.contentEl.empty).toHaveBeenCalledOnce();
  });
});
