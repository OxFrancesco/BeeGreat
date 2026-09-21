import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NansenChart } from "../src/components/nansen-charts";
import { analyticsFixtures } from "./fixtures/nansen-analytics";

test("server-rendered chart replies retain accessible exact data and source attribution", () => {
  const html = renderToStaticMarkup(<>{analyticsFixtures.map((snapshot) => <NansenChart key={snapshot.key} snapshot={snapshot} />)}</>);
  expect(html).toContain("-$600,000.00");
  expect(html).toContain("-$260.00");
  expect(html).toContain("Unavailable");
  expect(html).toContain("Partial data");
  expect(html).toContain("No data returned");
  expect(html).toContain('href="https://nansen.ai"');
  expect(html).toContain("receipt tokens can overlap");
  expect(html).not.toContain("NaN");
  expect(html).not.toContain("Infinity");
});
