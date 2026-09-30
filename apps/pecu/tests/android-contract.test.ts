import { describe, expect, test } from "bun:test";
import { webStateSchema, webTurnSchema } from "../src/web-contract";
import { webTurnEventSchema } from "../src/web-stream";
import { notificationListSchema, taskListSchema } from "../src/task-contract";
import { researchActionResultSchema, researchDetailSchema, researchListSchema } from "../src/research-contract";

describe("Android shared fixtures", () => {
  test("steering targets the same active request on Android", async () => {
    const fixture = await Bun.file(new URL("../apps/android/app/src/test/resources/steering.json", import.meta.url)).json();
    expect(webTurnSchema.omit({ userId: true, senderId: true }).parse(fixture)).toEqual(fixture);
  });
  test("persisted replies and history match the backend contract", async () => {
    const fixture = await Bun.file(new URL("../apps/android/app/src/test/resources/state.json", import.meta.url)).json();
    expect(webStateSchema.parse(fixture)).toEqual(fixture);
  });
  test("automations and notifications match the backend contract", async () => {
    const fixture = await Bun.file(new URL("../apps/android/app/src/test/resources/automations.json", import.meta.url)).json();
    expect(taskListSchema.parse(fixture.tasks)).toEqual(fixture.tasks);
    expect(notificationListSchema.parse(fixture.notifications)).toEqual(fixture.notifications);
  });
  test("research list, report and actions match the backend contract", async () => {
    const fixture = await Bun.file(new URL("../apps/android/app/src/test/resources/researches.json", import.meta.url)).json();
    expect(researchListSchema.parse(fixture.list)).toEqual(fixture.list);
    expect(researchDetailSchema.parse(fixture.detail)).toEqual(fixture.detail);
    expect(researchActionResultSchema.parse(fixture.action)).toEqual(fixture.action);
  });
  test("stream events match the deployed protocol", async () => {
    const fixture: unknown[] = await Bun.file(new URL("../apps/android/app/src/test/resources/events.json", import.meta.url)).json();
    expect<unknown>(fixture.map(event => webTurnEventSchema.parse(event))).toEqual(fixture);
  });
});
