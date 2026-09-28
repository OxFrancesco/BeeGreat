import { describe, expect, test } from "bun:test";
import { webStateSchema } from "../src/web-contract";
import { webTurnEventSchema } from "../src/web-stream";

describe("Android shared fixtures", () => {
  test("persisted replies and history match the backend contract", async () => {
    const fixture = await Bun.file(new URL("../apps/android/app/src/test/resources/state.json", import.meta.url)).json();
    expect(webStateSchema.parse(fixture)).toEqual(fixture);
  });
  test("stream events match the deployed protocol", async () => {
    const fixture: unknown[] = await Bun.file(new URL("../apps/android/app/src/test/resources/events.json", import.meta.url)).json();
    expect<unknown>(fixture.map(event => webTurnEventSchema.parse(event))).toEqual(fixture);
  });
});
