import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, resolve(__dirname, '..'), '');

  return {
    root: resolve(__dirname),
    publicDir: resolve(__dirname, 'public'),
    define: {
      '__UMAMI_WEBSITE_ID__': JSON.stringify(env.VITE_LANDING_UMAMI_WEBSITE_ID || ''),
    },
    build: {
      outDir: 'dist',
      emptyDirBeforeWrite: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
        },
      },
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          'utm-generator': resolve(__dirname, 'utm-generator.html'),
          'story': resolve(__dirname, 'story.html'),
        },
      },
    },
  };
});
