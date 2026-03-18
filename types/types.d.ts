// types.d.ts
import { ProgrammaticBasesAPI } from '../src/api';


declare global {
  interface Window {
    programmaticBases?: ProgrammaticBasesAPI;
  }
}

declare module "obsidian" {
  interface Workspace {
    //-- EVENTS
    trigger(name: "programmatic-bases:loaded"): void;
    trigger(name: "programmatic-bases:loadFailed", error: Error): void;
    trigger(name: "programmatic-bases:unloaded"): void;
  }

  interface App {
    plugins: {
      plugins: Record<string, unknown>;
    };
  }
}