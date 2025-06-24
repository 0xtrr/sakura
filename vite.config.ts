import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: process.env.VITE_HOST || 'localhost',
    port: parseInt(process.env.VITE_PORT || '5173'),
    hmr: {
      host: 'localhost'
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Optimize for production
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for better caching
          vendor: ['react', 'react-dom'],
          nostr: ['nostr-tools'],
          ui: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-toast']
        }
      }
    }
  }
})
