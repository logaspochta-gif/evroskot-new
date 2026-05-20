// src/pages/api/get-video.ts
import { env } from "cloudflare:workers";

export const prerender = false;

// ── Объявления, специфичные для Cloudflare Workers ──
declare global {
  // Поле cf для запросов fetch
  interface RequestInit {
    cf?: Record<string, unknown>;
  }
}

// ── Типизация ответа VK API ──
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

// ── Разрешённые источники (защита от hot‑linking) ──
const ALLOWED_ORIGINS = [
  "https://new.evroskot.ru",
  "https://evroskot.ru",
];

// ── Helper для формирования JSON‑ответа ──
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

  // ── CORS‑защита ──
  const origin = request.headers.get("Origin");
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: "Origin not allowed" }, 403);
  }

  const ownerId = url.searchParams.get("owner_id");
  const videoId = url.searchParams.get("video_id");
  const accessKey = url.searchParams.get("access_key");

  // ── Валидация входных данных ──
  if (
    !ownerId ||
    !videoId ||
    !accessKey ||
    !/^-?\d+$/.test(ownerId) ||
    !/^\d+$/.test(videoId)
  ) {
    return json({ error: "Invalid parameters" }, 400);
  }

  const ACCESS_TOKEN = env.VK_ACCESS_TOKEN;
  if (!ACCESS_TOKEN) {
    return json({ error: "VK_ACCESS_TOKEN missing" }, 500);
  }

  // ── Edge‑кеш (caches.default) ──
  // В среде Workers глобальный объект `caches` имеет свойство `default`, но типы этого не знают.
  // Используем приведение для доступа.
  const cache = (caches as unknown as { default: Cache }).default;
  const cacheKey = new Request(request.url, request);
  const cached = await cache.match(cacheKey);
  if (cached) {
    // Убедимся, что CORS‑заголовки корректны при выдаче из кеша
    const response = new Response(cached.body, cached);
    response.headers.set("Access-Control-Allow-Origin", origin || "*");
    return response;
  }

  try {
    const params = new URLSearchParams({
      videos: `${ownerId}_${videoId}_${accessKey}`,
      access_token: ACCESS_TOKEN,
      v: "5.131",
    });

    const vkUrl = `https://api.vk.com/method/video.get?${params.toString()}`;

    // ── AbortController для предотвращения зависаний ──
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(vkUrl, {
      signal: controller.signal,
      // Cloudflare‑специфичные параметры кеширования
      cf: {
        cacheTtl: 86400,       // 1 сутки
        cacheEverything: true,
      },
      headers: {
        "User-Agent": "EvroskotVideoProxy/1.0",
      },
    });

    clearTimeout(timeout);

    const data: VKResponse = await response.json();

    if (data.error) {
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

    // Без мутации исходного массива
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

    const res = json(result, 200, {
      "Access-Control-Allow-Origin": origin || "*",
    });

    // Кладём ответ в Edge‑кеш на сутки
    await cache.put(cacheKey, res.clone());

    return res;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return json(
      { error: message },
      error instanceof DOMException && error.name === "AbortError" ? 408 : 500,
      { "Access-Control-Allow-Origin": origin || "*" },
    );
  }
}