// src/pages/api/vk-news.ts

export const prerender = false;

const ALLOWED_ORIGINS = [
  'https://new.evroskot.ru',
  'https://evroskot.ru',
  'http://localhost:4321',  // локальная разработка Astro
];

export interface VkPost {
  id: number;
  date: number;
  text?: string;
  attachments?: any[];
}

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), { status, headers });
}

// Универсальное получение токена VK (Cloudflare Workers / локально)
async function getAccessToken(): Promise<string> {
  try {
    const { env } = await import('cloudflare:workers');
    if (env.VK_ACCESS_TOKEN) return env.VK_ACCESS_TOKEN;
  } catch {}
  if (typeof import.meta !== 'undefined' && import.meta.env?.VK_ACCESS_TOKEN) {
    return import.meta.env.VK_ACCESS_TOKEN;
  }
  throw new Error('Token not configured');
}

// Основная функция для прямого вызова из других модулей (например, news-pages.astro)
export async function fetchNewsFromVk(): Promise<VkPost[]> {
  const ACCESS_TOKEN = await getAccessToken();

  const GROUP_ID = '99133048';
  const API_VERSION = '5.131';
  const POSTS_LIMIT = 30;

  const ownerId = -Math.abs(parseInt(GROUP_ID));
  const params = new URLSearchParams({
    owner_id: String(ownerId),
    count: String(POSTS_LIMIT),
    access_token: ACCESS_TOKEN,
    v: API_VERSION,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(`https://api.vk.com/method/wall.get?${params}`, {
      signal: controller.signal,
      cf: { cacheTtl: 600, cacheEverything: true },
      headers: { 'User-Agent': 'EvroskotNewsProxy/1.0' },
    });
    clearTimeout(timeout);

    const data = await res.json();
    if (data.error) {
      console.error('VK wall.get error:', data.error);
      throw new Error(data.error.error_msg || 'VK API error');
    }

    const posts = data.response?.items;
    if (!posts) throw new Error('No posts found');
    return posts;
  } catch (error) {
    clearTimeout(timeout);
    console.error('fetchNewsFromVk error:', error);
    throw error;
  }
}

// HTTP-обработчик для маршрута /api/vk-news
export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const cors = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  try {
    const posts = await fetchNewsFromVk();
    const response = json(posts, 200, { 'Access-Control-Allow-Origin': cors });

    // Edge-кеш (только в Cloudflare Workers)
    if (typeof caches !== 'undefined') {
      const cache = (caches as unknown as { default: Cache }).default;
      const cacheKey = new Request(request.url, request);
      await cache.put(cacheKey, response.clone());
    }

    return response;
  } catch (error) {
    console.error('GET /api/vk-news error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = error instanceof DOMException && error.name === 'AbortError' ? 408 : 500;
    return json({ error: message }, status, { 'Access-Control-Allow-Origin': cors });
  }
}