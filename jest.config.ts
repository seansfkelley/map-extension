import type { Config } from 'jest';

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  testMatch: ['**/*.test.ts'],
  transformIgnorePatterns: [],
  transform: {
    '^.+\\.js$': ['ts-jest', { useESM: true }],
  },
} satisfies Config;
