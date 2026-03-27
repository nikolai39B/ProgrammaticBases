// __mocks__/obsidian.ts

import { vi } from 'vitest';

export class TFile {
  path: string = '';
  name: string = '';
  basename: string = '';
  extension: string = '';
  stat = { ctime: 0, mtime: 0, size: 0 };
  parent = null;
}

export class TFolder {
  path: string = '';
  name: string = '';
  children: (TFile | TFolder)[] = [];
  parent = null;
  isRoot() { return false; }
}

export class TAbstractFile {
  path: string = '';
  name: string = '';
  parent = null;
}

export const normalizePath = vi.fn((path: string) => path);

export class App {}

export class Plugin {}

export class PluginSettingTab {}

export class Modal {}

export class Notice {}