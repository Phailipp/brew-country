import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * Content Security Policy for production builds (dev needs inline scripts for
 * hot reload). GitHub Pages cannot send headers, so it ships as a meta tag;
 * frame-ancestors is not supported there (needs a real header / other host).
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  // React inline style attributes and MapLibre's dynamic styles
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  // Only the exact Google endpoints (a wildcard would allow any Cloud Storage bucket)
  "connect-src 'self' https://tiles.openfreemap.org https://s3.amazonaws.com/elevation-tiles-prod/ https://overpass-api.de https://overpass.kumi.systems https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function appVersion(): string {
  const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
  let sha = process.env.GITHUB_SHA?.slice(0, 7) ?? ''
  if (!sha) {
    try { sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { sha = 'dev' }
  }
  return `${version}+${sha}`
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Brewery logos are trademarks: without approval (VITE_BRAND_LOGOS=true) the
  // files are not even part of the production build.
  const brandLogos = command === 'serve' || env.VITE_BRAND_LOGOS === 'true'
  return {
    plugins: [
      react(),
      {
        name: 'brew-country-csp',
        apply: 'build',
        transformIndexHtml: (html: string) =>
          html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
      },
    ],
    base: './',
    define: { __APP_VERSION__: JSON.stringify(appVersion()) },
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
