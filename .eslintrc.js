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
    'eslint-disable no-useless-catch': 'off',
    'eslint-disable semi': 0,
  },
};
