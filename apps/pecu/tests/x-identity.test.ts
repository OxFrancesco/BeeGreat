import { expect, spyOn, test } from "bun:test";
import { XApi } from "../src/x/api";

test("bot identity comes from the OAuth token and must match the configured account", async () => {
  const api = new XApi("test-token");
  spyOn(api.client.users, "getMe").mockResolvedValue({ data: { id: "2086819052069007360", username: "BeeGreatAI", name: "BeeGreat AI" } });
  await expect(api.identity()).resolves.toEqual({ id: "2086819052069007360", username: "BeeGreatAI", name: "BeeGreat AI" });
  await expect(api.me("2086819052069007360")).resolves.toBe("2086819052069007360");
  await expect(api.me("1319617668186542087")).rejects.toThrow("X account mismatch");
});
