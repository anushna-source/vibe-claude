import { fileURLToPath } from 'node:url';

// Resolved from this file, not the working directory, so the plugin finds the
// stylesheet no matter where prettier is invoked from.
const tailwindStylesheet = fileURLToPath(
  new URL('../../apps/web/app/globals.css', import.meta.url),
);

/** @type {import('prettier').Config} */
const config = {
  // Sorts Tailwind classes so class order never shows up in code review.
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet,
  printWidth: 100,
  singleQuote: true,
  semi: true,
  trailingComma: 'all',
  arrowParens: 'always',
  endOfLine: 'lf',
};

export default config;
