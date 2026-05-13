import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',

  adapter: cloudflare({
    imageService: 'passthrough', // ИСПРАВЛЕНИЕ: принудительно отключает генерацию биндинга картинок ASSETS
    platformProxy: {
      enabled: false
    }
  })
});
