// src/pages/api/get-video.ts

import { env } from "cloudflare:workers";

export const prerender = false;

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);

  const ownerId = url.searchParams.get("owner_id");
  const videoId = url.searchParams.get("video_id");
  const accessKey = url.searchParams.get("access_key");

  if (!ownerId || !videoId || !accessKey) {
    return json(
      {
        error: "owner_id, video_id, access_key required",
      },
      400,
    );
  }

  const ACCESS_TOKEN = env.VK_ACCESS_TOKEN;

  if (!ACCESS_TOKEN) {
    return json(
      {
        error: "VK_ACCESS_TOKEN missing",
      },
      500,
    );
  }

  try {
    const params = new URLSearchParams({
      videos: `${ownerId}_${videoId}_${accessKey}`,
      access_token: ACCESS_TOKEN,
      v: "5.131",
    });

    const response = await fetch(
      `https://api.vk.com/method/video.get?${params.toString()}`,
      {
        headers: {
          "User-Agent": "",
        },
      },
    );

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.error_msg || "VK API error");
    }

    const video = data.response?.items?.[0];

    if (!video) {
      return json(
        {
          error: "Video not found",
        },
        404,
      );
    }

    const files = video.files || {};

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

    // Явно указываем any для параметров сортировки
    const poster =
      video.image?.sort((a: any, b: any) => b.width - a.width)?.[0]?.url || null;

    return json({
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
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Internal server error";

    return json(
      {
        error: message,
      },
      500,
    );
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",

      // CACHE
      "Cache-Control":
        "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}