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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSetup(overrides: { sources?: Map<string, any> } = {}) {
  const {
    sources = new Map(),
  } = overrides;

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

/** Wires VaultDeserializer mock to return a specific raw object. */
function mockDeserializer(raw: unknown = { views: [] }) {
  const deserialize = vi.fn().mockResolvedValue(raw);
  const deserializeContent = vi.fn().mockResolvedValue(raw);
  vi.mocked(VaultDeserializer).mockImplementation(function () {
    return { deserialize, deserializeContent };
  } as any);
  return { deserialize, deserializeContent };
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

  // ── Vault template path ─────────────────────────────────────────────────────

  describe('VaultTemplateSource', () => {
    it('deserializes via VaultDeserializer.deserialize with the template path', async () => {
      const { manager } = makeSetup();
      const { deserialize } = mockDeserializer();
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await manager.createBaseFromTemplate(source, 'output');
      expect(deserialize).toHaveBeenCalledWith('Templates/board.yaml');
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
      expect(builderInstance.setMetadata).toHaveBeenCalledWith({ template: 'Templates/board.yaml' });
    });
  });

  // ── Plugin template path ────────────────────────────────────────────────────

  describe('PluginTemplateSource', () => {
    it('deserializes via VaultDeserializer.deserializeContent with the template content and ref', async () => {
      const sources = new Map([
        ['task-base', { name: 'task-base', templates: { 'dashboard': 'views: []' } }],
      ]);
      const { manager } = makeSetup({ sources });
      const { deserializeContent } = mockDeserializer();
      mockPipeline();
      const source = new PluginTemplateSource('task-base', 'dashboard');
      await manager.createBaseFromTemplate(source, 'output');
      expect(deserializeContent).toHaveBeenCalledWith('views: []', 'task-base:dashboard');
    });

    it('stamps pb-metadata.template with the plugin ref via BaseBuilder.setMetadata', async () => {
      const sources = new Map([
        ['task-base', { name: 'task-base', templates: { 'dashboard': 'views: []' } }],
      ]);
      const { manager } = makeSetup({ sources });
      mockDeserializer();
      const { builderInstance } = mockPipeline();
      const source = new PluginTemplateSource('task-base', 'dashboard');
      await manager.createBaseFromTemplate(source, 'output');
      expect(builderInstance.setMetadata).toHaveBeenCalledWith({ template: 'task-base:dashboard' });
    });

    it('wraps a "File not found" error with a user-friendly message pointing to pb-metadata.template', async () => {
      const { manager } = makeSetup();
      vi.mocked(VaultDeserializer).mockImplementation(function () {
        return {
          deserialize: vi.fn().mockRejectedValue(new Error('File not found: Templates/board.yaml')),
          deserializeContent: vi.fn(),
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
          deserialize: vi.fn().mockRejectedValue(new Error('YAML parse error')),
          deserializeContent: vi.fn(),
        };
      } as any);
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await expect(manager.createBaseFromTemplate(source, 'output'))
        .rejects.toThrow('YAML parse error');
    });

    it('throws when the plugin source name is not registered', async () => {
      const { manager } = makeSetup();
      mockDeserializer();
      mockPipeline();
      const source = new PluginTemplateSource('unknown-plugin', 'dashboard');
      await expect(manager.createBaseFromTemplate(source, 'output'))
        .rejects.toThrow('Unknown template source: "unknown-plugin"');
    });

    it('throws when the template name is not found in the source', async () => {
      const sources = new Map([
        ['task-base', { name: 'task-base', templates: {} }],
      ]);
      const { manager } = makeSetup({ sources });
      mockDeserializer();
      mockPipeline();
      const source = new PluginTemplateSource('task-base', 'missing-template');
      await expect(manager.createBaseFromTemplate(source, 'output'))
        .rejects.toThrow('Template "missing-template" not found in source "task-base"');
    });
  });

  // ── createBase vs writeBase routing ────────────────────────────────────────

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
});
