import type { PostHog } from "posthog-js";
import type * as Analytics from "../../../src/browser-analytics";
import { strict as assert } from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";
import { z } from "zod";

const temporary = await mkdtemp(join(tmpdir(), "pecu-analytics-"));
const window = new Window({ url: "https://pecu.app/agent/private-thread?token=private-secret#private-hash" });
const eventSchema = z.object({ event: z.string(), properties: z.record(z.string(), z.unknown()) });
const events: z.infer<typeof eventSchema>[] = [];
let requests = 0;

try {
  const source = (await Bun.file(new URL("../../../src/browser-analytics.ts", import.meta.url)).text())
    .replace('"posthog-js"', JSON.stringify(fileURLToPath(import.meta.resolve("posthog-js"))))
    .replace('"./analytics-config"', JSON.stringify(fileURLToPath(new URL("../../../src/analytics-config.ts", import.meta.url))));
  const entry = join(temporary, "browser.ts");
  await Bun.write(entry, `${source}\nObject.assign(window, { analytics: { initAnalytics, trackPage, identifyAnalytics, trackNavigation }, posthog });`);
  const built = await Bun.build({ entrypoints: [entry], target: "browser", format: "iife" });
  assert(built.success);
  window.fetch = async () => {
    requests++;
    return new window.Response("{}", { status: 200 });
  };
  window.eval(await built.outputs[0].text());
  type Probe = { analytics: Pick<typeof Analytics, "initAnalytics" | "trackPage" | "identifyAnalytics" | "trackNavigation">; posthog: PostHog };
  // SAFETY: the bundle just evaluated above assigns exactly these real module exports to this isolated Window.
  const { analytics, posthog } = window as Window & Probe;
  analytics.initAnalytics();
  posthog.set_config({ opt_out_useragent_filter: true, request_batching: false, disable_compression: true, api_transport: "fetch" });
  posthog.on("eventCaptured", (event) => events.push(eventSchema.parse(event)));
  posthog.identify("pecu_previous_account");
  const previousDevice = posthog.get_property("$device_id");
  analytics.trackPage("/agent/private-thread");
  analytics.trackPage("/agent/private-thread");
  await analytics.identifyAnalytics("web-user_testA");
  const firstId = posthog.get_distinct_id();
  assert.notEqual(posthog.get_property("$device_id"), previousDevice);
  assert.match(firstId, /^pecu_[a-f0-9]{64}$/);
  await analytics.identifyAnalytics(null);
  assert.notEqual(posthog.get_distinct_id(), firstId);
  await analytics.identifyAnalytics("web-user_testB");
  assert.notEqual(posthog.get_distinct_id(), firstId);
  posthog.capture("pecu_navigation_clicked", {
    destination: "agent", text: "private-chat", wallet: "private-wallet",
    $set: { email: "private-email" }, $current_url: window.location.href,
  });
  assert.equal(events.filter((event) => event.event === "$pageview").length, 1);
  assert(!JSON.stringify(events).includes("private-"));
  assert.equal(events.at(-1)?.properties.$current_url, "https://pecu.app/agent");
  assert.equal(events.at(-1)?.properties.product, "pecu");
  assert.equal(events.at(-1)?.properties.environment, "production");
  assert.equal(events.at(-1)?.properties.$geoip_disable, true);
  assert.match(String(events.at(-1)?.properties.token), /^phc_/);
  const beforeNavigation = requests;
  analytics.trackNavigation("agent");
  assert.equal(requests, beforeNavigation + 1);
  assert(requests > 0);
  console.log("Browser SDK verified: transport, redaction, account reset, and pageview deduplication.");
} finally {
  await window.happyDOM.abort();
  window.close();
  await rm(temporary, { recursive: true, force: true });
}
