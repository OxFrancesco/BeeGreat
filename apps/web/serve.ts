type FetchHandler = {
  fetch(request: Request): Response | Promise<Response>
}

const entryUrl = new URL('./dist/server/server.js', import.meta.url)
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
