import { defineApp } from 'convex/server'
import { v } from 'convex/values'

const app = defineApp({
  env: {
    AGENT_CREDENTIAL_BROKER_SECRET: v.optional(v.string()),
  },
})

export default app
