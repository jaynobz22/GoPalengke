import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Ensure dependencies are installed (deployment env may not run npm install)
if (!existsSync(join(__dirname, 'node_modules', 'react'))) {
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

// Vite v8 with rolldown: explicit node_modules path for module resolution
try {
  config.build = {
    rolldownOptions: {
      resolve: {
        modules: [join(__dirname, 'node_modules')],
      },
    },
  };
} catch {}

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
