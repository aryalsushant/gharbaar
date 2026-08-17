import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest rather than generateSW because the service worker has to
      // carry our own push and notificationclick handlers. A generated worker
      // only knows how to cache.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
      },
      manifest: {
        name: 'Gharbaar',
        short_name: 'Gharbaar',
        description: 'Who paid, who cooks, who owes.',
        start_url: '/',
        display: 'standalone',
        background_color: '#04101a',
        theme_color: '#04101a',
        // SVG only for now. Android and desktop install fine from this, but
        // iOS wants a PNG apple-touch-icon and will screenshot the page
        // instead if it does not find one, so raster versions are still owed
        // before the iPhones add this to their home screens.
        icons: [{ src: '/mark.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173 },
});
