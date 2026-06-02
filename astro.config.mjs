import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import favicons from 'astro-favicons';

export default defineConfig({
  site: 'https://evroskot.ru',

  output: 'server',

  adapter: cloudflare(),

  prefetch: {
    defaultStrategy: 'tap',
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
        if (page.includes('/admin') || page.includes('/draft')) {
          return false;
        }
        return true;
      },
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
  ],
});