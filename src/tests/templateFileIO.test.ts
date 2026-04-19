// templateFileIO.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateFileIO } from '../fileManagement/templateFileIO';
import { VaultTemplateSource } from 'bases/templateSource';

vi.mock('main', () => ({ default: class {} }));
vi.mock('settings', () => ({}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const builtConfig = { views: [] } as any;

function makeSetup() {
  const baseFileIO = {
    readBase: vi.fn(),
    createBase: vi.fn().mockResolvedValue(undefined),
    writeBase: vi.fn().mockResolvedValue(undefined),
  };
  const resolver = {
    parseHeaderRef: vi.fn(),
  } as any;

  const evaluator = {
    evaluateTemplate: vi.fn().mockResolvedValue(builtConfig),
  } as any;

  const io = new TemplateFileIO(baseFileIO as any, resolver, evaluator);

  return { io, baseFileIO, resolver, evaluator };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TemplateFileIO', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── createBaseFromTemplate ───────────────────────────────────────────────────

  describe('createBaseFromTemplate()', () => {
    it('calls evaluator.evaluateTemplate with the source and params', async () => {
      const { io, evaluator } = makeSetup();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      const params = { taskLocation: 'Tasks' };
      await io.createBaseFromTemplate(source, 'my-board', params);
      expect(evaluator.evaluateTemplate).toHaveBeenCalledWith(source, params);
    });

    it('calls baseFileIO.createBase with the built config and output path', async () => {
      const { io, baseFileIO } = makeSetup();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await io.createBaseFromTemplate(source, 'my-board');
      expect(baseFileIO.createBase).toHaveBeenCalledWith(builtConfig, 'my-board');
      expect(baseFileIO.writeBase).not.toHaveBeenCalled();
    });
  });

  // ── writeBaseFromTemplate ────────────────────────────────────────────────────

  describe('writeBaseFromTemplate()', () => {
    it('calls evaluator.evaluateTemplate with the source and params', async () => {
      const { io, evaluator } = makeSetup();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      const params = { taskLocation: 'Tasks' };
      await io.writeBaseFromTemplate(source, 'my-board', params);
      expect(evaluator.evaluateTemplate).toHaveBeenCalledWith(source, params);
    });

    it('calls baseFileIO.writeBase with the built config and output path', async () => {
      const { io, baseFileIO } = makeSetup();
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      await io.writeBaseFromTemplate(source, 'my-board');
      expect(baseFileIO.writeBase).toHaveBeenCalledWith(builtConfig, 'my-board');
      expect(baseFileIO.createBase).not.toHaveBeenCalled();
    });
  });

  // ── writeBaseFromStoredRef ───────────────────────────────────────────────────

  describe('writeBaseFromStoredRef()', () => {
    it('reads stored params from the base file and passes them to evaluateTemplate', async () => {
      const { io, baseFileIO, resolver, evaluator } = makeSetup();
      const storedConfig = { metadata: { params: { folder: 'Tasks' } } } as any;
      baseFileIO.readBase.mockResolvedValue(storedConfig);
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      resolver.parseHeaderRef.mockReturnValue(source);
      await io.writeBaseFromStoredRef('Templates/board.yaml', 'my-board.base');
      expect(evaluator.evaluateTemplate).toHaveBeenCalledWith(
        source,
        expect.objectContaining({ folder: 'Tasks' }),
      );
    });

    it('uses overrideParams on top of stored params (overrides win)', async () => {
      const { io, baseFileIO, resolver, evaluator } = makeSetup();
      const storedConfig = { metadata: { params: { folder: 'Tasks', flag: false } } } as any;
      baseFileIO.readBase.mockResolvedValue(storedConfig);
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      resolver.parseHeaderRef.mockReturnValue(source);
      await io.writeBaseFromStoredRef('Templates/board.yaml', 'my-board.base', { flag: true });
      expect(evaluator.evaluateTemplate).toHaveBeenCalledWith(
        source,
        expect.objectContaining({ folder: 'Tasks', flag: true }),
      );
    });

    it('falls back to empty params when base file does not exist', async () => {
      const { io, baseFileIO, resolver, evaluator } = makeSetup();
      baseFileIO.readBase.mockRejectedValue(new Error('File not found'));
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      resolver.parseHeaderRef.mockReturnValue(source);
      await io.writeBaseFromStoredRef('Templates/board.yaml', 'new-board.base');
      expect(evaluator.evaluateTemplate).toHaveBeenCalledWith(source, {});
    });

    it('calls resolver.parseHeaderRef with the template ref', async () => {
      const { io, baseFileIO, resolver } = makeSetup();
      baseFileIO.readBase.mockResolvedValue({ metadata: undefined });
      const source = new VaultTemplateSource('Templates/board.yaml', {} as any);
      resolver.parseHeaderRef.mockReturnValue(source);
      await io.writeBaseFromStoredRef('Templates/board.yaml', 'my-board.base');
      expect(resolver.parseHeaderRef).toHaveBeenCalledWith('Templates/board.yaml');
    });
  });


});
