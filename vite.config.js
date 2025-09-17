import { defineConfig } from 'vite';
import pkg from './package.json' assert { type: 'json' };

const version = pkg.version;

export default defineConfig({
    root: 'frontend',
    base: './',
    publicDir: 'public',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
    server: {
        fs: {
            allow: ['..'],
        },
    },
});
