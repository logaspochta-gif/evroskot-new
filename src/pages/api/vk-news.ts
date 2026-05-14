// src/pages/api/vk-news.ts
export const prerender = false;

export async function GET({ locals }: { locals: any }) {
  const env = locals.runtime?.env || {};
  const ACCESS_TOKEN = env.VK_ACCESS_TOKEN;
  const GROUP_ID = '99133048';
  const API_VERSION = '5.131';
  const POSTS_LIMIT = 12;

  if (!ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: 'Token not configured' }), { status: 500 });
  }

  try {
    const ownerId = -Math.abs(parseInt(GROUP_ID));
    const params = new URLSearchParams({
      owner_id: String(ownerId),
      count: String(POSTS_LIMIT),
      access_token: ACCESS_TOKEN,
      v: API_VERSION,
    });
    const res = await fetch(`https://api.vk.com/method/wall.get?${params}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.error_msg);
    return new Response(JSON.stringify(data.response.items), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }
}