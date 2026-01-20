import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'html2pdf.js': 'html2pdf.js/dist/html2pdf.bundle.min.js'
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['html2pdf.js'],
  },
  server: {
    headers: {
      // 'Cross-Origin-Embedder-Policy': 'credentialless'
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Content-Security-Policy':
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src https://www.youtube.com https://player.vimeo.com https://vimeo.com;",
    },
    cors: true,
    hmr: {
      clientPort: 5173,
    },
  },
  base: '/',
});
