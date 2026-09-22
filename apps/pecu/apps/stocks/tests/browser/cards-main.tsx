import { createRoot } from "react-dom/client";
import { PecuCardsDialog, openPecuCards } from "../../src/components/pecu-cards";
import "./fixture.css";
const scenario = new URLSearchParams(location.search).get("case") ?? "owned";
const originalFetch = window.fetch;
window.fetch = async (input, init) => {
  if (String(input).includes("/api/cards-claim")) {
    if (scenario === "error") return Response.json({}, { status: 503 });
    return Response.json({ status: scenario, created: false, remaining: scenario === "sold_out" ? 0 : 2999, edition: scenario === "owned" ? 1 : null, cards: scenario === "owned" ? [{ id: 8, copies: 1 }] : [] });
  }
  return originalFetch(input, init);
};
if (scenario === "mobile") {
  createRoot(document.getElementById("root")!).render(<iframe title="390 pixel mobile preview" src="/cards.html?case=owned#cards" width="390" height="844" />);
} else {
  window.location.hash = "cards";
  createRoot(document.getElementById("root")!).render(<main className="transaction-fixture"><button onClick={openPecuCards}>My cards</button><PecuCardsDialog /></main>);
}
