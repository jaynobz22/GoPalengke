import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const config: any = {
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react', 'leaflet', 'react-leaflet'],
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  build: {
    // Ensure rolldown resolves modules from the project's node_modules
    rollupOptions: {
      output: {},
    },
  },
};

// Vite v8 with rolldown needs explicit node_modules path
try {
  config.build.rolldownOptions = {
    resolve: {
      modules: [join(__dirname, 'node_modules')],
    },
  };
  config.resolve.modules = [join(__dirname, 'node_modules')];
} catch {}

// Load PostCSS plugins with absolute paths so they work even when npx runs from a different directory
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
