// Evaluate this file in an authenticated Pecu tab, then call pecuBenchmark.
// It creates previews only and cancels each one before the next sample.
globalThis.pecuBenchmark = async function pecuBenchmark({ threadId, prompt, count, label, onSample }) {
  const samples = [];
  const state = async () => {
    const response = await fetch(`/stocks/api/state?t=${encodeURIComponent(threadId)}&paged=1`);
    if (!response.ok) throw new Error(`State HTTP ${response.status}`);
    return response.json();
  };
  const turn = async text => {
    const requestId = crypto.randomUUID();
    const startedAt = Date.now();
    const start = performance.now();
    const response = await fetch('/stocks/api/turn', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream; mode=live; stages=1, application/json' },
      body: JSON.stringify({ threadId, requestId, text }),
    });
    const result = { requestId, startedAt, status: response.status, headersMs: performance.now() - start, frames: [] };
    if (!response.ok) throw new Error(`Turn HTTP ${response.status}`);
    if (response.headers.get('Content-Type')?.includes('text/event-stream')) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop();
        for (const block of blocks) {
          const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
          if (!data) continue;
          const event = JSON.parse(data);
          result.frames.push({ at: performance.now() - start, ...event });
          if (event.type === 'error') throw new Error(event.error);
          if (event.type === 'complete' && event.status === 'busy') throw new Error('Thread is busy');
        }
      }
    } else await response.json();
    return { ...result, completedMs: performance.now() - start };
  };
  for (let sample = 0; sample < count; sample++) {
    if ((await state()).yolo !== false) throw new Error('Benchmark requires YOLO off');
    const result = await turn(prompt);
    const current = await state();
    const message = current.messages.find(message => message.id.endsWith(result.requestId));
    const preview = message?.reply?.preview;
    const record = { label, sample, prompt, ...result, outcome: preview?.state ?? (message?.reply?.question ? 'question' : 'text'), preview };
    samples.push(record);
    if (preview?.state === 'pending') {
      await turn(`/cancel ${preview.code}`);
      const cancelled = (await state()).messages.find(message => message.reply?.preview?.code === preview.code)?.reply?.preview;
      if (cancelled?.state !== 'cancelled') throw new Error('Preview cancellation was not verified');
    } else if (preview && preview.state !== 'cancelled' && preview.state !== 'expired') throw new Error(`Unexpected preview state ${preview.state}`);
    onSample?.(record);
  }
  return samples;
};
