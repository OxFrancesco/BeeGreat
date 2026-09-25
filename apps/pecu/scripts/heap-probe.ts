import { z } from "zod";

export async function heapProbe(port: number) {
  const targets = z.array(z.object({ webSocketDebuggerUrl: z.string() })).parse(await (await fetch(`http://127.0.0.1:${port}/json/list`)).json());
  const target = targets[0];
  if (!target) throw new Error("No workerd inspector target");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => { socket.onopen = () => resolve(); socket.onerror = () => reject(new Error("Inspector connection failed")); });
  let sequence = 0;
  const pending = new Map<number, { resolve(value: number): void; reject(error: Error): void }>();
  socket.onmessage = (message) => {
    const event = z.object({ id: z.number().optional(), result: z.object({ usedSize: z.number() }).optional(), error: z.unknown().optional() }).safeParse(JSON.parse(String(message.data)));
    if (!event.success || event.data.id === undefined) return;
    const request = pending.get(event.data.id);
    pending.delete(event.data.id);
    if (event.data.result) request?.resolve(event.data.result.usedSize);
    else request?.reject(new Error("Heap measurement unavailable"));
  };
  return {
    read: () => new Promise<number>((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method: "Runtime.getHeapUsage" }));
    }),
    close: () => socket.close(),
  };
}
