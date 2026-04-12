// templateFileManager.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateFileManager } from '../fileManagement/templateFileManager';
import { VaultTemplateSource, ExternalTemplateSource } from 'bases/templateSource';
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSetup(overrides: { sources?: Map<string, any> } = {}) {
  const { sources = new Map() } = overrides;

  const app = {} as any;

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

/** Wires VaultDeserializer mock. */
function mockDeserializer(raw: unknown = { views: [] }, harvestedParams: unknown = {}) {
  const deserializeFile = vi.fn().mockResolvedValue(raw);
  const deserializeContent = vi.fn().mockResolvedValue(raw);
  const collectFileParams = vi.fn().mockResolvedValue(harvestedParams);
  const collectContentParams = vi.fn().mockResolvedValue(harvestedParams);
  vi.mocked(VaultDeserializer).mockImplementation(function () {
    return { deserializeFile, deserializeContent, collectFileParams, collectContentParams };
  } as any);
  return { deserializeFile, deserializeContent, collectFileParams, collectContentParams };
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
    it('deserializes via VaultDeserializer.deserializeFile with the vault path', async () => {
      const { manager } = makeSetup();
      const { deserializeFile } = mockDeserializer();
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await manager.createBaseFromTemplate(source, 'output');
      expect(deserializeFile).toHaveBeenCalledWith(source);
    });

    it('passes raw data to BaseConfig.deserialize with the view registry', async () => {
      const { manager, viewRegistry } = makeSetup();
      const raw = { views: [{ type: 'table' }] };
      mockDeserializer(raw);
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await manager.createBaseFromTemplate(source, 'output');
      expect(vi.mocked(BaseConfig.deserialize)).toHaveBeenCalledWith(raw, viewRegistry);
    });

    it('stamps pb-metadata.template with the vault path via BaseBuilder.setMetadata', async () => {
      const { manager } = makeSetup();
      mockDeserializer();
      const { builderInstance } = mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await manager.createBaseFromTemplate(source, 'output');
      expect(builderInstance.setMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'Templates/board.yaml' })
      );
    });

    it('wraps a "File not found" error with a user-friendly message', async () => {
      const { manager } = makeSetup();
      vi.mocked(VaultDeserializer).mockImplementation(function () {
        return {
          deserializeFile: vi.fn().mockRejectedValue(new Error('File not found: Templates/board.yaml')),
          deserializeContent: vi.fn(),
          collectFileParams: vi.fn().mockResolvedValue({}),
          collectContentParams: vi.fn().mockResolvedValue({}),
        };
      } as any);
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await expect(manager.createBaseFromTemplate(source, 'output'))
        .rejects.toThrow('If you moved your bases folder, update the path in pb-metadata.template');
    });

    it('rethrows non-"File not found" errors unchanged', async () => {
      const { manager } = makeSetup();
      vi.mocked(VaultDeserializer).mockImplementation(function () {
        return {
          deserializeFile: vi.fn().mockRejectedValue(new Error('YAML parse error')),
          deserializeContent: vi.fn(),
          collectFileParams: vi.fn().mockResolvedValue({}),
          collectContentParams: vi.fn().mockResolvedValue({}),
        };
      } as any);
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await expect(manager.createBaseFromTemplate(source, 'output'))
        .rejects.toThrow('YAML parse error');
    });
  });

  // ── ExternalTemplateSource ─────────────────────────────────────────────────────

  describe('ExternalTemplateSource', () => {
    it('deserializes via VaultDeserializer.deserializeContent with the template content and ref', async () => {
      const sources = new Map([
        ['task-base', { name: 'task-base', templates: { 'dashboard': 'views: []' } }],
      ]);
      const { manager } = makeSetup({ sources });
      const { deserializeContent } = mockDeserializer();
      mockPipeline();
      const source = new ExternalTemplateSource('task-base', 'dashboard');
      await manager.createBaseFromTemplate(source, 'output');
      expect(deserializeContent).toHaveBeenCalledWith(source, 'views: []');
    });

    it('stamps pb-metadata.template with the plugin ref via BaseBuilder.setMetadata', async () => {
      const sources = new Map([
        ['task-base', { name: 'task-base', templates: { 'dashboard': 'views: []' } }],
      ]);
      const { manager } = makeSetup({ sources });
      mockDeserializer();
      const { builderInstance } = mockPipeline();
      const source = new ExternalTemplateSource('task-base', 'dashboard');
      await manager.createBaseFromTemplate(source, 'output');
      expect(builderInstance.setMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'task-base:dashboard' })
      );
    });

    it('throws when the plugin source name is not registered', async () => {
      const { manager } = makeSetup();
      mockDeserializer();
      mockPipeline();
      const source = new ExternalTemplateSource('unknown-plugin', 'dashboard');
      await expect(manager.createBaseFromTemplate(source, 'output'))
        .rejects.toThrow('not found in source "unknown-plugin"');
    });

    it('throws when the template name is not found in the source', async () => {
      const sources = new Map([
        ['task-base', { name: 'task-base', templates: {} }],
      ]);
      const { manager } = makeSetup({ sources });
      mockDeserializer();
      mockPipeline();
      const source = new ExternalTemplateSource('task-base', 'missing-template');
      await expect(manager.createBaseFromTemplate(source, 'output'))
        .rejects.toThrow('Template "missing-template" not found in source "task-base"');
    });
  });

  // ── resolvedParams threading ─────────────────────────────────────────────────

  describe('resolvedParams', () => {
    it('passes resolvedParams to VaultDeserializer constructor', async () => {
      const { manager } = makeSetup();
      mockDeserializer();
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      const params = { taskLocation: 'Tasks', flag: true };
      await manager.createBaseFromTemplate(source, 'output', params);
      const ctorArgs = vi.mocked(VaultDeserializer).mock.calls[0]!;
      expect(ctorArgs[3]).toEqual(params);
    });

    it('stamps setMetadata with params when non-empty', async () => {
      const { manager } = makeSetup();
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
      const { manager } = makeSetup();
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
      const { manager, fileManager } = makeSetup();
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
      const { manager, fileManager } = makeSetup();
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
    it('calls collectFileParams with the vault path for vault templates', async () => {
      const { manager } = makeSetup();
      const harvested = {
        taskLocation: { spec: { type: 'folder', label: 'Task folder' }, sources: [''] },
      };
      const { collectFileParams } = mockDeserializer({}, harvested);
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      const result = await manager.readParamSpecsFromTemplate(source);
      expect(collectFileParams).toHaveBeenCalledWith(source);
      expect(result).toEqual(harvested);
    });

    it('returns {} for a plugin template with no registered content', async () => {
      const { manager } = makeSetup();
      mockDeserializer();
      const source = new ExternalTemplateSource('task-base', 'dashboard');
      const result = await manager.readParamSpecsFromTemplate(source);
      expect(result).toEqual({});
    });

    it('calls collectContentParams with plugin template content and ref', async () => {
      const sources = new Map([
        ['task-base', { name: 'task-base', templates: { 'dashboard': 'views: []' } }],
      ]);
      const { manager } = makeSetup({ sources });
      const { collectContentParams } = mockDeserializer();
      const source = new ExternalTemplateSource('task-base', 'dashboard');
      await manager.readParamSpecsFromTemplate(source);
      expect(collectContentParams).toHaveBeenCalledWith(source, 'views: []');
    });
  });

  // ── loadTemplate is public ───────────────────────────────────────────────────

  describe('loadTemplate()', () => {
    it('is callable publicly', async () => {
      const { manager } = makeSetup();
      mockDeserializer();
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await expect(manager.loadTemplate(source, {})).resolves.not.toThrow();
    });
  });
});
