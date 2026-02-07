module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  testMatch: [
    '**/__tests__/unit/**/*.test.js',
    '**/__tests__/integration/**/*.test.js',
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/main/preload.js',
    '!src/renderer/**',
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
