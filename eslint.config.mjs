import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import jsPlugin from '@eslint/js';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...jsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-fallthrough': ['error', { allowEmptyCase: false }],
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
