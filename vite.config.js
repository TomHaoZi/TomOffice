import { defineConfig } from 'vite';
export default defineConfig({ base: './', server: { host: '127.0.0.1', strictPort: true }, build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 1600 } });
