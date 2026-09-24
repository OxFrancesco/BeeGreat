import { captureAgentEvent } from "../src/analytics";
import { generationEvents } from "../src/inference-analytics";
import { usageStep, verificationTurn } from "../tests/fixtures/inference-usage";

const startedAt = Date.now() - 20_000;
for (const event of await generationEvents([
  ...usageStep("verification-chatgpt", "openai", startedAt + 1000),
  ...usageStep("verification-openrouter", "openrouter", startedAt + 8000),
], { ...verificationTurn, startedAt }, [
  { id: "verification-chatgpt", session_id: "session-test", provider: "openai", model: "gpt-6-sol", started_at: startedAt, response_at: startedAt + 500, status: 200 },
  { id: "verification-openrouter", session_id: "session-test", provider: "openrouter", model: "openai/gpt-6-sol", started_at: startedAt + 7000, response_at: startedAt + 7500, status: 200 },
])) {
  await captureAgentEvent({ senderId: verificationTurn.senderId, event, environment: "verification" });
}
console.log("Submitted two synthetic generation events. Verify ingestion in PostHog; no LLM request was made.");
