// astro.config.mjs
import { defineConfig } from 'astro/config';
import favicons from 'astro-favicons';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://evroskot.ru',        // обязательно для sitemap и канонических URL
  output: 'server',
  adapter: cloudflare({
    imageService: 'cloudflare',       // используем Cloudflare Images для оптимизации
  }),
  prefetch: {
    defaultStrategy: 'tap',           // предзагрузка при касании на тач‑устройствах
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
    sitemap({
      filter: (page) => {
        // Исключаем из sitemap служебные или черновые страницы
        if (page.includes('/admin') || page.includes('/draft')) return false;
        return true;
      },
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
});