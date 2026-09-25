import { ParagraphBuffer, type ParagraphSink } from "./web-stream";

/** Coalesces live text and reconciles the final reply before the transport closes. */
export class ReplyStream {
  private readonly parts = new Map<string, { text: string; buffer: ParagraphBuffer }>();
  private timer?: ReturnType<typeof setTimeout>;
  private shown = "";
  private stopped = false;

  constructor(private readonly progress: ParagraphSink, private readonly intervalMs = 50) {}

  push(key: string, delta: string) {
    if (this.stopped) return;
    const part = this.part(key);
    part.text += delta;
    if (!this.progress.live) {
      for (const text of part.buffer.push(delta)) this.progress(text);
    } else if (!this.shown) this.flush();
    else this.timer ??= setTimeout(() => { this.timer = undefined; this.flush(); }, this.intervalMs);
  }

  end(key: string, text: string) {
    if (this.stopped) return;
    const part = this.part(key);
    if (!this.progress.live) {
      if (text.startsWith(part.text)) {
        for (const paragraph of part.buffer.push(text.slice(part.text.length))) this.progress(paragraph);
      }
      for (const paragraph of part.buffer.end()) this.progress(paragraph);
    }
    part.text = text;
    if (this.progress.live) this.flush();
  }

  finish(message: { id: string; content: readonly { type: string; text?: string }[] }) {
    if (this.stopped) return;
    if (this.progress.live) {
      this.publish(message.content.filter((part) => part.type === "text").map((part) => part.text?.trim()).filter(Boolean).join("\n"));
    } else {
      message.content.forEach((part, ordinal) => {
        if (part.type === "text" && part.text !== undefined) this.end(`${message.id}:${ordinal}`, part.text);
      });
    }
    this.stop();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  private part(key: string) {
    let part = this.parts.get(key);
    if (!part) {
      part = { text: "", buffer: new ParagraphBuffer() };
      this.parts.set(key, part);
    }
    return part;
  }

  private flush() {
    this.publish([...this.parts.values()].map((part) => part.text).join("\n"));
  }

  private publish(text: string) {
    if (this.stopped || !text.trim() || text === this.shown) return;
    this.shown = text;
    this.progress(text);
  }
}
