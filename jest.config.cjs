module.exports = {
    testEnvironment: '@jest/environment-jsdom',
    transform: {},
    setupFiles: ['<rootDir>/jest.setup.js'],
    // Mock TSX files since Jest doesn't have TypeScript/React transform configured
    moduleNameMapper: {
        '\\.tsx$': '<rootDir>/__mocks__/emptyModule.js',
    },
};
