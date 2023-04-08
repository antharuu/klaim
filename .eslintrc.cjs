module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: 'standard-with-typescript',
  overrides: [
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    tsconfigRootDir: ".",
    project: ['./tsconfig.json'],
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.ts']
      }
    }
  },
  rules: {
    'curly': ['error', 'multi-line'],
    'max-lines-per-function': ['error', { max: 12, skipBlankLines: true, skipComments: true}],
    'max-statements-per-line': ['error', { max: 1 }],
    'max-depth': ['error', 2],
    'complexity': ["error", 3]
  }
}
