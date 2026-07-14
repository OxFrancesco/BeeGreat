import { defineApp } from 'convex/server'
import { v } from 'convex/values'

const app = defineApp({
  env: {
    AGENT_CREDENTIAL_BROKER_SECRET: v.optional(v.string()),
    FIRECRAWL_API_KEY: v.optional(v.string()),
    TWITTERAPI_IO_API_KEY: v.optional(v.string()),
    ELEVENLABS_API_KEY: v.optional(v.string()),
    OPENROUTER_API_KEY: v.optional(v.string()),
  },
})

export default app
