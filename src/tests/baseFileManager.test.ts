// baseFileManager.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TFile } from 'obsidian';                              // ← resolves to __mocks__/obsidian.ts
import { BaseFileManager } from 'fileManagement/baseFileManager';
import { BaseConfig } from 'bases/baseConfig';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// obsidian is handled globally via the alias in vitest.config.ts
// js-yaml is mocked here since it's only relevant to this test file

vi.mock('js-yaml', () => ({
  dump: vi.fn((obj: unknown) => `yaml:${JSON.stringify(obj)}`),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeApp() {
  const vault = {
    getAbstractFileByPath: vi.fn(),
    create: vi.fn().mockResolvedValue(undefined),
    modify: vi.fn().mockResolvedValue(undefined),
    createFolder: vi.fn().mockResolvedValue(undefined),
  };

  return {
    vault,
    app: { vault } as unknown as import('obsidian').App,
  };
}

function makeConfig(serialized: Record<string, unknown> = { name: 'Test' }): BaseConfig {
  return {
    serialize: vi.fn().mockReturnValue(serialized),
  } as unknown as BaseConfig;
}

function makeTFile(): TFile {
  return Object.create(TFile.prototype) as TFile;
}

/**
 * Configures getAbstractFileByPath to simulate a partial directory structure.
 * Paths in `existingPaths` return a truthy object; everything else returns null.
 * Useful for testing that only missing intermediate directories are created.
 */
function mockExistingPaths(
  vault: ReturnType<typeof makeApp>['vault'],
  existingPaths: string[]
) {
  vault.getAbstractFileByPath.mockImplementation((path: string) =>
    existingPaths.includes(path) ? {} : null
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BaseFileManager', () => {

  let vault: ReturnType<typeof makeApp>['vault'];
  let app: ReturnType<typeof makeApp>['app'];
  let manager: BaseFileManager;
  let config: BaseConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ vault, app } = makeApp());
    manager = new BaseFileManager(app);
    config = makeConfig();
  });

  // ── createBase() ─────────────────────────────────────────────────────────────

  describe('createBase()', () => {

    // ── Path resolution ────────────────────────────────────────────────────────

    describe('path resolution', () => {
      it('appends .base extension when no extension is provided', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.createBase(config, 'my-base');

        expect(vault.create).toHaveBeenCalledWith('my-base.base', expect.any(String));
      });

      it('preserves an existing extension and does not append .base', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.createBase(config, 'my-base.custom');

        expect(vault.create).toHaveBeenCalledWith('my-base.custom', expect.any(String));
      });

      it('appends .base when the path has a dot in a folder name but no file extension', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.createBase(config, 'folder.name/my-base');

        expect(vault.create).toHaveBeenCalledWith('folder.name/my-base.base', expect.any(String));
      });

      it('uses the resolved path for the existence check', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.createBase(config, 'my-base');

        expect(vault.getAbstractFileByPath).toHaveBeenCalledWith('my-base.base');
      });

      it('throws if filePath is empty', async () => {
        await expect(manager.createBase(config, '')).rejects.toThrow(/must not be empty/i);
      });

      it('throws if filePath is whitespace only', async () => {
        await expect(manager.createBase(config, '   ')).rejects.toThrow(/must not be empty/i);
      });
    });

    // ── File creation ──────────────────────────────────────────────────────────

    describe('file creation', () => {
      it('creates a new file when none exists', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.createBase(config, 'my-base');

        expect(vault.create).toHaveBeenCalledOnce();
        expect(vault.create).toHaveBeenCalledWith('my-base.base', expect.any(String));
      });

      it('throws if a file already exists at the resolved path', async () => {
        vault.getAbstractFileByPath.mockReturnValue(makeTFile());

        await expect(manager.createBase(config, 'my-base')).rejects.toThrow(/already exists/i);
      });

      it('does not call vault.create if the file already exists', async () => {
        vault.getAbstractFileByPath.mockReturnValue(makeTFile());

        await expect(manager.createBase(config, 'my-base')).rejects.toThrow();
        expect(vault.create).not.toHaveBeenCalled();
      });

      it('passes serialized config content to vault.create', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);
        const serialized = { name: 'My Base', views: [] };
        config = makeConfig(serialized);

        await manager.createBase(config, 'my-base');

        const content = vault.create.mock.calls[0]?.[1] as string;
        expect(content).toContain(JSON.stringify(serialized));
      });

      it('calls config.serialize() exactly once', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.createBase(config, 'my-base');

        expect(config.serialize).toHaveBeenCalledOnce();
      });

      it('propagates vault.create errors', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);
        vault.create.mockRejectedValue(new Error('Disk full'));

        await expect(manager.createBase(config, 'my-base')).rejects.toThrow('Disk full');
      });
    });

    // ── Directory creation ─────────────────────────────────────────────────────

    describe('directory creation', () => {
      it('does not call createFolder for a root-level file', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.createBase(config, 'my-base');

        expect(vault.createFolder).not.toHaveBeenCalled();
      });

      it('creates all intermediate directories in order, deepest last', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.createBase(config, 'folder/subfolder/my-base');

        expect(vault.createFolder.mock.calls).toEqual([
          ['folder'],
          ['folder/subfolder'],
        ]);
      });

      it('only creates missing intermediate directories when some already exist', async () => {
        mockExistingPaths(vault, ['folder']);

        await manager.createBase(config, 'folder/subfolder/my-base');

        expect(vault.createFolder).toHaveBeenCalledTimes(1);
        expect(vault.createFolder).toHaveBeenCalledWith('folder/subfolder');
      });

      it('does not call createFolder when the immediate directory already exists', async () => {
        mockExistingPaths(vault, ['folder']);

        await manager.createBase(config, 'folder/my-base');

        expect(vault.createFolder).not.toHaveBeenCalled();
      });

      it('propagates vault.createFolder errors', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);
        vault.createFolder.mockRejectedValue(new Error('Permission denied'));

        await expect(manager.createBase(config, 'folder/my-base')).rejects.toThrow(
          'Permission denied'
        );
      });
    });
  });

  // ── writeBase() ──────────────────────────────────────────────────────────────

  describe('writeBase()', () => {

    // ── Path resolution ────────────────────────────────────────────────────────

    describe('path resolution', () => {
      it('appends .base extension when no extension is provided', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.writeBase(config, 'my-base');

        expect(vault.create).toHaveBeenCalledWith('my-base.base', expect.any(String));
      });

      it('preserves an existing extension and does not append .base', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.writeBase(config, 'my-base.custom');

        expect(vault.create).toHaveBeenCalledWith('my-base.custom', expect.any(String));
      });

      it('appends .base when the path has a dot in a folder name but no file extension', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.writeBase(config, 'folder.name/my-base');

        expect(vault.create).toHaveBeenCalledWith('folder.name/my-base.base', expect.any(String));
      });

      it('uses the resolved path for the existence check', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.writeBase(config, 'my-base');

        expect(vault.getAbstractFileByPath).toHaveBeenCalledWith('my-base.base');
      });

      it('throws if filePath is empty', async () => {
        await expect(manager.writeBase(config, '')).rejects.toThrow(/must not be empty/i);
      });

      it('throws if filePath is whitespace only', async () => {
        await expect(manager.writeBase(config, '   ')).rejects.toThrow(/must not be empty/i);
      });
    });

    // ── File writing ───────────────────────────────────────────────────────────

    describe('file writing', () => {
      it('modifies an existing TFile when one is found at the path', async () => {
        const existingFile = makeTFile();
        vault.getAbstractFileByPath.mockReturnValue(existingFile);

        await manager.writeBase(config, 'my-base');

        expect(vault.modify).toHaveBeenCalledOnce();
        expect(vault.modify).toHaveBeenCalledWith(existingFile, expect.any(String));
        expect(vault.create).not.toHaveBeenCalled();
      });

      it('creates a new file when none exists at the path', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.writeBase(config, 'my-base');

        expect(vault.create).toHaveBeenCalledOnce();
        expect(vault.modify).not.toHaveBeenCalled();
      });

      it('creates a new file when the existing entry is not a TFile', async () => {
        // Simulate a TFolder existing at the path — not a TFile.
        vault.getAbstractFileByPath.mockReturnValue({ children: [] });

        await manager.writeBase(config, 'my-base');

        expect(vault.create).toHaveBeenCalledOnce();
        expect(vault.modify).not.toHaveBeenCalled();
      });

      it('passes serialized config content to vault.modify', async () => {
        const existingFile = makeTFile();
        vault.getAbstractFileByPath.mockReturnValue(existingFile);
        const serialized = { name: 'My Base', views: [] };
        config = makeConfig(serialized);

        await manager.writeBase(config, 'my-base');

        const content = vault.modify.mock.calls[0]?.[1] as string;
        expect(content).toContain(JSON.stringify(serialized));
      });

      it('passes serialized config content to vault.create', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);
        const serialized = { name: 'My Base', views: [] };
        config = makeConfig(serialized);

        await manager.writeBase(config, 'my-base');

        const content = vault.create.mock.calls[0]?.[1] as string;
        expect(content).toContain(JSON.stringify(serialized));
      });

      it('calls config.serialize() exactly once', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.writeBase(config, 'my-base');

        expect(config.serialize).toHaveBeenCalledOnce();
      });

      it('propagates vault.modify errors', async () => {
        vault.getAbstractFileByPath.mockReturnValue(makeTFile());
        vault.modify.mockRejectedValue(new Error('Write protected'));

        await expect(manager.writeBase(config, 'my-base')).rejects.toThrow('Write protected');
      });

      it('propagates vault.create errors', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);
        vault.create.mockRejectedValue(new Error('Disk full'));

        await expect(manager.writeBase(config, 'my-base')).rejects.toThrow('Disk full');
      });
    });

    // ── Directory creation ─────────────────────────────────────────────────────

    describe('directory creation', () => {
      it('does not call createFolder for a root-level file', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.writeBase(config, 'my-base');

        expect(vault.createFolder).not.toHaveBeenCalled();
      });

      it('creates all intermediate directories in order, deepest last', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);

        await manager.writeBase(config, 'folder/subfolder/my-base');

        expect(vault.createFolder.mock.calls).toEqual([
          ['folder'],
          ['folder/subfolder'],
        ]);
      });

      it('only creates missing intermediate directories when some already exist', async () => {
        mockExistingPaths(vault, ['folder']);

        await manager.writeBase(config, 'folder/subfolder/my-base');

        expect(vault.createFolder).toHaveBeenCalledTimes(1);
        expect(vault.createFolder).toHaveBeenCalledWith('folder/subfolder');
      });

      it('does not call createFolder when the immediate directory already exists', async () => {
        mockExistingPaths(vault, ['folder']);

        await manager.writeBase(config, 'folder/my-base');

        expect(vault.createFolder).not.toHaveBeenCalled();
      });

      it('propagates vault.createFolder errors', async () => {
        vault.getAbstractFileByPath.mockReturnValue(null);
        vault.createFolder.mockRejectedValue(new Error('Permission denied'));

        await expect(manager.writeBase(config, 'folder/my-base')).rejects.toThrow(
          'Permission denied'
        );
      });
    });
  });
});