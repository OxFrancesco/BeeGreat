/** Every beat of the film, in seconds. The picture and the soundtrack both read from here. */
export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION = 30;

/**
 * The homepage reveal, sped up and trimmed so the snail is already in frame. `trim` and `letters`
 * are seconds of the source clip (when each letter of "Pecu" appears); `revealTime` converts them to film time.
 */
export const reveal = { rate: 1.5, trim: 1.2, letters: [3.5, 4.25, 4.75, 5.1], sourceEnd: 6, move: 4.35 };
export const revealTime = (source: number) => (source - reveal.trim) / reveal.rate;

export type Turn = { prompt: string; type: number; send: number; reply: number };

export const turns = {
  balance: { prompt: "What's my balance?", type: 5.0, send: 6.05, reply: 6.5 },
  swap: { prompt: "Swap 0.01 ETH to USDC", type: 9.15, send: 10.05, reply: 10.5 },
  stocks: { prompt: "$100 in NVDA, AAPL, TSLA: 50/30/20", type: 14.1, send: 15.15, reply: 15.6 },
  flows: { prompt: "Who's buying AERO today?", type: 18.35, send: 19.15, reply: 19.6 },
  odds: { prompt: "Odds of a Fed rate cut?", type: 20.95, send: 21.7, reply: 22.15 },
} satisfies Record<string, Turn>;

/** Typing finishes this long before the message is sent. */
export const typeLead = 0.2;
export const composerIn = 4.7;
export const confirmSwap = 12.8;
export const chatOut = 23.2;
export const bento = { in: 23.4, stagger: 0.06, expand: 26.8 };
export const outro = { snail: 27.2, wordmark: 27.35, tagline: 27.6, actions: 27.85, legal: 28.1 };

export type Headline = { text: string; sub?: string; enter: number; exit: number };

/** `*phrase*` marks the words that get the amber clay marker. */
export const headlines = {
  intro: { text: "An AI agent with a *wallet on Base.*", enter: 2.55, exit: 4.0 },
  ask: {
    text: "Ask in *plain words.*",
    sub: "Message @BeeGreatAI on X, or open pecu.app/agent.",
    enter: 4.6,
    exit: 8.95,
  },
  swap: {
    text: "*Swap and send* tokens.",
    sub: "Quotes and swaps through Aerodrome. Transfers to any address.",
    enter: 9.0,
    exit: 13.95,
  },
  stocks: {
    text: "Buy tokenized *stocks.*",
    sub: "NVIDIA, Apple, Tesla and seven more, paid in USDC.",
    enter: 14.0,
    exit: 18.15,
  },
  data: {
    text: "Read the chain. *Check the odds.*",
    sub: "Token flows and P&L from Nansen. Markets from Polymarket.",
    enter: 18.2,
    exit: 23.1,
  },
  more: { text: "Lend, earn, lock *and share.*", enter: 23.3, exit: 26.7 },
} satisfies Record<string, Headline>;

export const wordStagger = 0.05;

/** When the marker starts to sweep behind its phrase: after the last word has landed. */
export function markerAt(headline: Headline) {
  const words = headline.text.replaceAll("*", "").split(/\s+/).filter(Boolean).length;
  return headline.enter + (words - 1) * wordStagger + 0.35;
}
