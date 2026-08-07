type OAuthCallback = { code: string; redirectUri: string };

export function startOAuthCallback(expectedState: string) {
  let resolveCallback!: (value: OAuthCallback) => void;
  let rejectCallback!: (error: Error) => void;
  const callback = new Promise<OAuthCallback>((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname !== "/callback")
        return new Response("Not found", { status: 404 });
      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      const oauthError = url.searchParams.get("error");
      if (state !== expectedState) {
        queueMicrotask(() =>
          rejectCallback(new Error("Clerk login returned an invalid state.")),
        );
        return new Response("BeeGreat CLI could not verify this login.", {
          status: 400,
        });
      }
      if (oauthError || !code) {
        queueMicrotask(() =>
          rejectCallback(
            new Error(
              `Clerk login was cancelled${oauthError ? ` (${oauthError})` : ""}.`,
            ),
          ),
        );
        return new Response("BeeGreat CLI login was cancelled.", {
          status: 400,
        });
      }
      const redirectUri = `http://127.0.0.1:${server.port}/callback`;
      queueMicrotask(() => resolveCallback({ code, redirectUri }));
      return new Response(
        "<!doctype html><title>BeeGreat CLI</title><main style='font:16px system-ui;max-width:36rem;margin:15vh auto;padding:2rem'><h1>Signed in to BeeGreat</h1><p>You can close this tab and return to the terminal.</p></main>",
        { headers: { "content-type": "text/html; charset=utf-8" } },
      );
    },
  });

  const timeout = setTimeout(
    () => rejectCallback(new Error("Clerk login timed out.")),
    5 * 60_000,
  );
  const result = callback.finally(() => {
    clearTimeout(timeout);
    void server.stop(true);
  });
  return {
    redirectUri: `http://127.0.0.1:${server.port}/callback`,
    result,
    cancel() {
      clearTimeout(timeout);
      void server.stop(true);
    },
  };
}
