// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    fs: {
      allow: ['..']
    }
  },
  assetsInclude: ['**/*.wasm', '**/*.data'],
  optimizeDeps: {
    exclude: ['swisseph-wasm']
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          // Keep WASM and data files in assets folder with original names
          if (assetInfo.name?.endsWith('.wasm') || assetInfo.name?.endsWith('.data')) {
            return 'assets/[name][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  }
})