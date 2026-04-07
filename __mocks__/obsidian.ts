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

export class Modal {
  app: unknown;
  titleEl = { setText: vi.fn() };
  contentEl = {
    empty: vi.fn(),
    createEl: vi.fn().mockReturnValue({}),
  };
  constructor(app?: unknown) { this.app = app; }
  open() {}
  close() {}
}

export class SuggestModal<T> {
  app: unknown;
  constructor(app?: unknown) { this.app = app; }
  setPlaceholder(_p: string) { return this; }
  open() {}
  close() {}
}

export class Setting {
  settingEl = { style: {} as Record<string, string> };
  controlEl = { style: {} as Record<string, string> };
  constructor(_containerEl?: unknown) {}
  setName(_name: string) { return this; }
  setDesc(_desc: string) { return this; }
  addText(cb: (text: any) => any) {
    const text = {
      inputEl: { style: {} as Record<string, string> },
      setValue(_v: string) { return this; },
      onChange(_fn: (v: string) => void) { return this; },
      setPlaceholder(_s: string) { return this; },
    };
    cb(text);
    return this;
  }
  addTextArea(cb: (text: any) => any) {
    const text = {
      inputEl: { style: {} as Record<string, string> },
      setValue(_v: string) { return this; },
      onChange(_fn: (v: string) => void) { return this; },
      setPlaceholder(_s: string) { return this; },
    };
    cb(text);
    return this;
  }
  addButton(cb: (btn: any) => any) {
    const btn = {
      setButtonText(_t: string) { return this; },
      setCta() { return this; },
      setWarning() { return this; },
      onClick(_fn: () => void) { return this; },
    };
    cb(btn);
    return this;
  }
}

export const Notice = vi.fn();
