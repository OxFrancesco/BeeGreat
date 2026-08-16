import { createAgentRouter } from '@flue/runtime/routing'
import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
} from '@beegreat/observability'
import * as Sentry from '@sentry/cloudflare'
import { Hono } from 'hono'
import {
  Bee,
  prepareBeeForRequest,
  type BeeRuntimeEnv,
} from './agents/bee.ts'
import {
  binding,
  captureWorkerFailure,
  type AppEnvironment,
  type Bindings,
} from './app-env.ts'
import { channel as githubChannel } from './channels/github.ts'
import { channel as linearChannel } from './channels/linear.ts'
import { channel as notionChannel } from './channels/notion.ts'
import { authGate } from './middleware/auth.ts'
import { webCorsPolicy, webOriginGate } from './middleware/cors.ts'
import { registerChannelRoutes } from './routes/channel.ts'
import { registerCliRoutes } from './routes/cli.ts'
import { registerInternalRoutes } from './routes/internal.ts'
import { registerVoiceRoutes } from './routes/voice.ts'
import { trustedCast } from './shared/trusted-cast.ts'

const app = new Hono<AppEnvironment>()

// Unhandled exceptions otherwise surface as plain-text 500s, which clients
// can't parse — always answer with the `{ error }` shape the apps expect.
app.onError((cause, c) => {
  console.error('unhandled worker error', c.req.method, c.req.path, cause)
  captureWorkerFailure(cause, 'app.unhandled', {
    method: c.req.method,
    path: c.req.path,
  })
  return c.json({ error: 'Bee hit an unexpected error. Try again.' }, 500)
})

// Registration order is load-bearing: the origin gate and CORS policy run
// before everything, /health answers before auth, and every route registered
// after `authGate` requires a Clerk session or the trusted bridge secret
// (minus the public paths declared in middleware/auth.ts).
app.use('*', webOriginGate)
app.use('*', webCorsPolicy)

app.get('/health', (c) => c.json({ ok: true, service: 'beegreat-agent' }))

app.use('*', authGate)

registerInternalRoutes(app)
registerChannelRoutes(app)
registerCliRoutes(app)
registerVoiceRoutes(app)

// Flue 2.0 routing is explicit: the agent router serves POST/GET/abort/
// attachments under /agents/bee/:id, and each channel mounts its own webhook
// routes at the paths registered with the providers.
app.use('/agents/bee/:id', async (c, next) => {
  if (c.req.method === 'POST') {
    await prepareBeeForRequest(
      c.req.param('id'),
      trustedCast<BeeRuntimeEnv>(c.env),
    )
  }
  await next()
})
app.route('/agents/bee', createAgentRouter(Bee))
app.route('/channels/github', githubChannel.route())
app.route('/channels/linear', linearChannel.route())
app.route('/channels/notion', notionChannel.route())

export default Sentry.withSentry<Bindings>((env) => {
  const dsn = binding(env, 'SENTRY_DSN')?.trim()
  return {
    dsn,
    enabled: Boolean(dsn),
    environment: binding(env, 'SENTRY_ENVIRONMENT') ?? 'production',
    release: binding(env, 'SENTRY_RELEASE'),
    sendDefaultPii: false,
    beforeSend: sanitizeSentryEvent,
    beforeBreadcrumb: sanitizeSentryBreadcrumb,
    initialScope: { tags: { service: 'agent-worker' } },
    tracesSampleRate: 0.2,
  }
}, app)
