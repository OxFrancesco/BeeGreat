import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig, loadEnv } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { sentryTanstackStart } from '@sentry/tanstackstart-react/vite'
import { nitro } from 'nitro/vite'
import { cp, mkdir, realpath } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)

async function includeReactRuntime(serverDir: string) {
  const source = await realpath(dirname(require.resolve('react/package.json')))
  const destination = resolve(serverDir, 'node_modules/react')

  await mkdir(dirname(destination), { recursive: true })
  await cp(source, destination, { recursive: true })
}

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
      nitro({
        modules: [
          {
            name: 'beegreat-react-runtime',
            setup(nitro) {
              nitro.hooks.hook('compiled', ({ options }) =>
                includeReactRuntime(options.output.serverDir),
              )
            },
          },
        ],
        rollupConfig: {
          external: [/^@coinbase\/cdp-sdk(?:\/.*)?$/],
        },
      }),
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
