const entryUrl = new URL('./.output/server/index.mjs', import.meta.url)
await import(entryUrl.href)
