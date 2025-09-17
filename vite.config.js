import { defineConfig } from 'vite';
import pkg from './package.json' assert { type: 'json' };

const version = pkg.version;

const appVersion = typeof version === 'string' ? version : '';

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
    define: {
        __APP_VERSION__: JSON.stringify(appVersion),
    },
});
