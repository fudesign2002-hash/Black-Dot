import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/pusher-auth': {
            target: 'http://localhost:3002',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/pusher-auth/, '/pusher/auth')
          },
          '/api/umami-stats': {
            target: 'http://localhost:3002',
            changeOrigin: true
          }
        }
      },
      plugins: [react(),tailwindcss()],
      define: {
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
