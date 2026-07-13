import { createSugarBridge, optionsFromEnv } from './server'

const port = Number(process.env.PORT ?? 3000)

Bun.serve({
  port,
  fetch: createSugarBridge(optionsFromEnv()),
})

console.info(`sugar-bridge: listening on port ${port}`)
