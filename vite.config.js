import { defineConfig } from 'vite';

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
