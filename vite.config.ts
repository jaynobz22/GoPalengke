import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Ensure dependencies are installed (deployment env may not run npm install)
const requiredDeps = ['react', 'react-image-crop'];
const missingDep = requiredDeps.find(dep => !existsSync(join(__dirname, 'node_modules', dep)));
if (missingDep) {
  try {
    execSync('npm install', { cwd: __dirname, stdio: 'ignore', timeout: 120000 });
  } catch {}
}

const config: any = {
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
};

// Explicit node_modules path for module resolution (works with both rollup and rolldown)
config.build = {
  rollupOptions: {
    resolve: {
      modules: [join(__dirname, 'node_modules')],
    },
  },
};

// Also set resolve.modules for vite's own resolver
config.resolve.modules = [join(__dirname, 'node_modules')];

// Load PostCSS plugins with absolute paths
try {
  const tailwindcss = require(join(__dirname, 'node_modules', 'tailwindcss'));
  config.css.postcss.plugins.push(tailwindcss({ config: join(__dirname, 'tailwind.config.js') }));
} catch {
  try {
    const tailwindcss = require('tailwindcss');
    config.css.postcss.plugins.push(tailwindcss({ config: join(__dirname, 'tailwind.config.js') }));
  } catch {}
}

try {
  const autoprefixer = require(join(__dirname, 'node_modules', 'autoprefixer'));
  config.css.postcss.plugins.push(autoprefixer());
} catch {
  try {
    const autoprefixer = require('autoprefixer');
    config.css.postcss.plugins.push(autoprefixer());
  } catch {}
}

// Load React plugin with absolute paths
try {
  const react = require(join(__dirname, 'node_modules', '@vitejs', 'plugin-react'));
  config.plugins = [react.default ? react.default() : react()];
} catch {
  try {
    const react = require('@vitejs/plugin-react');
    config.plugins = [react.default ? react.default() : react()];
  } catch {}
}

export default config;
