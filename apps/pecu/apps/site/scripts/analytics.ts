import { trackNavigation, trackPage, type AnalyticsDestination } from "../../../src/browser-analytics";

trackPage(window.location.pathname);
document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;
  const anchor = event.target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  const url = new URL(anchor.href);
  const destinations = new Map<string, AnalyticsDestination>([
    ["https://pecu.app/agent", "agent"],
    ["https://pecu.app/stocks", "stocks"],
    ["https://pecu.app/un-aerosdk", "aero_cli"],
    ["https://pecu.app/un-aerosdk/docs", "aero_docs"],
    ["https://x.com/BeeGreatAI", "x_chat"],
    ["https://pecu.app/evmsdk", "evm_sdk"],
  ]);
  const destination = destinations.get(url.origin + url.pathname);
  if (destination) trackNavigation(destination);
});
