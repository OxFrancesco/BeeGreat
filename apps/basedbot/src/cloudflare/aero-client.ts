import type { AeroExecutor } from "../aerodrome";

export function aeroWorkerExecutor(service: Pick<Fetcher, "fetch">): AeroExecutor {
  return async (action, parameters) => {
    const response = await service.fetch("https://aero.internal/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, parameters }),
    });
    if (!response.ok) {
      const payload: unknown = await response.json();
      const detail = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error : `Aero Worker returned HTTP ${response.status}`;
      throw new Error(detail);
    }
    return response.json();
  };
}
