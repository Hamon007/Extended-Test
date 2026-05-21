import { defineConfig }     from 'vite';
import react                from '@vitejs/plugin-react';
import { VitePWA }          from 'vite-plugin-pwa';
import { resolve }          from 'path';

const base = process.env.VITE_BASE ?? '/';

export default defineConfig({
  base,

  plugins: [
    react(),

    VitePWA({
      strategies:   'generateSW',
      registerType: 'autoUpdate',

      includeAssets: [
        'icon-192.png',
        'icon-512.png',
        'icon-maskable-512.png',
      ],

      manifest: {
        name:             'Codex Immortalis',
        short_name:       'Immortalis',
        description:      'Guild-zentriertes Social-Gacha-RPG',
        theme_color:      '#0D0B0F',
        background_color: '#050307',
        display:          'standalone',
        orientation:      'portrait',
        scope:            base,
        start_url:        base,
        lang:             'de',
        icons: [
          {
            src:     'icon-192.png',
            sizes:   '192x192',
            type:    'image/png',
            purpose: 'any',
          },
          {
            src:     'icon-512.png',
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'any',
          },
          {
            src:     'icon-maskable-512.png',
            sizes:   '512x512',
            type:    'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name:      'Beschwören',
            short_name:'Beschwören',
            url:       `${base}?tab=gacha`,
            icons:     [{ src: 'icon-192.png', sizes: '192x192' }],
          },
          {
            name:      'Kampf',
            short_name:'Kampf',
            url:       `${base}?tab=battle`,
            icons:     [{ src: 'icon-192.png', sizes: '192x192' }],
          },
        ],
      },

      workbox: {
        navigateFallback:         `${base}index.html`,
        navigateFallbackDenylist: [/^\/api\//],

        globPatterns: ['**/*.{js,css,html}'],

        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MiB

        runtimeCaching: [
          {
            urlPattern: /\/assets\/cards\/.+\.png$/,
            handler:    'StaleWhileRevalidate',
            options: {
              cacheName: 'card-images',
              expiration: {
                maxEntries:    30,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/assets\/enemies\/.+\.png$/,
            handler:    'CacheFirst',
            options: {
              cacheName: 'enemy-images',
              expiration: {
                maxEntries:    20,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler:    'StaleWhileRevalidate',
            options:    { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler:    'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries:    20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      devOptions: {
        enabled:          false,
        suppressWarnings: true,
        type:             'module',
      },
    }),
  ],

  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
});
