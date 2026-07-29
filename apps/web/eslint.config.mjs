import { defineConfig, globalIgnores } from 'eslint/config'
import { tanstackConfig } from '@tanstack/eslint-config'
import convexPlugin from '@convex-dev/eslint-plugin'

export default defineConfig([
  ...tanstackConfig,
  ...convexPlugin.configs.recommended,
  globalIgnores(['convex/_generated', '.output', '.nitro']),
  {
    // Vendored shadcn/ui + AI Elements registry code. Kept close to upstream
    // so future `npx ai-elements add --overwrite` pulls stay reviewable.
    files: ['src/components/ui/**', 'src/components/ai-elements/**'],
    rules: {
      'import/order': 'off',
      'import/consistent-type-specifier-style': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
])
