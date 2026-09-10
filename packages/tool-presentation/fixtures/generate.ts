// Regenerates beeui.json from the TypeScript implementation, which is the
// source of truth. The Android port (apps/android/core/contract) asserts
// against the same file, so a contract change here fails its build until the
// Kotlin side follows. Run: bun packages/tool-presentation/fixtures/generate.ts

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  deriveBeeUiFollowUps,
  extractBeeUi,
  getToolCopy,
  scrubIdentifiers,
} from "../src/index";

const extractInputs = [
  "Here is your day.\n```beeui\n{\"components\":[{\"type\":\"metric\",\"label\":\"Open tasks\",\"value\":\"3\"}]}\n```",
  "Two cards.\n```beeui\n{\"components\":[{\"type\":\"text\",\"body\":\"Note (id j970k2m4n6p8q0r2t4v6x8z0b2d4f6h8)\"},{\"type\":\"highlight\",\"title\":\"Focus\",\"body\":\"Ship it\"}]}\n```\n\n\nTrailing.",
  "Chart.\n```beeui\n{\"components\":[{\"type\":\"chart\",\"kind\":\"bar\",\"title\":\"Water\",\"unit\":\"ml\",\"data\":[{\"label\":\"Mon\",\"value\":500},{\"label\":\"Tue\",\"value\":750.5}]}]}\n```",
  "Tasks.\n```beeui\n{\"components\":[{\"type\":\"tasks\",\"title\":\"Today\",\"items\":[{\"id\":\"t1\",\"title\":\"Run\",\"done\":false,\"due\":\"5pm\"},{\"id\":\"t2\",\"title\":\"Read\",\"done\":true}]}]}\n```",
  "Unknown type degrades.\n```beeui\n{\"components\":[{\"type\":\"hologram\",\"x\":1},{\"type\":\"text\",\"body\":\"ok\"}]}\n```",
  "Invalid known component drops the block.\n```beeui\n{\"components\":[{\"type\":\"metric\",\"label\":\"missing value\"}]}\n```",
  "Malformed JSON.\n```beeui\n{\"components\":[\n```",
  "Look: ![A bee](https://example.com/bee.png \"title\") and again ![](https://example.com/bee.png)",
  "```beeui\n{\"components\":[{\"type\":\"image\",\"url\":\"http://insecure.example/x.png\",\"alt\":\"nope\"}]}\n```",
  "```beeui\n{\"components\":[{\"type\":\"bookmark\",\"title\":\"Site\",\"url\":\"https://www.example.com/a\",\"kind\":\"website\",\"labels\":[\"one\",\"two\"],\"note\":\"Read later\"}]}\n```",
  "```beeui\n{\"components\":[{\"type\":\"bookmark\",\"title\":\"Site\",\"url\":\"https://example.com\",\"kind\":\"podcast\"}]}\n```",
  "```beeui\n{\"components\":[{\"type\":\"devin\",\"title\":\"Fix CI\",\"status\":\"running\",\"sessionId\":\"devin-abc123\",\"sessionUrl\":\"https://app.devin.ai/s/abc\",\"pullRequests\":[{\"url\":\"https://github.com/o/r/pull/1\",\"state\":\"open\"}]}]}\n```",
  "```beeui\n{\"components\":[{\"type\":\"devin\",\"title\":\"Bad\",\"status\":\"x\",\"sessionId\":\"nope\",\"sessionUrl\":\"https://a.b\",\"pullRequests\":[]}]}\n```",
  "```beeui\n{\"components\":[{\"type\":\"first_focus\",\"requestId\":\"req1\",\"goalTitle\":\"G\",\"projectTitle\":\"P\",\"taskTitle\":\"T\",\"highlightExpiresAt\":1730000000000}]}\n```",
  "```beeui\n{\"components\":[{\"type\":\"first_focus\",\"requestId\":\"\",\"goalTitle\":\"G\",\"projectTitle\":\"P\",\"taskTitle\":\"T\"}]}\n```",
  "```beeui\n{\"components\":[{\"type\":\"confirm\",\"summary\":\"Send 1 ETH\",\"action\":\"swap\",\"payload\":{\"web3ActionId\":\"act_1\"}}]}\n```",
  "```beeui\n{\"components\":[{\"type\":\"confirm\",\"summary\":\"Delete goal?\",\"action\":\"delete_goal\"}]}\n```",
  "```beeui\n{\"components\":[{\"type\":\"question\",\"questions\":[{\"header\":\"Time\",\"question\":\"When?\",\"options\":[{\"label\":\"Morning\",\"description\":\"Before 9\"},{\"label\":\"Evening\"}]}]}]}\n```",
  "```beeui\n{\"components\":[{\"type\":\"question\",\"questions\":[{\"header\":\"Time\",\"question\":\"When?\",\"options\":[{\"label\":\"Only one\"}]}]}]}\n```",
  "Two blocks.\n```BEEUI\n{\"components\":[{\"type\":\"text\",\"body\":\"one\"}]}\n```\nmiddle\n```beeui\n{\"components\":[{\"type\":\"text\",\"body\":\"two\"}]}\n```",
  "Plain reply with session devin-abc123def and ID: j970k2m4n6p8q0r2t4v6x8z0b2d4f6h8 removed.",
];

const scrubInputs = [
  "Task (id j970k2m4n6p8q0r2t4v6x8z0b2d4f6h8) is due",
  "Open https://x.test/j970k2m4n6p8q0r2t4v6x8z0b2d4f6h8/view now",
  "Session: devin-abc123def · Status: running",
  "Wallet 0x1234567890abcdef1234567890abcdef12345678 id: 0x1234567890abcdef1234567890abcdef12345678",
  "Done ( ) and [ ] and  double  spaces , punct .",
];

const toolCopyInputs: Array<{ name: string; state: "running" | "done" | "error"; input?: unknown }> = [
  { name: "search_mind", state: "running" },
  { name: "create_wallet", state: "done" },
  { name: "start_devin_task", state: "error" },
  { name: "generate_image", state: "running" },
  { name: "task", state: "running", input: { agent: "web3" } },
  { name: "task", state: "done", input: { agent: "imagine" } },
  { name: "task", state: "error", input: { agent: "goals" } },
  { name: "task", state: "running", input: { agent: 42 } },
  { name: "task", state: "running" },
  { name: "some_new_tool", state: "done" },
];

const fixtures = {
  extract: extractInputs.map((input) => {
    const result = extractBeeUi(input);
    return { input, spoken: result.spoken, components: result.components, followUps: deriveBeeUiFollowUps(result.components) };
  }),
  scrub: scrubInputs.map((input) => ({ input, output: scrubIdentifiers(input), preserved: scrubIdentifiers(input, true) })),
  toolCopy: toolCopyInputs.map((entry) => ({ ...entry, output: getToolCopy(entry.name, entry.state, entry.input) })),
};

const target = fileURLToPath(new URL("./beeui.json", import.meta.url));
writeFileSync(target, `${JSON.stringify(fixtures, null, 2)}\n`);
console.log(`wrote ${target}`);
