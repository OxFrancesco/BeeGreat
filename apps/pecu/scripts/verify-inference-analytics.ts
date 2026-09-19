import { captureAgentEvent } from "../src/analytics";
import { generationEvents } from "../src/inference-analytics";
import { usageStep, verificationTurn } from "../tests/fixtures/inference-usage";

for (const event of await generationEvents([
  ...usageStep("verification-chatgpt"),
  ...usageStep("verification-openrouter", "openrouter", 8000),
], verificationTurn)) {
  await captureAgentEvent({ senderId: verificationTurn.senderId, event, environment: "verification" });
}
console.log("Submitted two synthetic generation events. Verify ingestion in PostHog; no LLM request was made.");
