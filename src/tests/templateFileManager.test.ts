// templateFileManager.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateFileManager } from '../fileManagement/templateFileManager';
import { VaultTemplateSource, PluginTemplateSource } from 'bases/templateSource';
import { VaultDeserializer } from 'fileManagement/vaultDeserializer';
import { BaseConfig } from 'bases/baseConfig';
import { BaseBuilder } from 'bases/baseBuilder';

vi.mock('main', () => ({ default: class {} }));
vi.mock('settings', () => ({}));
vi.mock('fileManagement/vaultDeserializer', () => ({
  VaultDeserializer: vi.fn(),
}));
vi.mock('bases/baseConfig', () => ({
  BaseConfig: { deserialize: vi.fn() },
}));
vi.mock('bases/baseBuilder', () => ({
  BaseBuilder: vi.fn(),
}));
vi.mock('js-yaml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('js-yaml')>();
  return {
    ...actual,
    load: vi.fn(),
    dump: vi.fn((obj: unknown) => `yaml:${JSON.stringify(obj)}`),
  };
});

import * as yaml from 'js-yaml';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSetup(overrides: { sources?: Map<string, any> } = {}) {
  const { sources = new Map() } = overrides;

  const app = {
    vault: {
      getFileByPath: vi.fn(),
      read: vi.fn().mockResolvedValue(''),
    },
  } as any;

  const fileManager = {
    createBase: vi.fn().mockResolvedValue(undefined),
    writeBase: vi.fn().mockResolvedValue(undefined),
  };
  const viewRegistry = {} as any;

  const manager = new TemplateFileManager(
    app,
    fileManager as any,
    viewRegistry,
    () => sources,
    () => 'Templates/components',
  );

  return { manager, fileManager, viewRegistry, sources, app };
}

/** Wires VaultDeserializer mock to return a specific raw object. */
function mockDeserializer(raw: unknown = { views: [] }) {
  const deserialize = vi.fn().mockResolvedValue(raw);
  const deserializeContent = vi.fn().mockResolvedValue(raw);
  const harvestParams = vi.fn().mockResolvedValue({});
  vi.mocked(VaultDeserializer).mockImplementation(function () {
    return { deserialize, deserializeContent, harvestParams };
  } as any);
  return { deserialize, deserializeContent, harvestParams };
}

/** Wires BaseConfig.deserialize and BaseBuilder chain, returns the built config object. */
function mockPipeline(builtConfig: unknown = { views: [] }) {
  const rawConfig = {};
  vi.mocked(BaseConfig.deserialize).mockReturnValue(rawConfig as BaseConfig);
  const builderInstance = {
    setMetadata: vi.fn().mockReturnThis(),
    build: vi.fn().mockReturnValue(builtConfig),
  };
  vi.mocked(BaseBuilder).mockImplementation(function () { return builderInstance; } as any);
  return { builderInstance, builtConfig };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TemplateFileManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── VaultTemplateSource ──────────────────────────────────────────────────────

  describe('VaultTemplateSource', () => {
    it('deserializes via VaultDeserializer.deserializeContent with the original vault text', async () => {
      const { manager, app } = makeSetup();
      const file = { path: 'Templates/board.yaml' };
      app.vault.getFileByPath.mockReturnValue(file);
      const vaultText = 'views: []';
      app.vault.read.mockResolvedValue(vaultText);
      vi.mocked(yaml.load).mockReturnValue({ views: [] });
      const { deserializeContent } = mockDeserializer();
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await manager.createBaseFromTemplate(source, 'output');
      expect(deserializeContent).toHaveBeenCalledWith(vaultText, source.path);
    });

    it('passes raw data to BaseConfig.deserialize with the view registry', async () => {
      const { manager, viewRegistry, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('name: hello');
      const raw = { views: [{ type: 'table' }] };
      vi.mocked(yaml.load).mockReturnValue(raw);
      mockDeserializer(raw);
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await manager.createBaseFromTemplate(source, 'output');
      expect(vi.mocked(BaseConfig.deserialize)).toHaveBeenCalledWith(raw, viewRegistry);
    });

    it('stamps pb-metadata.template with the vault path via BaseBuilder.setMetadata', async () => {
      const { manager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('');
      vi.mocked(yaml.load).mockReturnValue({});
      mockDeserializer();
      const { builderInstance } = mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await manager.createBaseFromTemplate(source, 'output');
      expect(builderInstance.setMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'Templates/board.yaml' })
      );
    });

    it('wraps a "File not found" error with a user-friendly message', async () => {
      const { manager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('');
      vi.mocked(yaml.load).mockReturnValue({});
      vi.mocked(VaultDeserializer).mockImplementation(function () {
        return {
          deserialize: vi.fn().mockRejectedValue(new Error('File not found: Templates/board.yaml')),
          deserializeContent: vi.fn().mockRejectedValue(new Error('File not found: Templates/board.yaml')),
          harvestParams: vi.fn().mockResolvedValue({}),
        };
      } as any);
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await expect(manager.createBaseFromTemplate(source, 'output'))
        .rejects.toThrow('If you moved your bases folder, update the path in pb-metadata.template');
    });

    it('rethrows non-"File not found" errors unchanged', async () => {
      const { manager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('');
      vi.mocked(yaml.load).mockReturnValue({});
      vi.mocked(VaultDeserializer).mockImplementation(function () {
        return {
          deserialize: vi.fn().mockRejectedValue(new Error('YAML parse error')),
          deserializeContent: vi.fn().mockRejectedValue(new Error('YAML parse error')),
          harvestParams: vi.fn().mockResolvedValue({}),
        };
      } as any);
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await expect(manager.createBaseFromTemplate(source, 'output'))
        .rejects.toThrow('YAML parse error');
    });
  });

  // ── PluginTemplateSource ─────────────────────────────────────────────────────

  describe('PluginTemplateSource', () => {
    it('deserializes via VaultDeserializer.deserializeContent with the template content and ref', async () => {
      const sources = new Map([
        ['task-base', { name: 'task-base', templates: { 'dashboard': 'views: []' } }],
      ]);
      const { manager } = makeSetup({ sources });
      vi.mocked(yaml.load).mockReturnValue({ views: [] }); // no content: wrapper
      const { deserializeContent } = mockDeserializer();
      mockPipeline();
      const source = new PluginTemplateSource('task-base', 'dashboard');
      await manager.createBaseFromTemplate(source, 'output');
      expect(deserializeContent).toHaveBeenCalled();
    });

    it('stamps pb-metadata.template with the plugin ref via BaseBuilder.setMetadata', async () => {
      const sources = new Map([
        ['task-base', { name: 'task-base', templates: { 'dashboard': 'views: []' } }],
      ]);
      const { manager } = makeSetup({ sources });
      vi.mocked(yaml.load).mockReturnValue({ views: [] });
      mockDeserializer();
      const { builderInstance } = mockPipeline();
      const source = new PluginTemplateSource('task-base', 'dashboard');
      await manager.createBaseFromTemplate(source, 'output');
      expect(builderInstance.setMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'task-base:dashboard' })
      );
    });

    it('throws when the plugin source name is not registered', async () => {
      const { manager } = makeSetup();
      vi.mocked(yaml.load).mockReturnValue({});
      mockDeserializer();
      mockPipeline();
      const source = new PluginTemplateSource('unknown-plugin', 'dashboard');
      await expect(manager.createBaseFromTemplate(source, 'output'))
        .rejects.toThrow('not found in source "unknown-plugin"');
    });

    it('throws when the template name is not found in the source', async () => {
      const sources = new Map([
        ['task-base', { name: 'task-base', templates: {} }],
      ]);
      const { manager } = makeSetup({ sources });
      vi.mocked(yaml.load).mockReturnValue({});
      mockDeserializer();
      mockPipeline();
      const source = new PluginTemplateSource('task-base', 'missing-template');
      await expect(manager.createBaseFromTemplate(source, 'output'))
        .rejects.toThrow('Template "missing-template" not found in source "task-base"');
    });
  });

  // ── resolvedParams threading ─────────────────────────────────────────────────

  describe('resolvedParams', () => {
    it('passes resolvedParams to VaultDeserializer constructor', async () => {
      const { manager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('');
      vi.mocked(yaml.load).mockReturnValue({});
      mockDeserializer();
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      const params = { taskLocation: 'Tasks', flag: true };
      await manager.createBaseFromTemplate(source, 'output', params);
      // Fourth arg to VaultDeserializer constructor should be the params
      const ctorArgs = vi.mocked(VaultDeserializer).mock.calls[0]!;
      expect(ctorArgs[3]).toEqual(params);
    });

    it('stamps setMetadata with params when non-empty', async () => {
      const { manager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('');
      vi.mocked(yaml.load).mockReturnValue({});
      mockDeserializer();
      const { builderInstance } = mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      const params = { taskLocation: 'Tasks' };
      await manager.createBaseFromTemplate(source, 'output', params);
      expect(builderInstance.setMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ params })
      );
    });

    it('omits params from setMetadata when empty', async () => {
      const { manager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('');
      vi.mocked(yaml.load).mockReturnValue({});
      mockDeserializer();
      const { builderInstance } = mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await manager.createBaseFromTemplate(source, 'output', {});
      const meta = builderInstance.setMetadata.mock.calls[0]![0];
      expect(meta.params).toBeUndefined();
    });
  });

  // ── createBase vs writeBase routing ─────────────────────────────────────────

  describe('createBaseFromTemplate()', () => {
    it('calls fileManager.createBase with the built config and output path', async () => {
      const { manager, fileManager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('');
      vi.mocked(yaml.load).mockReturnValue({});
      mockDeserializer();
      const { builtConfig } = mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await manager.createBaseFromTemplate(source, 'my-board');
      expect(fileManager.createBase).toHaveBeenCalledWith(builtConfig, 'my-board');
      expect(fileManager.writeBase).not.toHaveBeenCalled();
    });
  });

  describe('writeBaseFromTemplate()', () => {
    it('calls fileManager.writeBase with the built config and output path', async () => {
      const { manager, fileManager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('');
      vi.mocked(yaml.load).mockReturnValue({});
      mockDeserializer();
      const { builtConfig } = mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await manager.writeBaseFromTemplate(source, 'my-board');
      expect(fileManager.writeBase).toHaveBeenCalledWith(builtConfig, 'my-board');
      expect(fileManager.createBase).not.toHaveBeenCalled();
    });
  });

  // ── readParamSpecsFromTemplate ───────────────────────────────────────────────

  describe('readParamSpecsFromTemplate()', () => {
    it('returns {} when the template file does not exist', async () => {
      const { manager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue(null);
      vi.mocked(yaml.load).mockReturnValue(null);
      const source = new VaultTemplateSource('Templates/missing.yaml', {} as any);
      const result = await manager.readParamSpecsFromTemplate(source);
      expect(result).toEqual({});
    });

    it('returns template-level params from pb-metadata.params', async () => {
      const { manager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('');
      vi.mocked(yaml.load).mockReturnValue({
        'pb-metadata': { params: { taskLocation: { type: 'folder', label: 'Task folder' } } },
        views: [],
      });
      mockDeserializer(); // harvestParams returns {}
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      const result = await manager.readParamSpecsFromTemplate(source);
      expect(result.taskLocation).toBeDefined();
      expect(result.taskLocation!.spec.type).toBe('folder');
      expect(result.taskLocation!.sources).toContain('');
    });

    it('merges template-level and component-level params', async () => {
      const { manager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('pb-metadata:\n  params:\n    x:\n      type: string');
      vi.mocked(yaml.load).mockReturnValue({
        'pb-metadata': { params: { x: { type: 'string' } } },
      });
      // Component contributes a second param
      const harvestParams = vi.fn().mockResolvedValue({
        y: { spec: { type: 'boolean' }, sources: ['some/comp'] },
      });
      vi.mocked(VaultDeserializer).mockImplementation(function () {
        return { deserialize: vi.fn(), deserializeContent: vi.fn(), harvestParams };
      } as any);
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      const result = await manager.readParamSpecsFromTemplate(source);
      expect(result.x).toBeDefined();
      expect(result.y).toBeDefined();
    });

    it('returns {} for a plugin template with no pb-metadata.params', async () => {
      const sources = new Map([
        ['task-base', { name: 'task-base', templates: { 'dashboard': 'views: []' } }],
      ]);
      const { manager } = makeSetup({ sources });
      vi.mocked(yaml.load).mockReturnValue({ views: [] }); // no metadata key
      mockDeserializer();
      const source = new PluginTemplateSource('task-base', 'dashboard');
      const result = await manager.readParamSpecsFromTemplate(source);
      expect(result).toEqual({});
    });
  });

  // ── loadTemplate is public ───────────────────────────────────────────────────

  describe('loadTemplate()', () => {
    it('is callable publicly', async () => {
      const { manager, app } = makeSetup();
      app.vault.getFileByPath.mockReturnValue({ path: 'Templates/board.yaml' });
      app.vault.read.mockResolvedValue('');
      vi.mocked(yaml.load).mockReturnValue({});
      mockDeserializer();
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      // Should not throw — method is public
      await expect(manager.loadTemplate(source, {})).resolves.not.toThrow();
    });
  });
});
