import { codexEndpoint } from "./codex-protocol";

export function codexContainerFetch(container: Pick<Fetcher, "fetch">) {
  return Object.assign(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    if (request.url !== codexEndpoint) return fetch(request);
    return container.fetch(new Request("https://codex.internal/responses", request));
  }, { preconnect() {} });
}
