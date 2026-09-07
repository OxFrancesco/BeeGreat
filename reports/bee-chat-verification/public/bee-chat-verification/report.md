# Bee chat verification

September 7, 2026.

The deployed web chat was unable to reach its agent. Saved messages loaded from Convex, but the Worker rejected the web domain with HTTP 403 during the browser's preflight request. The Worker now explicitly allows the deployed Bee web origin. Unknown origins still receive HTTP 403.

## Changes

- Added the deployed web domain to the Worker's versioned CORS configuration.
- Removed internal system, hidden, and diagnostic messages from the shared web/mobile conversation view. The regression test covers live messages and previously persisted envelopes.
- Kept the mobile web composer above the bottom navigation, including the device's bottom safe area. A later stylesheet had overwritten its original clearance.
- Restored the Bee link in mobile web navigation so users can return to chat from other pages.
- Fixed background iMessage outbox authentication. Polls authenticate with the bridge secret and do not require a user header. The handler still validates the secret.
- Updated the deployment instructions with the live Vercel project, browser checks, and the command for deploying a Worker while preserving its container.

## Verified live

Google sign-in opened the existing account. A web message received the requested marker. A real goals specialist call returned the current goal names, and its completed tool details rendered in the conversation. A full page reload preserved both the messages and the tool result.

Bee remembered an earlier marker after reload. Retry replaced the visible user/assistant pair without duplication. An independent Convex query confirmed that the old pair was hidden and the replacement pair was stored. A second reload preserved that result.

At a 390 by 844 browser viewport, the Send button sent a message and Bee returned its exact marker. The composer stayed above the bottom navigation. Opening Goals and returning through the Bee link preserved the conversation.

The deployed Worker returns HTTP 204 with the expected origin and stream headers for Bee's browser preflight. It rejects an unknown browser origin with HTTP 403. An outbox probe with the configured bridge secret reaches action validation, while an invalid secret receives HTTP 403.

The Railway bridge deployment reached SUCCESS and logged that its iMessage provider was connected. No third-party messages or wallet transactions were sent during verification.

## Checks

| Check | Result |
| --- | --- |
| Agent tests | 61 passed |
| Backend tests | 316 passed |
| Web tests | 44 passed |
| Shared chat tests | 8 passed |
| Mobile chat tests | 8 passed |
| Bridge tests | 23 passed |
| Agent, backend, web, mobile, shared chat and bridge types | Passed |
| Isolated Vercel server artifact | HTTP 200 |
| Native iOS | Release build and launch passed. Google sign-in pending. |

These are 460 focused tests. They do not establish that every feature, provider, or device path works.

## Scope and remaining checks

The shared history fix applies to web and native mobile. CLI replies read the completed response directly, and iMessage selects assistant messages; neither renders the shared web/mobile history component. The CORS change affects browser clients. Native and trusted bridge requests without an Origin header retain their existing authentication.

No wire contract or model routing changed. The live checks used the account's existing provider configuration. Both provider paths were not independently forced and tested. Voice capture, every external connector, physical iOS/Android behavior, and on-chain actions are outside the completed evidence.

Code is pushed to main at `56602ad`. Worker `d9a38c89-667f-4201-9a8f-7437f0bb3d24`, Vercel `dpl_AfEMEpA278cRqyatUNfeQTiN27yu`, Railway `15e7955a-9b8a-4639-8313-15e9fe006a75`, and the connected Convex backend are deployed. The native iOS release build passed and launched on an iPhone 17 Pro simulator. Google SSO opened its sign-in page. This simulator has no saved Google session, so native chat verification is waiting for user sign-in. The native app has not been published to users. The container image was preserved during the Worker deployment.

[Open Bee](https://beegreat-web.vercel.app/bee) · [View main](https://github.com/OxFrancesco/BeeGreat/commits/main/)

[Desktop screenshot](web-chat.png) · [Mobile web screenshot](mobile-web-chat.png) · [Composer and reply recording](composer-and-reply.mp4)

The CAP recording is cropped to the composer and reply to exclude unrelated operating system dialogs. Full app screenshots accompany it.

The first simulator build disabled code signing and failed during Keychain access at startup. Rebuilding with simulator signing enabled removed the failure. No native source change was needed.

[Native sign-in screenshot](native-signin.png)
