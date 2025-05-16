import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  // Global ignores
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/ios/**',
      '**/android/**',
    ]
  },
  // Base eslint configuration
  eslint.configs.recommended,
  // Global settings for all files
  {
    languageOptions: {
      globals: {
        // Add console and other globals to prevent "not defined" errors
        console: "readonly",
        process: "readonly",
        module: "readonly",
        require: "readonly",
        document: "readonly",
        window: "readonly",
      },
    }
  },
  // TypeScript configurations
  tseslint.configs.recommended[0],
  // Prettier configuration
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      'prettier/prettier': 'warn',
    },
  },
  // TypeScript file-specific config
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      // Disable no-undef rule for TypeScript files as TypeScript handles this
      'no-undef': 'off',
    },
  },
  // JavaScript file-specific config
  {
    files: ['**/*.{js,jsx,cjs,mjs}'],
    rules: {
      // JavaScript-specific rules
    },
  },
];
