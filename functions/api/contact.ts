// functions/api/contact.ts

interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_TO?: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_SHEET_ID?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

interface ContactBody {
  name: string;
  email: string;
  phone?: string;
  message: string;
  page?: string;
  _gotcha?: string;
}

interface Result {
  telegram?: string;
  email?: string;
  sheet?: string;
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = env.TELEGRAM_CHAT_ID;
  const RESEND_API_KEY = env.RESEND_API_KEY;
  const EMAIL_FROM = env.EMAIL_FROM || 'noreply@evroskot.ru';
  const EMAIL_TO = env.EMAIL_TO || 'evroskot@gmail.com';

  const GOOGLE_CLIENT_EMAIL = env.GOOGLE_CLIENT_EMAIL;
  const GOOGLE_PRIVATE_KEY = env.GOOGLE_PRIVATE_KEY;
  const GOOGLE_SHEET_ID = env.GOOGLE_SHEET_ID;

  const UPSTASH_URL = env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = env.UPSTASH_REDIS_REST_TOKEN;

  let body: ContactBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { name, email, phone, message, page } = body;
  if (!name || !email || !message) {
    return json({ error: 'Missing required fields' }, 422);
  }

  // Rate limiting через Upstash Redis
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const key = `rate:${ip}`;
    const now = Date.now();
    const window = 30 * 60 * 1000;
    const maxRequests = 3;

    const redisRes = await fetch(`${UPSTASH_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
    });
    const redisData = await redisRes.json() as { result: string | null };
    const current = redisData.result
      ? JSON.parse(redisData.result) as { count: number; resetAt: number }
      : { count: 0, resetAt: now + window };

    if (now > current.resetAt) {
      current.count = 0;
      current.resetAt = now + window;
    }

    if (current.count >= maxRequests) {
      return json({ error: 'Слишком много заявок. Попробуйте позже.' }, 429);
    }

    current.count++;
    await fetch(`${UPSTASH_URL}/set/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(JSON.stringify(current))
    });
  }

  const telegramText = `📩 Новая заявка с evroskot.ru%0A%0A`
    + `*Имя:* ${escapeMarkdown(name)}%0A`
    + `*Email:* ${escapeMarkdown(email)}%0A`
    + `*Телефон:* ${escapeMarkdown(phone || '—')}%0A`
    + `*Сообщение:* ${escapeMarkdown(message)}%0A`
    + `*Страница:* ${escapeMarkdown(page || '—')}`;

  const emailHtml = `<h2>Новая заявка</h2>`
    + `<p><strong>Имя:</strong> ${escapeHtml(name)}</p>`
    + `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`
    + `<p><strong>Телефон:</strong> ${escapeHtml(phone || '—')}</p>`
    + `<p><strong>Сообщение:</strong> ${escapeHtml(message)}</p>`
    + `<p><strong>Страница:</strong> ${escapeHtml(page || '—')}</p>`;

  const results: Result = { telegram: 'skipped', email: 'skipped', sheet: 'skipped' };

  // Telegram
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(tgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: decodeURIComponent(telegramText),
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true
      })
    });
    results.telegram = res.ok ? 'ok' : 'failed';
  }

  // Resend
  if (RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `evroskot.ru <${EMAIL_FROM}>`,
          to: [EMAIL_TO],
          subject: `Заявка с сайта от ${name}`,
          html: emailHtml
        })
      });
      results.email = res.ok ? 'ok' : 'failed';
    } catch {
      results.email = 'failed';
    }
  }

  // Google Sheets
  if (GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY && GOOGLE_SHEET_ID) {
    try {
      const token = await getGoogleAccessToken(GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY);
      const range = 'A1';
      const values = [[
        new Date().toLocaleString('ru-RU'),
        name,
        email,
        phone || '',
        message,
        page || ''
      ]];

      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ values })
        }
      );
      results.sheet = appendRes.ok ? 'ok' : 'failed';
    } catch {
      results.sheet = 'failed';
    }
  }

  const success = results.telegram === 'ok' || results.email === 'ok' || results.sheet === 'ok';
  return json({ success, details: results }, success ? 200 : 500);
}

// --- Хелперы ---

async function getGoogleAccessToken(email: string, privateKey: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedClaim = btoa(JSON.stringify(claim));
  const signatureInput = `${encodedHeader}.${encodedClaim}`;

  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signatureInput)
  );
  const jwt = `${signatureInput}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  const pemContents = pem
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\n/g, '');
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] as string));
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}