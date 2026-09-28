import { expect, test } from "bun:test";
import cases from "../../../tests/fixtures/presentation/receipts.json";
import { receiptPresentation } from "../src/lib/receipt-presentation";
for (const example of cases) test(`receipt presentation: ${example.name}`, () => {
  expect(receiptPresentation(example.input)).toEqual(example.expected);
});
