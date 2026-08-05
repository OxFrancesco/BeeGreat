import { plugin } from 'bun'

// Flue 2.x's cloudflare subpath statically imports the workerd-provided
// `cloudflare:workers` module, which Bun cannot resolve. Tests never execute
// inside a Worker, so a benign stub keeps app/agent modules importable.
plugin({
  name: 'cloudflare-workers-stub',
  setup(build) {
    build.module('cloudflare:workers', () => ({
      loader: 'object',
      exports: {
        env: process.env,
        DurableObject: class {},
        WorkerEntrypoint: class {},
      },
    }))
  },
})
