module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: [
    '**/__tests__/unit/**/*.test.js',
    '**/__tests__/integration/**/*.test.js',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main/preload.ts',
    '!src/renderer/**',
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
