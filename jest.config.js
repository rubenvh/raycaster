// Default configuration - excludes benchmark tests for CI/regular runs
// Run benchmarks with: npm run test:benchmark
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',  
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Exclude benchmark tests from normal test runs
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "\\.benchmark\\.test\\.ts$"
  ]
};