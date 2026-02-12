module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: [
    '**/__tests__/unit/**/*.test.ts',
    '**/__tests__/integration/**/*.test.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main/preload.ts',
    '!src/renderer/scripts/app.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    global: {
      statements: 95,
      branches: 85,
      functions: 85,
      lines: 95,
    },
  },
};
