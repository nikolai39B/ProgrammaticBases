// templateFileIO.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateFileIO } from '../fileManagement/templateFileIO';
import { VaultTemplateSource, ExternalTemplateSource } from 'bases/templateSource';
import { BaseConfig } from 'bases/baseConfig';
import { BaseBuilder } from 'bases/baseBuilder';

vi.mock('main', () => ({ default: class {} }));
vi.mock('settings', () => ({}));
vi.mock('bases/baseConfig', () => ({
  BaseConfig: { deserialize: vi.fn() },
}));
vi.mock('bases/baseBuilder', () => ({
  BaseBuilder: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSetup(overrides: { evaluatorRaw?: unknown; evaluatorParams?: unknown } = {}) {
  const baseFileIO = {
    readBase: vi.fn(),
    createBase: vi.fn().mockResolvedValue(undefined),
    writeBase: vi.fn().mockResolvedValue(undefined),
  };
  const viewRegistry = {} as any;
  const resolver = {
    parseHeaderRef: vi.fn(),
  } as any;

  // Plain mock evaluator — avoids the class-mock-before-instantiation timing issue
  const evaluator = {
    evaluate: vi.fn().mockResolvedValue(overrides.evaluatorRaw ?? { views: [] }),
    collectParams: vi.fn().mockResolvedValue(overrides.evaluatorParams ?? {}),
  } as any;

  const io = new TemplateFileIO(
    baseFileIO as any,
    () => viewRegistry,
    resolver,
    evaluator,
  );

  return { io, baseFileIO, viewRegistry, resolver, evaluator };
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

describe('TemplateFileIO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── evaluateTemplate ─────────────────────────────────────────────────────────

  describe('evaluateTemplate()', () => {
    it('calls evaluator.evaluate with the source and resolvedParams', async () => {
      const { io, evaluator } = makeSetup();
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      const params = { taskLocation: 'Tasks' };
      await io.evaluateTemplate(source, params);
      expect(evaluator.evaluate).toHaveBeenCalledWith(source, params);
    });

    it('passes raw data to BaseConfig.deserialize with the view registry', async () => {
      const raw = { views: [{ type: 'table' }] };
      const { io, viewRegistry } = makeSetup({ evaluatorRaw: raw });
      mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await io.evaluateTemplate(source);
      expect(vi.mocked(BaseConfig.deserialize)).toHaveBeenCalledWith(raw, viewRegistry);
    });

    it('stamps pb-metadata.template with the source ref via BaseBuilder.setMetadata', async () => {
      const { io } = makeSetup();
      const { builderInstance } = mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await io.evaluateTemplate(source);
      expect(builderInstance.setMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'Templates/board.yaml' })
      );
    });

    it('stamps pb-metadata.params when resolvedParams is non-empty', async () => {
      const { io } = makeSetup();
      const { builderInstance } = mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      const params = { taskLocation: 'Tasks' };
      await io.evaluateTemplate(source, params);
      expect(builderInstance.setMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ params })
      );
    });

    it('omits pb-metadata.params when resolvedParams is empty', async () => {
      const { io } = makeSetup();
      const { builderInstance } = mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await io.evaluateTemplate(source, {});
      const meta = builderInstance.setMetadata.mock.calls[0]![0];
      expect(meta.params).toBeUndefined();
    });

    it('stamps the external ref for ExternalTemplateSource', async () => {
      const { io } = makeSetup();
      const { builderInstance } = mockPipeline();
      const source = new ExternalTemplateSource('task-base', 'dashboard');
      await io.evaluateTemplate(source);
      expect(builderInstance.setMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'task-base:dashboard' })
      );
    });
  });

  // ── createBaseFromTemplate ───────────────────────────────────────────────────

  describe('createBaseFromTemplate()', () => {
    it('calls baseFileIO.createBase with the built config and output path', async () => {
      const { io, baseFileIO } = makeSetup();
      const { builtConfig } = mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await io.createBaseFromTemplate(source, 'my-board');
      expect(baseFileIO.createBase).toHaveBeenCalledWith(builtConfig, 'my-board');
      expect(baseFileIO.writeBase).not.toHaveBeenCalled();
    });
  });

  // ── writeBaseFromTemplate ────────────────────────────────────────────────────

  describe('writeBaseFromTemplate()', () => {
    it('calls baseFileIO.writeBase with the built config and output path', async () => {
      const { io, baseFileIO } = makeSetup();
      const { builtConfig } = mockPipeline();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await io.writeBaseFromTemplate(source, 'my-board');
      expect(baseFileIO.writeBase).toHaveBeenCalledWith(builtConfig, 'my-board');
      expect(baseFileIO.createBase).not.toHaveBeenCalled();
    });
  });

  // ── writeBaseFromStoredRef ───────────────────────────────────────────────────

  describe('writeBaseFromStoredRef()', () => {
    it('reads stored params from the base file and passes them to evaluateTemplate', async () => {
      const { io, baseFileIO, resolver } = makeSetup();
      const storedConfig = { metadata: { params: { folder: 'Tasks' } } } as any;
      baseFileIO.readBase.mockResolvedValue(storedConfig);
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      resolver.parseHeaderRef.mockReturnValue(source);
      const { builderInstance } = mockPipeline();
      await io.writeBaseFromStoredRef('Templates/board.yaml', 'my-board.base');
      expect(builderInstance.setMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ params: { folder: 'Tasks' } })
      );
    });

    it('uses overrideParams on top of stored params (overrides win)', async () => {
      const { io, baseFileIO, resolver, evaluator } = makeSetup();
      const storedConfig = { metadata: { params: { folder: 'Tasks', flag: false } } } as any;
      baseFileIO.readBase.mockResolvedValue(storedConfig);
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      resolver.parseHeaderRef.mockReturnValue(source);
      mockPipeline();
      await io.writeBaseFromStoredRef('Templates/board.yaml', 'my-board.base', { flag: true });
      expect(evaluator.evaluate).toHaveBeenCalledWith(
        source,
        expect.objectContaining({ folder: 'Tasks', flag: true }),
      );
    });

    it('falls back to empty params when base file does not exist', async () => {
      const { io, baseFileIO, resolver, evaluator } = makeSetup();
      baseFileIO.readBase.mockRejectedValue(new Error('File not found'));
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      resolver.parseHeaderRef.mockReturnValue(source);
      mockPipeline();
      await io.writeBaseFromStoredRef('Templates/board.yaml', 'new-board.base');
      expect(evaluator.evaluate).toHaveBeenCalledWith(source, {});
    });

    it('calls resolver.parseHeaderRef with the template ref', async () => {
      const { io, baseFileIO, resolver } = makeSetup();
      baseFileIO.readBase.mockResolvedValue({ metadata: undefined });
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      resolver.parseHeaderRef.mockReturnValue(source);
      mockPipeline();
      await io.writeBaseFromStoredRef('Templates/board.yaml', 'my-board.base');
      expect(resolver.parseHeaderRef).toHaveBeenCalledWith('Templates/board.yaml');
    });
  });

  // ── readParamSpecsFromTemplate ───────────────────────────────────────────────

  describe('readParamSpecsFromTemplate()', () => {
    it('delegates to evaluator.collectParams', async () => {
      const harvested = {
        taskLocation: { spec: { type: 'folder', label: 'Task folder' }, sources: [''] },
      };
      const { io, evaluator } = makeSetup({ evaluatorParams: harvested });
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      const result = await io.readParamSpecsFromTemplate(source);
      expect(evaluator.collectParams).toHaveBeenCalledWith(source);
      expect(result).toEqual(harvested);
    });
  });
});
