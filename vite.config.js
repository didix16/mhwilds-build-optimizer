import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative URLs support GitHub Pages project subdirectories and custom domains.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules[\\/]primereact/.test(id)) return 'ui';
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
        },
      },
    },
  },
});
