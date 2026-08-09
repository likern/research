import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  base: '/assets/',
  publicDir: false,
  resolve: {
    dedupe: [
      'lit',
      'lit-element',
      'lit-html',
      '@lit/reactive-element',
    ],
  },
  build: {
    outDir: resolve(root, 'dist/assets'),
    emptyOutDir: false,
    copyPublicDir: false,
    target: 'es2022',
    sourcemap: true,
    manifest: 'vite-manifest.json',
    cssCodeSplit: false,
    rolldownOptions: {
      input: {
        main: resolve(root, 'src/main.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: asset => asset.name?.endsWith('.css')
          ? 'main.css'
          : '[name]-[hash][extname]',
      },
    },
  },
});
