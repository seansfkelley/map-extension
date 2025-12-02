import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['**/*.test.ts'],
  transformIgnorePatterns: [],
  transform: {
    '^.+\\.js$': ['ts-jest', { useESM: true }],
  },
};

export default config;
