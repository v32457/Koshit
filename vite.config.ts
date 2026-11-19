import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      proxy: {
        '/api/gstin-proxy': {
          target: 'https://www.gstinapi.in',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/gstin-proxy/, ''),
          headers: {
            'x-api-key': 'gak_9faefd5f53084ecd96e076ffe7017cd2',
          },
        },
      },
      // HMR is disabled in AI Studio; also disable WS server to prevent port 24678 conflicts.
      hmr: false,
      ws: false,
      watch: null,
    },
  };
});

