// src/pages/api/get-video.ts

export const prerender = false;

// Расширенные типы для VK API (оставлены для строгости)
declare global {
  interface RequestInit {
    cf?: Record<string, unknown>;
  }
}

interface VKVideoImage {
  url: string;
  width: number;
  height: number;
}

interface VKVideoFiles {
  hls?: string;
  mp4_240?: string;
  mp4_360?: string;
  mp4_480?: string;
  mp4_720?: string;
  mp4_1080?: string;
  mp4_1440?: string;
  mp4_2160?: string;
}

interface VKVideo {
  title?: string;
  duration?: number;
  width?: number;
  height?: number;
  image?: VKVideoImage[];
  files?: VKVideoFiles;
}

interface VKResponse {
  response?: {
    items?: VKVideo[];
  };
  error?: {
    error_msg?: string;
  };
}

// Разрешённые источники для CORS
const ALLOWED_ORIGINS = [
  "https://new.evroskot.ru",
  "https://evroskot.ru",
  "http://localhost:4321",  // локальная разработка
];

// Универсальное получение токена (Cloudflare Workers / локально)
async function getAccessToken(): Promise<string> {
  try {
    const { env } = await import('cloudflare:workers');
    if (env.VK_ACCESS_TOKEN) return env.VK_ACCESS_TOKEN;
  } catch {}
  if (typeof import.meta !== 'undefined' && import.meta.env?.VK_ACCESS_TOKEN) {
    return import.meta.env.VK_ACCESS_TOKEN;
  }
  throw new Error('VK_ACCESS_TOKEN missing');
}

// Формирование JSON-ответа
function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json;charset=UTF-8",
    "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    ...extraHeaders,
  };
  return new Response(JSON.stringify(data), { status, headers });
}

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const cors = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  // CORS-проверка
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "Origin not allowed" }, 403);
  }

  const ownerId = url.searchParams.get("owner_id");
  const videoId = url.searchParams.get("video_id");
  const accessKey = url.searchParams.get("access_key");

  if (
    !ownerId ||
    !videoId ||
    !accessKey ||
    !/^-?\d+$/.test(ownerId) ||
    !/^\d+$/.test(videoId)
  ) {
    return json({ error: "Invalid parameters" }, 400);
  }

  let ACCESS_TOKEN: string;
  try {
    ACCESS_TOKEN = await getAccessToken();
  } catch {
    return json({ error: "VK_ACCESS_TOKEN missing" }, 500);
  }

  // Edge-кеш (только в Cloudflare Workers)
  const cache = typeof caches !== 'undefined'
    ? (caches as unknown as { default: Cache }).default
    : null;
  const cacheKey = new Request(request.url, request);
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      const response = new Response(cached.body, cached);
      response.headers.set("Access-Control-Allow-Origin", cors);
      return response;
    }
  }

  try {
    const params = new URLSearchParams({
      videos: `${ownerId}_${videoId}_${accessKey}`,
      access_token: ACCESS_TOKEN,
      v: "5.131",
    });

    const vkUrl = `https://api.vk.com/method/video.get?${params.toString()}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(vkUrl, {
      signal: controller.signal,
      cf: { cacheTtl: 86400, cacheEverything: true },
      headers: { "User-Agent": "EvroskotVideoProxy/1.0" },
    });

    clearTimeout(timeout);

    const data: VKResponse = await response.json();

    if (data.error) {
      console.error('VK video.get error:', data.error);
      throw new Error(data.error.error_msg || "VK API error");
    }

    const video = data.response?.items?.[0];
    if (!video) {
      return json({ error: "Video not found" }, 404);
    }

    const files = video.files || {};

    // Собираем источники от лучшего к худшему
    const sources = [
      files.mp4_2160,
      files.mp4_1440,
      files.mp4_1080,
      files.mp4_720,
      files.mp4_480,
      files.mp4_360,
      files.mp4_240,
    ].filter(Boolean);

    const bestMp4 = sources[0] || null;

    const poster =
      video.image
        ?.toSorted((a, b) => b.width - a.width)?.[0]?.url ?? null;

    const result = {
      success: true,
      title: video.title || "",
      duration: video.duration || 0,
      width: video.width || 0,
      height: video.height || 0,
      poster,
      hls: files.hls || null,
      mp4: bestMp4,
      qualities: {
        "2160": files.mp4_2160 || null,
        "1440": files.mp4_1440 || null,
        "1080": files.mp4_1080 || null,
        "720": files.mp4_720 || null,
        "480": files.mp4_480 || null,
        "360": files.mp4_360 || null,
        "240": files.mp4_240 || null,
      },
    };

    const res = json(result, 200, { "Access-Control-Allow-Origin": cors });

    if (cache) {
      await cache.put(cacheKey, res.clone());
    }

    return res;
  } catch (error) {
    console.error('get-video error:', error);
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = error instanceof DOMException && error.name === "AbortError" ? 408 : 500;
    return json({ error: message }, status, { "Access-Control-Allow-Origin": cors });
  }
}