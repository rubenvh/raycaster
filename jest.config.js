module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',  
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  setupFiles: ['<rootDir>/jest.setup.js']
};