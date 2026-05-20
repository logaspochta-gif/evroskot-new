// src/pages/api/get-post.ts
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

  const ownerId = url.searchParams.get('owner_id');
  const postId = url.searchParams.get('post_id');

  if (!ownerId || !postId || !/^-?\d+$/.test(ownerId) || !/^\d+$/.test(postId)) {
    return json({ error: 'Invalid parameters' }, 400);
  }

  const ACCESS_TOKEN = env.VK_ACCESS_TOKEN;
  const API_VERSION = '5.131';

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
    const params = new URLSearchParams({
      posts: `${ownerId}_${postId}`,
      access_token: ACCESS_TOKEN,
      v: API_VERSION,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`https://api.vk.com/method/wall.getById?${params}`, {
      signal: controller.signal,
      cf: { cacheTtl: 600, cacheEverything: true },
      headers: { "User-Agent": "EvroskotPostProxy/1.0" },
    });

    clearTimeout(timeout);

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.error_msg || 'VK API error');
    }

    const post = data.response?.[0];
    if (!post) {
      return json({ error: 'Post not found' }, 404);
    }

    const response = json(post, 200, {
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