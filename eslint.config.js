import js from '@eslint/js';
import globals from 'globals';

/** ESLint flat config: recommended rules plus a few that keep modules small and explicit. */
export default [
  { ignores: ['coverage/**', 'docs/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      curly: ['error', 'multi-line'],
      'no-implicit-coercion': ['error', { allow: ['!!'] }],
      'no-param-reassign': ['error', { props: false }],
      'no-shadow': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      complexity: ['warn', 12],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 4],
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['server.js', 'src/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
];
