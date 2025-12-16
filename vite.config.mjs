import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

const version = pkg.version;

const appVersion = typeof version === 'string' ? version : '';

export default defineConfig({
    plugins: [react()],
    root: 'frontend',
    base: './',
    publicDir: 'public',
    envDir: '..',  // Relativo a 'root', apunta a la raíz del proyecto
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    server: {
        host: true,
        fs: {
            allow: ['..'],
        },
    },
    define: {
        __APP_VERSION__: JSON.stringify(appVersion),
    },
});

