import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/dashboard/',
  esbuild: {
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
    jsxInject: `import { h, Fragment } from 'preact'`,
  },
  server: {
    proxy: {
      '/v1': 'http://localhost:3456',
      '/api': 'http://localhost:3456',
      '/pair': 'http://localhost:3456',
    },
  },
  build: {
    outDir: resolve(__dirname, '../dist/dashboard'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      'react': 'preact/compat',
      'react-dom': 'preact/compat',
    },
  },
});
