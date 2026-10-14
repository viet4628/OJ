import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { resolve } from 'path';

function adminSubdomain(): Plugin {
  return {
    name: 'admin-subdomain',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const host = req.headers.host || '';
        const url = req.url || '';
        if (host.startsWith('admin.') && (url === '/' || url === '/index.html')) {
          req.url = '/admin.html';
        } else if (url === '/admin' || url === '/admin/' || url.startsWith('/admin?') || url.startsWith('/admin/')) {
          req.url = '/admin.html';
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), adminSubdomain()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
});
