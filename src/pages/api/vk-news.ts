// src/pages/api/vk-news.ts
import { env } from 'cloudflare:workers';

export const prerender = false;

// ── Разрешённые источники ──
const ALLOWED_ORIGINS = [
  "https://new.evroskot.ru",
  "https://evroskot.ru",
];

// ── Helper ──
function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json;charset=UTF-8",
    "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), { status, headers });
}

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "Origin not allowed" }, 403);
  }

  const ACCESS_TOKEN = env.VK_ACCESS_TOKEN;
  const GROUP_ID = '99133048';
  const API_VERSION = '5.131';
  const POSTS_LIMIT = 12;

  if (!ACCESS_TOKEN) {
    return json({ error: 'Token not configured' }, 500);
  }

  // Edge‑кеш
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set("Access-Control-Allow-Origin", origin || "*");
    return response;
  }

  try {
    const ownerId = -Math.abs(parseInt(GROUP_ID));
    const params = new URLSearchParams({
      owner_id: String(ownerId),
      count: String(POSTS_LIMIT),
      access_token: ACCESS_TOKEN,
      v: API_VERSION,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`https://api.vk.com/method/wall.get?${params}`, {
      signal: controller.signal,
      cf: { cacheTtl: 600, cacheEverything: true },
      headers: { "User-Agent": "EvroskotNewsProxy/1.0" },
    });

    clearTimeout(timeout);

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.error_msg || 'VK API error');
    }

    const posts = data.response?.items;
    if (!posts) {
      return json({ error: 'No posts found' }, 404);
    }

    const response = json(posts, 200, {
      "Access-Control-Allow-Origin": origin || "*",
    });

    // Сохраняем в кеш
    await cache.put(cacheKey, response.clone());

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = error instanceof DOMException && error.name === 'AbortError' ? 408 : 500;
    return json({ error: message }, status, { "Access-Control-Allow-Origin": origin || "*" });
  }
}