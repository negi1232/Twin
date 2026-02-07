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
      statements: 75,
      branches: 70,
      functions: 80,
      lines: 75,
    },
  },
};
