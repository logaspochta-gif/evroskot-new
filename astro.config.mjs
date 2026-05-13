import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',

  image: {
    service: {
      entrypoint: 'astro/assets/services/noop'
    }
  },

  adapter: cloudflare({
    platformProxy: {
      enabled: false
    }
  })
});