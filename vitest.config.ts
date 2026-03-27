import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      'bases': path.resolve(__dirname, 'src/bases'),
      'fileManagement': path.resolve(__dirname, 'src/fileManagement'),
      'primitives': path.resolve(__dirname, 'src/primitives'),
      'utils': path.resolve(__dirname, 'src/utils'),
      'views': path.resolve(__dirname, 'src/views')
    }
  }
});