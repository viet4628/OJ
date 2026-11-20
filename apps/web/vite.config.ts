import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    // Allow tunnel hosts (ngrok/localtunnel/...) so the dev server can be exposed publicly.
    allowedHosts: ['.ngrok-free.dev', '.ngrok.io', '.ngrok.app', '.loca.lt', '.trycloudflare.com'],
  },
});
