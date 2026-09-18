import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageResponse } from "../src/components/ai-elements/message";
const render = (text: string) => renderToStaticMarkup(<MessageResponse>{text}</MessageResponse>);

test("renders the reported bold stock reply and GFM structures", () => {
  const html = render("You hold **0.00004267 NVDAc**.\n\n- One\n- Two\n\n| Token | Amount |\n| --- | --- |\n| ETH | 1 |\n\n~~old~~ and `code`");
  expect(html).toContain('data-streamdown="strong"');
  expect(html).not.toContain("**0.00004267");
  for (const tag of ["<ul", "<li", "<table", "<del", "<code"]) expect(html).toContain(tag);
});

test("renders display LaTeX with KaTeX", () => {
  const html = render("$$\n\\frac{1}{2} + \\sqrt{x}\n$$");
  expect(html).toContain('class="katex"');
  expect(html).toContain("katex-display");
  expect(html).toContain("<math");
});

test("renders dollar amounts literally without inline math", () => {
  const html = render("Buy $1 of NVDAc and $1 of AAPLc");
  expect(html).toContain("Buy $1 of NVDAc and $1 of AAPLc");
  expect(html).not.toContain('class="katex"');
});

test("keeps code and escaped currency literal", () => {
  const html = render("Costs \\$5 and \\$10.\n\n```ts\nconst text = '**bold** $x$';\n```");
  expect(html).toContain("$5");
  expect(html).toContain("$10");
  expect(html).toContain("**bold** $x$");
  expect(html).not.toContain('class="katex"');
});

test("does not execute raw HTML or unsafe links", () => {
  const html = render('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">\n\n[bad](javascript:alert%281%29)');
  expect(html).not.toContain("<script");
  expect(html).not.toContain("onerror=");
  expect(html).not.toContain('href="javascript:');
});
