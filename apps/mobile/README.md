# BeeGreat mobile

> This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.

The Expo app is BeeGreat’s canonical interaction and visual reference. Bee chat, Goals, Hive, profile, and voice all use the shared Clerk identity, Convex backend, and Flue agent.

## Run

From the repository root:

```sh
cp apps/mobile/.env.example apps/mobile/.env
bun run mobile
```

Use a LAN agent URL in `.env` when testing on a physical device.

## Code map

- `src/app/` routes and screens
- `src/components/agent/` Bee conversation and generated UI
- `src/components/goals/` Goal, Project, and Task UI
- `src/components/hive/` currency and achievement UI
- `src/constants/theme.ts` visual tokens
- `src/constants/motion.ts` motion tokens
- `assets/` shared BeeGreat artwork used by mobile and web
