/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    // Map @/ aliases to src/ for tests (mirrors tsconfig paths).
    // IMPORTANT: the more-specific '@/models' entry must come first so that
    // the index module (which has a mongoose.connect side-effect) is replaced
    // by our clean mock, while all other @/ imports resolve to src/ as normal.
    moduleNameMapper: {
        '^@/models$': '<rootDir>/src/__tests__/mocks/models.ts',
        '^@/(.*)$': '<rootDir>/src/$1',
    },
    // Only pick up files inside __tests__ directories
    testMatch: ['**/__tests__/**/*.test.ts'],
    // ts-jest config: skip lib check and match the tsconfig settings
    transform: {
        '^.+\\.tsx?$': ['ts-jest', {
            tsconfig: {
                skipLibCheck: true,
                strict: false,
                moduleResolution: 'node',
                emitDecoratorMetadata: true,
                experimentalDecorators: true,
                baseUrl: 'src',
                paths: { '@/*': ['*'] },
            },
        }],
    },
    // Each test file gets a fresh module registry to avoid model re-registration errors
    resetModules: false,
    // Increase timeout for DB operations
    testTimeout: 30000,
    // Verbose output per test
    verbose: true,
}
