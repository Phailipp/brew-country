import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Brewery logos are trademarks: without approval (VITE_BRAND_LOGOS=true) the
  // files are not even part of the production build.
  const brandLogos = command === 'serve' || env.VITE_BRAND_LOGOS === 'true'
  return {
    plugins: [react()],
    base: './',
    resolve: {
      alias: brandLogos ? [] : [{
        find: /^\.\/beerLogos$/,
        replacement: fileURLToPath(new URL('./src/domain/beerLogos.none.ts', import.meta.url)),
      }],
    },
    build: {
      // MapLibre alone is ~1 MB minified; it is split into its own cacheable chunk
      chunkSizeWarningLimit: 1100,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('maplibre-gl')) return 'maplibre';
            if (id.includes('@firebase') || id.includes('/firebase/')) return 'firebase';
            if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            return undefined;
          },
        },
      },
    },
  }
})
