import { createRequire } from 'node:module';
import { fileURLToPath, URL } from 'node:url';

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
};

try {
  const react = require('@vitejs/plugin-react');
  config.plugins = [react.default()];
} catch {
  // Vite plugin not available in this environment — build tool uses its own React support
}

export default config;
