import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const plugins = {};

try {
  const tailwindcss = require(join(__dirname, 'node_modules', 'tailwindcss'));
  plugins.tailwindcss = tailwindcss;
} catch {
  try {
    plugins.tailwindcss = require('tailwindcss');
  } catch {}
}

try {
  const autoprefixer = require(join(__dirname, 'node_modules', 'autoprefixer'));
  plugins.autoprefixer = autoprefixer;
} catch {
  try {
    plugins.autoprefixer = require('autoprefixer');
  } catch {}
}

export default { plugins };
