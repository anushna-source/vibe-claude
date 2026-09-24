import js from '@eslint/js';
import nextPlugin from 'eslint-config-next';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * eslint-config-next ships globs relative to the ESLint config file. That file
 * lives at the repo root, so each glob is re-rooted at the web app's directory.
 */
function nextConfigFor(appDir) {
  const prefix = `${appDir.replace(/\/+$/, '')}/`;

  const scoped = nextPlugin.map((config) => {
    if (config.files) {
      return { ...config, files: config.files.map((glob) => `${prefix}${glob}`) };
    }
    if (config.ignores) {
      return { ...config, ignores: config.ignores.map((glob) => `${prefix}${glob}`) };
    }
    return config;
  });

  return [
    ...scoped,
    {
      // Pinning the version skips eslint-plugin-react's auto-detection, which
      // shells out to resolve a package and is slow on every run.
      files: [`${prefix}**/*.{js,jsx,ts,tsx}`],
      settings: {
        react: { version: '19.3.0' },
        next: { rootDir: appDir },
      },
      rules: {
        // App Router only: there is no pages/ directory for this rule to check.
        '@next/next/no-html-link-for-pages': 'off',
      },
    },
  ];
}

/**
 * @param {{ nextApps?: string[] }} options
 *   nextApps: directories holding a Next.js app, relative to the repo root.
 */
export function createEslintConfig({ nextApps = [] } = {}) {
  return tseslint.config(
    {
      ignores: [
        '**/dist/**',
        '**/node_modules/**',
        '**/coverage/**',
        '**/.next/**',
        '**/*.tsbuildinfo',
      ],
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
      // Plain JS in this repo is Node config files (eslint, prettier, postcss).
      files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
      languageOptions: {
        globals: {
          URL: 'readonly',
          console: 'readonly',
          process: 'readonly',
          __dirname: 'readonly',
        },
      },
    },
    ...nextApps.flatMap(nextConfigFor),
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        // AGENTS.md: no `any` without an inline comment explaining why.
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
        ],
        'no-console': 'error',
        eqeqeq: ['error', 'always', { null: 'ignore' }],
        'object-shorthand': 'error',
        'prefer-const': 'error',
      },
    },
    {
      // Bootstrap files run before the logger exists.
      files: ['**/src/server.ts'],
      rules: { 'no-console': 'off' },
    },
    // Must stay last so it can switch off rules that fight Prettier.
    prettier,
  );
}

export default createEslintConfig();
