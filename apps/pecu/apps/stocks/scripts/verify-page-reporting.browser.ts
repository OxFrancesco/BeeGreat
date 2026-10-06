import docsPages from "../../../src/analytics-pages.generated.json";

async function verifyPageReporting() {
  if (location.hostname !== "pecu.app") throw new Error("Run in an isolated pecu.app browser tab.");
  const originalUrl = location.href;
  const originalState: unknown = history.state;
  const events: { event: string; properties: Record<string, unknown> }[] = [];
  const checks: { path: string; surface: string }[] = [];
  const cases = [
    ...docsPages.map(path => ({ url: path, path, surface: "docs" })),
    ...["/", "/about", "/design", "/nansen-showcase", "/polymarket-showcase", "/un-aerosdk", "/evmsdk"]
      .map(path => ({ url: path, path, surface: "site" })),
    ...["/agent", "/profile", "/stocks", "/researches"].map(path => ({ url: `${path}/PRIVATE_PROBE`, path, surface: "app" })),
    { url: "/docs/pecu/PRIVATE_PROBE", path: "/docs/pecu", surface: "docs" },
    { url: "/PRIVATE_PROBE", path: "/other", surface: "other" },
    { url: "/docs/pecu/security/", path: "/docs/pecu/security", surface: "docs" },
  ];
  try {
    const { analyticsOptions, initAnalytics, trackPage } = await import("../../../src/browser-analytics");
    const sanitize = analyticsOptions.before_send;
    analyticsOptions.before_send = event => {
      const safe = sanitize(event);
      if (safe) events.push(safe);
      return null;
    };
    Object.assign(analyticsOptions, {
      persistence: "memory", disable_persistence: true, respect_dnt: false,
      opt_out_useragent_filter: true, request_batching: false,
      opt_out_capturing_cookie_prefix: "pecu-page-reporting-verification-",
    });
    initAnalytics();
    for (const test of cases) {
      history.replaceState(null, "", `${test.url}?token=PRIVATE_PROBE#PRIVATE_PROBE`);
      const before = events.length;
      trackPage(location.pathname);
      trackPage(location.pathname);
      const event = events.at(-1);
      if (events.length !== before + 1 || event?.event !== "$pageview") throw new Error(`Pageview deduplication failed: ${test.path}`);
      if (event.properties.$pathname !== test.path || event.properties.surface !== test.surface) throw new Error(`Wrong path or surface: ${test.path}`);
      if (event.properties.$current_url !== `https://pecu.app${test.path}`) throw new Error(`Unsafe URL: ${test.path}`);
      checks.push({ path: test.path, surface: test.surface });
    }
    if (JSON.stringify(events).includes("PRIVATE_PROBE")) throw new Error("Private path/query/fragment reached capture");
    return { passed: checks.length, eventsDiscardedBeforeTransport: events.length, checks };
  } finally {
    history.replaceState(originalState, "", originalUrl);
  }
}

void verifyPageReporting().then(
  result => Object.assign(globalThis, { pecuPageReportingResult: result }),
  error => Object.assign(globalThis, { pecuPageReportingResult: { error: String(error) } }),
);
