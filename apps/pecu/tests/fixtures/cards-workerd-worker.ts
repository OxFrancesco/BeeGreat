import { DurableObject } from "cloudflare:workers";
import { PecuCards } from "../../src/cards";
import { cardViewerSchema } from "../../src/cards-contract";
export class CardsProbe extends DurableObject {
  override async fetch(request: Request) {
    const cards = new PecuCards(this.ctx.storage.sql);
    return Response.json(cards.claim(cardViewerSchema.parse(await request.json())));
  }
}
export default {
  async fetch(request: Request, env: { CARDS: DurableObjectNamespace }) {
    const group = new URL(request.url).searchParams.get("group") ?? "test";
    return env.CARDS.getByName(group).fetch(request);
  },
};
