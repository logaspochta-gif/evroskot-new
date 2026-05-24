// src/pages/api/get-post.ts

export const prerender = false;

// Разрешённые источники запросов (CORS)
const ALLOWED_ORIGINS = [
  'https://new.evroskot.ru',
  'https://evroskot.ru',
  'http://localhost:4321',   // для локальной разработки
];

// Универсальное получение токена VK (Cloudflare Workers / локальная среда)
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

// Формирование JSON‑ответа с заголовками
function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  const headers = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), { status, headers });
}

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const cors = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  // Проверка Origin (опционально, но оставлено для безопасности)
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  const ownerId = url.searchParams.get('owner_id');
  const postId = url.searchParams.get('post_id');
  if (!ownerId || !postId || !/^-?\d+$/.test(ownerId) || !/^\d+$/.test(postId)) {
    return json({ error: 'Invalid parameters' }, 400);
  }

  let ACCESS_TOKEN: string;
  try {
    ACCESS_TOKEN = await getAccessToken();
  } catch {
    return json({ error: 'Token not configured' }, 500);
  }

  // Edge‑кеш (работает только в Cloudflare Workers)
  const cache = typeof caches !== 'undefined'
    ? (caches as unknown as { default: Cache }).default
    : null;
  const cacheKey = new Request(request.url, request);
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const response = new Response(cached.body, cached);
      response.headers.set('Access-Control-Allow-Origin', cors);
      return response;
    }
  }

  try {
    const vkUrl = `https://api.vk.com/method/wall.getById?posts=${ownerId}_${postId}&access_token=${ACCESS_TOKEN}&v=5.131`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(vkUrl, {
      signal: controller.signal,
      cf: { cacheTtl: 3600, cacheEverything: true },
      headers: { 'User-Agent': 'EvroskotPostProxy/1.0' },
    });
    clearTimeout(timeout);

    const data = await res.json();
    if (data.error) {
      console.error('VK API error:', data.error);
      throw new Error(data.error.error_msg || 'VK API error');
    }

    const post = data.response?.[0] ?? null;
    if (!post) return json({ error: 'Post not found' }, 404);

    const response = json(post, 200, { 'Access-Control-Allow-Origin': cors });

    if (cache) {
      await cache.put(cacheKey, response.clone());
    }

    return response;
  } catch (error) {
    console.error('get-post error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = error instanceof DOMException && error.name === 'AbortError' ? 408 : 500;
    return json({ error: message }, status, { 'Access-Control-Allow-Origin': cors });
  }
}