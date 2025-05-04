export default {
    transform: {
        '^.+\\.js$': 'babel-jest',
    },
    testEnvironment: 'node',
    moduleFileExtensions: ['js'],
    testMatch: ['**/tests/**/*.test.js'],
    collectCoverageFrom: [
        'mcp-server/src/**/*.js',
        '!**/node_modules/**',
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80,
        },
    },
    setupFilesAfterEnv: ['./tests/setup.js'],
};
