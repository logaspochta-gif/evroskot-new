// astro.config.mjs
import { defineConfig } from 'astro/config';
import favicons from 'astro-favicons';
import cloudflare from '@astrojs/cloudflare'; // если используете Cloudflare

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [
    favicons({
      masterPicture: './src/favicon.svg', // путь к вашему исходному SVG
      appName: 'Scanova A/S',
      appShortName: 'Scanova A/S',
      appDescription: 'Поставка племенного крупнорогатого скота из Европы',
      background: '#0a0a0a',
      theme_color: '#10b981',
      display: 'standalone',
      orientation: 'portrait',
      // ... другие опции при необходимости
    }),
  ],
});