module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: ['standard'],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    semi: 0,
    'eslint-disable no-useless-catch': 'off',
    'eslint-disable space-before-function-paren': 0,
    'eslint-disable comma-dangle': 0,
    'eslint-disable space-before-function-paren': 0,
  },
};
