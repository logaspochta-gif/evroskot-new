// src/env.d.ts
declare var Swiper: any;
declare var WOW: any;

interface Window {
  VK_ACCESS_TOKEN_FOR_DEV?: string;
  openPostModal?: (ownerId: string, postId: string) => Promise<void>;
}

declare module 'cloudflare:workers' {
  interface Env {
    VK_ACCESS_TOKEN?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_CHAT_ID?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    EMAIL_TO?: string;
  }
  export const env: Env;
}