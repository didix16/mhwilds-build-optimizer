import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({ base: './', plugins: [react(), tailwindcss()], build: { target: 'es2022',rollupOptions:{output:{manualChunks(id){if(id.includes('node_modules/primereact')||id.includes('node_modules\\primereact'))return 'ui';if(/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id))return 'react';}}} } });
