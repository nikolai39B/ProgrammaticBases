import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      'obsidian': path.resolve(__dirname, '__mocks__/obsidian.ts'),
      'bases': path.resolve(__dirname, 'src/bases'),
      'commands': path.resolve(__dirname, 'src/commands'),
      'fileManagement': path.resolve(__dirname, 'src/fileManagement'),
      'main': path.resolve(__dirname, 'src/main'),
      'primitives': path.resolve(__dirname, 'src/primitives'),
      'settings': path.resolve(__dirname, 'src/settings'),
      'utils': path.resolve(__dirname, 'src/utils'),
      'views': path.resolve(__dirname, 'src/views'),
    }
  }
});