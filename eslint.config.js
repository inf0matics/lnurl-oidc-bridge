import js from '@eslint/js'
import tseslint from 'typescript-eslint'

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
}

export default tseslint.config(
  {
    ignores: ['.output', 'node_modules', 'test-results', 'playwright-report', 'dist'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: nodeGlobals,
    },
  },
)
