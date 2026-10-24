import js from '@eslint/js';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {
      // Varias vistas se llaman como su ruta (step-one, quotation, orders).
      'vue/multi-word-component-names': 'off',
      // Como el ESLint 5 de vue-cli: un catch (e) sin usar e no es un error.
      'no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
];
