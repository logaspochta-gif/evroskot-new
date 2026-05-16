// src/pages/api/get-video.ts
import { env } from 'cloudflare:workers';

export const prerender = false;

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const ownerId = url.searchParams.get('owner_id');
  const videoId = url.searchParams.get('video_id');
  const accessKey = url.searchParams.get('access_key');

  if (!ownerId || !videoId || !accessKey) {
    return new Response(JSON.stringify({ error: 'owner_id, video_id, access_key required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ACCESS_TOKEN = env.VK_ACCESS_TOKEN;
  const API_VERSION = '5.131';

  if (!ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: 'Token not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Важно: убираем User-Agent, чтобы VK отдал прямые ссылки
    const params = new URLSearchParams({
      videos: `${ownerId}_${videoId}_${accessKey}`,
      access_token: ACCESS_TOKEN,
      v: API_VERSION,
    });
    const res = await fetch(`https://api.vk.com/method/video.get?${params.toString()}`, {
      headers: { 'User-Agent': '' },
    });
    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.error_msg || 'VK API error');
    }

    const video = data.response?.items?.[0];
    if (!video) {
      return new Response(JSON.stringify({ error: 'Video not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(video), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}