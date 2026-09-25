import { z } from "zod";
import type { SugarJson } from "@beegreat/sugar";
import type { AeroRequest } from "./aero-protocol";

export type AeroExecutor = (request: AeroRequest) => Promise<SugarJson>;

export function aeroWorkerExecutor(service: Pick<Fetcher, "fetch">): AeroExecutor {
  return async (request) => {
    const response = await service.fetch("https://aero.internal/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) {
      const payload = z.object({ error: z.string() }).safeParse(await response.json());
      const detail = payload.success ? payload.data.error : `Aero Worker returned HTTP ${response.status}`;
      throw new Error(detail);
    }
    return response.json();
  };
}
