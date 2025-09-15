module.exports = {
    root: true,
    env: {
        browser: true,
        es2022: true,
    },
    extends: ['eslint:recommended'],
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
    },
    globals: {
        process: 'readonly',
        Chart: 'readonly',
    },
    ignorePatterns: ['dist/', 'node_modules/'],
    rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^ignored' }],
        'no-console': 'off',
    },
    overrides: [
        {
            files: ['*.config.js', 'postcss.config.js', 'tailwind.config.js', 'vite.config.js'],
            env: {
                node: true,
            },
        },
        {
            files: ['scripts/**/*.js'],
            env: {
                node: true,
            },
        },
    ],
};
