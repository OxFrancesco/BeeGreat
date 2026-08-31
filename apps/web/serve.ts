type FetchHandler = {
  fetch: (request: Request) => Response | Promise<Response>
}

const entryUrl = new URL('./dist/server/server.js', import.meta.url)
// SAFETY: `dist/server/server.js` is the TanStack Start server build artifact,
// which always default-exports a `{ fetch }` handler. It only exists after
// `vite build`, so it cannot be statically imported and typechecked here.
const { default: handler } = (await import(entryUrl.href)) as {
  default: FetchHandler
}

const configuredPort = Number(process.env.PORT ?? 3000)
const port = Number.isFinite(configuredPort) ? configuredPort : 3000

Bun.serve({
  port,
  fetch: (request) => handler.fetch(request),
})

console.log(`BeeGreat web listening on http://localhost:${port}`)
