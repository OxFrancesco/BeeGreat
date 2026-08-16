import { httpRouter } from 'convex/server'
import { beennectorsInternal, beennectorsOauthCallback } from './http/beennectors'
import { beeSites } from './http/beeSites'
import { chatgptToken } from './http/chatgpt'
import { devinInternal } from './http/devin'
import { falMediaInternal } from './http/falMedia'
import { focus } from './http/focus'
import {
  googleHealthContext,
  googleHealthOauthCallback,
  googleHealthQuery,
} from './http/googleHealth'
import { imessageInternal } from './http/imessage'
import { jobsInternal } from './http/jobs'
import { mind } from './http/mind'
import { subscriptionStatus } from './http/subscription'
import { telegramInternal, telegramOauthCallback } from './http/telegram'
import { web3Sugar, web3Wallet } from './http/web3'
import { clerkWebhook, revenueCatWebhook } from './http/webhooks'

const http = httpRouter()

http.route({
  path: '/webhooks/clerk',
  method: 'POST',
  handler: clerkWebhook,
})

http.route({
  path: '/webhooks/revenuecat',
  method: 'POST',
  handler: revenueCatWebhook,
})

http.route({
  path: '/internal/subscription/status',
  method: 'POST',
  handler: subscriptionStatus,
})

http.route({
  path: '/internal/focus',
  method: 'POST',
  handler: focus,
})

http.route({
  path: '/internal/bee-sites',
  method: 'POST',
  handler: beeSites,
})

http.route({
  path: '/internal/mind',
  method: 'POST',
  handler: mind,
})

http.route({
  path: '/internal/chatgpt/token',
  method: 'POST',
  handler: chatgptToken,
})

http.route({
  path: '/google-health/oauth/callback',
  method: 'GET',
  handler: googleHealthOauthCallback,
})

http.route({
  path: '/telegram/oauth/callback',
  method: 'GET',
  handler: telegramOauthCallback,
})

http.route({
  path: '/internal/telegram',
  method: 'POST',
  handler: telegramInternal,
})

http.route({
  path: '/internal/imessage',
  method: 'POST',
  handler: imessageInternal,
})

http.route({
  path: '/beennectors/oauth/callback',
  method: 'GET',
  handler: beennectorsOauthCallback,
})

http.route({
  path: '/internal/beennectors',
  method: 'POST',
  handler: beennectorsInternal,
})

http.route({
  path: '/internal/google-health/context',
  method: 'POST',
  handler: googleHealthContext,
})

http.route({
  path: '/internal/devin',
  method: 'POST',
  handler: devinInternal,
})

http.route({
  path: '/internal/fal-media',
  method: 'POST',
  handler: falMediaInternal,
})

http.route({
  path: '/internal/google-health/query',
  method: 'POST',
  handler: googleHealthQuery,
})

http.route({
  path: '/internal/web3/sugar',
  method: 'POST',
  handler: web3Sugar,
})

http.route({
  path: '/internal/jobs',
  method: 'POST',
  handler: jobsInternal,
})

http.route({
  path: '/internal/web3/wallet',
  method: 'POST',
  handler: web3Wallet,
})

export default http
