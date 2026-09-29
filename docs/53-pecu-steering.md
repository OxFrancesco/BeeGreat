# Pecu steering

Web and native Android can send a message to an active Pecu reply. `steerOf`
in the shared turn contract identifies the original request UUID. The server
binds that UUID to the authenticated sender and conversation before admitting
input to OpenCode with `delivery: "steer"`.

The original inference call retains its tools, verified wallet, transaction
ledger and provider choice. Steering expands skill matching for the new text.
It does not run the command parser or change YOLO. Explanation-only turns retain
their tool restrictions. Steering cannot reverse a submitted transaction.

The runtime waits for outstanding steering admissions before closing the turn.
A deterministic inbox ID prevents repeated admission of the same request.
Accepted messages persist separately in web history with a `steerOf` reply
marker. Text already sent stays under the original message. Each delivered
steer starts a separate response under its own message, including after reload.
The stream carries the target `eventId` through the inference RPC and SSE;
web and Android route snapshots to that message. A late
steer fails explicitly instead of becoming an unrelated new action.

Both web composers and Android keep the active stream and target request while
sending steering. A failed admission retains the composer draft. The API also
supports authenticated clients that supply the same contract directly.

Pecu has its own backend and clients. Bee's Expo, web, CLI, iMessage, voice and
Hive do not call this API and need no changes. X Chat's serial polling path
continues processing messages in order. It has no active-turn steering UI.
ChatGPT and OpenRouter use the same inbox implementation. No Convex, Railway,
SDK mirror or container changes are required. Deploy the Pecu Worker, web client
and docs site. Android requires a new application build.

Tests cover active-stream preservation, history and acknowledgement replay,
wrong-thread and wrong-sender rejection, expired targets, skill selection and
runtime admission. Production verification uses a text-only request and steering
with a unique marker. No quote, transaction preparation or execution is needed.
