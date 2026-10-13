/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// GitHub Pages liefert das Spiel unter https://<nutzer>.github.io/persoenlichkeits-dungeon/ aus.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/persoenlichkeits-dungeon/' : '/',
  build: {
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
