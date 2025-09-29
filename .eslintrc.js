module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'standard-with-typescript'
  ],
  plugins: [
    '@typescript-eslint'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.lint.json'
  },
  env: {
    node: true,
    browser: true,
    jest: true
  },
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/consistent-type-assertions': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off'
  },
  ignorePatterns: [
    'lib/**',
    'node_modules/**',
    '*.js'
  ]
}