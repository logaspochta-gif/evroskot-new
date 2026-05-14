// src/pages/api/contact.ts
export const prerender = false;

export async function POST({ request, locals }: { request: Request; locals: any }) {
  // Доступ к переменным окружения (секретам) воркера
  const env = locals.runtime?.env || {};

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
    TELEGRAM_CHAT_ID,
    RESEND_API_KEY,
    EMAIL_FROM = 'noreply@evroskot.ru',
    EMAIL_TO = 'logaspochta@gmail.com',
  } = env;

  // Telegram
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: `📩 Новая заявка:\nИмя: ${name}\nEmail: ${email}\nСообщение: ${message}`,
      }),
    });
  }

  // Resend
  if (RESEND_API_KEY) {
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
  }

  return new Response(
    JSON.stringify({ success: true }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}