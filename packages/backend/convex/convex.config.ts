import { defineApp } from 'convex/server'
import { v } from 'convex/values'

const app = defineApp({
  env: {
    AGENT_URL: v.optional(v.string()),
    AGENT_CREDENTIAL_BROKER_SECRET: v.optional(v.string()),
    APPLE_SIGN_IN_CLIENT_ID: v.optional(v.string()),
    APPLE_SIGN_IN_KEY_ID: v.optional(v.string()),
    APPLE_SIGN_IN_PRIVATE_KEY: v.optional(v.string()),
    APPLE_SIGN_IN_TEAM_ID: v.optional(v.string()),
    CLERK_SECRET_KEY: v.optional(v.string()),
    CLERK_WEBHOOK_SIGNING_SECRET: v.optional(v.string()),
    REVENUECAT_SECRET_API_KEY: v.optional(v.string()),
    REVENUECAT_WEBHOOK_SECRET: v.optional(v.string()),
    REVENUECAT_APP_ID: v.optional(v.string()),
    FIRECRAWL_API_KEY: v.optional(v.string()),
    TWITTERAPI_IO_API_KEY: v.optional(v.string()),
    ELEVENLABS_API_KEY: v.optional(v.string()),
    OPENROUTER_API_KEY: v.optional(v.string()),
    DEVIN_API_KEY: v.optional(v.string()),
    DEVIN_ORG_ID: v.optional(v.string()),
    FAL_KEY: v.optional(v.string()),
    FAL_IMAGE_GENERATION_MODEL: v.optional(v.string()),
    FAL_IMAGE_EDIT_MODEL: v.optional(v.string()),
    FAL_VIDEO_GENERATION_MODEL: v.optional(v.string()),
    FAL_VIDEO_EDIT_MODEL: v.optional(v.string()),
  },
})

export default app
