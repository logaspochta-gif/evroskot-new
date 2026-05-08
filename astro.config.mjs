// astro.config.mjs
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Включаем серверный рендеринг — страницы будут генерироваться по запросу,
  // а не на этапе сборки. Это необходимо для работы с Worker Functions
  // и выполнения динамических fetch (например, к /api/vk-news).
  output: 'server',

  // Подключаем адаптер Cloudflare, который настраивает сборку под
  // Cloudflare Workers/Pages Functions.
  adapter: cloudflare(),
});