import { expect, test } from "bun:test";
import { chatGptConnectionRequired, chatGptUserCode, needsChatGptConnection } from "../src/inference-recovery";
test("recovery recognizes provider replies and the older deployed message, not arbitrary advice", () => {
  expect(needsChatGptConnection({ text: chatGptConnectionRequired })).toBe(true);
  expect(needsChatGptConnection({ text: "Connect your ChatGPT subscription in your Pecu profile at https://pecu.app/agent to use AI chat. Wallet commands still work." })).toBe(true);
  expect(needsChatGptConnection({ text: "You could connect your ChatGPT account." })).toBe(false);
});
test("extracts only the user code from the provider's documented instructions", () => {
  expect(chatGptUserCode("Enter code: ABCD-1234")).toBe("ABCD-1234");
  expect(chatGptUserCode("Enter code: ABCD1234")).toBe("ABCD1234");
  expect(chatGptUserCode("Visit https://example.com/code")).toBeUndefined();
  expect(chatGptUserCode("Enter code: ABCD-1234 and then continue")).toBeUndefined();
});
