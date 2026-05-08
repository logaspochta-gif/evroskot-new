// functions/api/vk-news.js
export async function onRequest(context) {
  const SERVICE_TOKEN = context.env.VK_SERVICE_TOKEN;
  const GROUP_ID = 'evroskot_official'; // замените на ID или короткое имя вашего сообщества
  const API_VERSION = '5.131';

  if (!SERVICE_TOKEN) {
    return new Response(JSON.stringify({ error: 'Service token not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    let ownerId;

    // Определяем owner_id сообщества
    if (isNaN(GROUP_ID)) {
      const groupInfoUrl = `https://api.vk.com/method/groups.getById?group_id=${GROUP_ID}&access_token=${SERVICE_TOKEN}&v=${API_VERSION}`;
      const groupInfoRes = await fetch(groupInfoUrl);
      const groupInfoData = await groupInfoRes.json();

      if (!groupInfoData.response?.[0]) {
        return new Response(JSON.stringify({ error: 'Group not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
      ownerId = -groupInfoData.response[0].id;
    } else {
      ownerId = -Math.abs(parseInt(GROUP_ID));
    }

    const wallUrl = `https://api.vk.com/method/wall.get?owner_id=${ownerId}&count=10&access_token=${SERVICE_TOKEN}&v=${API_VERSION}`;
    const wallRes = await fetch(wallUrl);
    const wallData = await wallRes.json();

    if (!wallData.response) {
      return new Response(JSON.stringify({ error: 'Failed to fetch posts' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const posts = wallData.response.items.map(post => ({
      id: post.id,
      date: post.date,
      text: post.text,
      image: post.attachments?.[0]?.photo?.sizes?.find(s => s.type === 'x')?.url || null,
      link: `https://vk.com/wall${ownerId}_${post.id}`,
    }));

    return new Response(JSON.stringify(posts), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}