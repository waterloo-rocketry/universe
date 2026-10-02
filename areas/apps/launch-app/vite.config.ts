import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: 'production-content-security-policy',
      transformIndexHtml(html) {
        return command === 'build'
          ? html
              .replace(/script-src 'self' 'unsafe-inline'/, "script-src 'self'")
              .replace(/style-src 'self' 'unsafe-inline'/, "style-src 'self'")
              .replace(
                /connect-src 'self' ws:\/\/127\.0\.0\.1:\*/,
                "connect-src 'none'",
              )
          : html;
      },
    },
  ],
  base: './',
  build: { outDir: 'dist/renderer' },
  server: { host: '127.0.0.1' },
}));
