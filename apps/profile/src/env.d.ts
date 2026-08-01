/// <reference types="astro/client" />

declare module 'cloudflare:workers' {
  export const env: {
    CONVEX_URL?: string
  }
}
