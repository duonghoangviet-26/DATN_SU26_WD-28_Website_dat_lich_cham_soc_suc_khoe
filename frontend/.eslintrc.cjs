module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  ignorePatterns: ['dist', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  plugins: ['react-refresh'],
  settings: { react: { version: 'detect' } },
  rules: {
    // React Refresh — cảnh báo khi export không phải component (dev tool)
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // Tắt các rule quá strict cho đồ án sinh viên
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-empty-object-type': 'off',
  },
}
