# Sugar bridge

Authenticated Bun HTTP wrapper around the Velodrome/Aerodrome Sugar CLI. It
executes only the 12 allowlisted CLI actions and returns the CLI stdout as a
string, preserving raw token amounts that exceed JavaScript's safe integer
range.

The transaction-building actions remain unsigned. The bridge never accepts a
private key and never broadcasts a transaction.

## Run locally

Install the pinned Sugar SDK commit from the `Dockerfile`, then:

```sh
cp apps/sugar-bridge/.env.example apps/sugar-bridge/.env
bun run --cwd apps/sugar-bridge dev
```

For deployment, build the `Dockerfile` from the repository root. Set the same
random `SUGAR_BRIDGE_SECRET` in the bridge and the Convex deployment, and set
Convex `SUGAR_BRIDGE_URL` to the bridge origin.
