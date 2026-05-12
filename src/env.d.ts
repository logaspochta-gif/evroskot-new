// src/env.d.ts
declare var Swiper: any;
declare var WOW: any;
interface Window {
  VK_ACCESS_TOKEN_FOR_DEV?: string;
  openPostModal?: (ownerId: string, postId: string) => Promise<void>;
}