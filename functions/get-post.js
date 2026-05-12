// functions/api/get-post.js
export async function onRequestGet({ request, env }) {
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
        return new Response(JSON.stringify({ error: 'Token not configured' }), { status: 500 });
    }

    try {
        const params = new URLSearchParams({
            posts: `${ownerId}_${postId}`,
            access_token: ACCESS_TOKEN,
            v: API_VERSION,
        });

        const response = await fetch(`https://api.vk.com/method/wall.getById?${params.toString()}`);
        const data = await response.json();

        if (data.error) throw new Error(data.error.error_msg || 'VK API error');

        const post = data.response?.[0];
        if (!post) {
            return new Response(JSON.stringify({ error: 'Post not found' }), { status: 404 });
        }

        return new Response(JSON.stringify(post), {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}