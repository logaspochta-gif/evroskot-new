// src/pages/api/vk-news.ts
import { getVkToken } from '../../utils/getVkToken';

export const prerender = false;

// ── Разрешённые источники (для HTTP‑запросов, если они ещё будут) ──
const ALLOWED_ORIGINS = [
  'https://new.evroskot.ru',
  'https://evroskot.ru',
];

// ── Типы ──
interface VkPhotoSize {
  type: string;
  url: string;
  width?: number;
  height?: number;
}

interface VkAttachment {
  type?: string;
  photo?: { sizes?: VkPhotoSize[] };
  video?: {
    image?: { url: string; width?: number; height?: number }[];
    title?: string;
  };
  doc?: {
    title?: string;
    preview?: { photo?: { sizes?: VkPhotoSize[] } };
  };
  link?: {
    title?: string;
    photo?: { sizes?: VkPhotoSize[] };
  };
}

export interface VkPost {
  id: number;
  date: number;
  text?: string;
  attachments?: VkAttachment[];
}

interface VkWallResponse {
  response?: { items: VkPost[] };
  error?: { error_msg?: string };
}

// ── Helper для JSON‑ответа (используется только в HTTP‑обработчике) ──
function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), { status, headers });
}

// ── Основная функция, которую можно вызывать напрямую без HTTP ──
export async function fetchNewsFromVk(): Promise<VkPost[]> {
  let ACCESS_TOKEN: string;
  try {
    ACCESS_TOKEN = getVkToken();
  } catch {
    throw new Error('Token not configured');
  }

  const GROUP_ID = '99133048';
  const API_VERSION = '5.131';
  const POSTS_LIMIT = 12;

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
      // Cloudflare-специфичные параметры кеширования на транспортном уровне
      cf: { cacheTtl: 600, cacheEverything: true },
      headers: { 'User-Agent': 'EvroskotNewsProxy/1.0' },
    });
    clearTimeout(timeout);

    const data: VkWallResponse = await res.json();
    if (data.error) {
      throw new Error(data.error.error_msg || 'VK API error');
    }

    const posts = data.response?.items;
    if (!posts) {
      throw new Error('No posts found');
    }
    return posts;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// ── HTTP‑обработчик для маршрута /api/vk-news (можно оставить или удалить) ──
export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'Origin not allowed' }, 403);
  }

  // Используем ту же функцию
  try {
    const posts = await fetchNewsFromVk();
    // Добавляем CORS-заголовок для успешного ответа
    const response = json(posts, 200, {
      'Access-Control-Allow-Origin': origin || '*',
    });

    // Кеширование (caches.default доступен только в Workers, в dev можно пропустить)
    if (typeof caches !== 'undefined') {
      const cache = (caches as unknown as { default: Cache }).default;
      const cacheKey = new Request(request.url, request);
      await cache.put(cacheKey, response.clone());
    }

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = error instanceof DOMException && error.name === 'AbortError' ? 408 : 500;
    return json({ error: message }, status, { 'Access-Control-Allow-Origin': origin || '*' });
  }
}