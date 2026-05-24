// astro.config.mjs
import { defineConfig } from 'astro/config';
import favicons from 'astro-favicons';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  prefetch: {
    defaultStrategy: 'tap',   // предзагрузка только при касании на тач‑устройствах
  },
  integrations: [
    favicons({
      masterPicture: './public/favicon.svg',
      appName: 'Scanova A/S',
      appShortName: 'Scanova A/S',
      appDescription: 'Поставка племенного крупнорогатого скота из Европы',
      background: '#0a0a0a',
      theme_color: '#10b981',
      display: 'standalone',
      orientation: 'portrait',
    }),
  ],
});