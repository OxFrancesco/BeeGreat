import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig, loadEnv } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      port: 3000,
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tanstackStart(),
      viteReact(),
      sentryTanstackStart({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken: env.SENTRY_AUTH_TOKEN,
        silent: !process.env.CI,
        tunnelRoute: '/monitoring',
      }),
    ],
    // Workaround for https://github.com/TanStack/router/issues/5738
    optimizeDeps: {
      include: ['@clerk/tanstack-react-start', 'cookie'],
    },
  }
})
