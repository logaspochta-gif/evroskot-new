export function getVkToken(): string {
  // Cloudflare Workers (глобальный env)
  if (
    typeof (globalThis as any).env !== 'undefined' &&
    (globalThis as any).env.VK_ACCESS_TOKEN
  ) {
    return (globalThis as any).env.VK_ACCESS_TOKEN as string;
  }
  // import.meta.env (Astro dev / Vite)
  if (
    typeof import.meta !== 'undefined' &&
    import.meta.env?.VK_ACCESS_TOKEN
  ) {
    return import.meta.env.VK_ACCESS_TOKEN as string;
  }
  // process.env (чистый Node)
  if (
    typeof process !== 'undefined' &&
    process.env?.VK_ACCESS_TOKEN
  ) {
    return process.env.VK_ACCESS_TOKEN as string;
  }
  throw new Error('VK_ACCESS_TOKEN is not defined in any environment');
}