import { cloudflare } from '@cloudflare/vite-plugin'
import { flue, flueWorkerConfig } from '@flue/vite'
import { defineConfig } from 'vite'

// flue() must come before cloudflare(): the Cloudflare plugin invokes
// flueWorkerConfig() — Flue's worker-config customizer, contributing the
// generated Worker entry and the per-agent Durable Object bindings — while
// Vite resolves this config, after flue() has scanned the project.
export default defineConfig({
  server: {
    port: 3583,
    strictPort: true,
  },
  plugins: [flue(), cloudflare({ config: flueWorkerConfig() })],
})
