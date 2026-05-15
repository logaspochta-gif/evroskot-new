// src/pages/api/get-post.ts
import { env } from 'cloudflare:workers';

export const prerender = false;

export async function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const ownerId = url.searchParams.get('owner_id');
  const postId = url.searchParams.get('post_id');

  if (!ownerId || !postId) {
    return new Response(JSON.stringify({ error: 'owner_id and post_id required' }), {
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
    const params = new URLSearchParams({
      posts: `${ownerId}_${postId}`,
      access_token: ACCESS_TOKEN,
      v: API_VERSION,
    });
    const res = await fetch(`https://api.vk.com/method/wall.getById?${params}`);
    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.error_msg || 'VK API error');
    }

    const post = data.response?.[0];
    if (!post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(post), {
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