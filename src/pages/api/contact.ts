// src/pages/api/contact.ts
export const prerender = false;

// Получение переменных окружения (Cloudflare Workers / локально)
async function getEnv(): Promise<Record<string, string>> {
  try {
    const { env } = await import('cloudflare:workers');
    return env as Record<string, string>;
  } catch {}
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env as Record<string, string>;
  }
  throw new Error('No environment variables found');
}

export async function POST({ request }: { request: Request }) {
  const origin = request.headers.get('Origin');
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin || '*',
    'Content-Type': 'application/json',
  };

  try {
    const data = await request.json();
    const { name, email, message, _gotcha } = data;

    // Анти-спам: скрытое поле должно быть пустым
    if (_gotcha) {
      return new Response(JSON.stringify({ error: 'Spam detected' }), {
        status: 422,
        headers: corsHeaders,
      });
    }

    // Валидация
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return new Response(
        JSON.stringify({ error: 'Заполните все поля' }),
        { status: 422, headers: corsHeaders }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: 'Некорректный email' }),
        { status: 422, headers: corsHeaders }
      );
    }

    if (message.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: 'Сообщение слишком короткое (минимум 10 символов)' }),
        { status: 422, headers: corsHeaders }
      );
    }

    const env = await getEnv();
    const {
      TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID,
      RESEND_API_KEY,
      EMAIL_FROM = 'noreply@evroskot.ru',
      EMAIL_TO = 'logaspochta@gmail.com',
    } = env;

    let sent = false;

    // ── Telegram ──
    if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
      const chatIds = TELEGRAM_CHAT_ID.split(',')
        .map(s => s.trim())
        .filter(Boolean);

      for (const chatId of chatIds) {
        try {
          const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: `📩 Новая заявка с сайта\nИмя: ${name}\nEmail: ${email}\nСообщение: ${message}`,
            }),
          });
          if (res.ok) sent = true;
          else console.error('Telegram send failed:', await res.text());
        } catch (e) {
          console.error('Telegram error:', e);
        }
      }
    }

    // ── Resend ──
    if (RESEND_API_KEY) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
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
        if (res.ok) sent = true;
        else console.error('Resend email failed:', await res.text());
      } catch (e) {
        console.error('Resend error:', e);
      }
    }

    if (!sent) {
      return new Response(
        JSON.stringify({ error: 'Не удалось отправить заявку, попробуйте позже' }),
        { status: 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error('Contact API error:', err);
    return new Response(
      JSON.stringify({ error: 'Внутренняя ошибка сервера' }),
      { status: 500, headers: corsHeaders }
    );
  }
}