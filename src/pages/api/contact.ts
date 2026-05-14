// src/pages/api/contact.ts
import { env } from 'cloudflare:workers';

export const prerender = false;

export async function POST({ request }: { request: Request }) {
  const data = await request.json();
  const { name, email, message } = data;

  if (!name || !email || !message) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const {
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,          // теперь может быть строкой с ID через запятую
    RESEND_API_KEY,
    EMAIL_FROM = 'noreply@evroskot.ru',
    EMAIL_TO = 'logaspochta@gmail.com',
  } = env;

  // ── Telegram ──
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    // Поддерживаем один ID или несколько через запятую
    const chatIds = TELEGRAM_CHAT_ID.split(',')
      .map(s => s.trim())
      .filter(Boolean);

    for (const chatId of chatIds) {
      try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📩 Новая заявка:\nИмя: ${name}\nEmail: ${email}\nСообщение: ${message}`,
          }),
        });
      } catch {
        // игнорируем ошибку одного чата, остальные продолжают работать
      }
    }
  }

  // ── Resend ──
  if (RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: EMAIL_FROM,
          to: [EMAIL_TO],
          subject: `Заявка с сайта от ${name}`,
          html: `<p><strong>Имя:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Сообщение:</strong> ${message}</p>`,
        }),
      });
    } catch {
      // ошибка отправки email не ломает ответ
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}