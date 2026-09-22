import { useClerk, useUser } from "@clerk/tanstack-react-start";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LayersIcon } from "lucide-react";
import { CARD_RECIPIENT_LIMIT, PECU_CARDS, cardCollectionSchema, type CardCollection } from "../../../../src/cards-contract";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

const PecuCardModel = lazy(() => import("./pecu-card-model"));

export const CardsIcon = () => <LayersIcon className="size-5" />;
export function openPecuCards() { window.location.hash = "cards"; }

export function PecuCardsDialog() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();
  const [open, setOpen] = useState(false);
  const [collection, setCollection] = useState<CardCollection | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const reduceMotion = useReducedMotion();
  const userId = user?.id;
  const updatedAt = user?.updatedAt?.getTime();
  const refresh = useCallback(async () => {
    if (!userId) return;
    const request = ++generation.current;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/stocks/api/cards-claim", { method: "POST", cache: "no-store" });
      if (!response.ok) throw new Error("Cards unavailable");
      const next = cardCollectionSchema.parse(await response.json());
      if (generation.current !== request) return;
      setCollection(next);
      if (next.created) openPecuCards();
    } catch { if (generation.current === request) setError(true); }
    finally { if (generation.current === request) setBusy(false); }
  }, [userId]);
  useEffect(() => {
    setCollection(null);
    void refresh();
    return () => { generation.current++; };
  }, [refresh, updatedAt]);
  useEffect(() => {
    const sync = () => setOpen(window.location.hash === "#cards");
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("hashchange", sync); window.removeEventListener("focus", refresh); };
  }, [refresh]);
  return <Dialog open={open} onOpenChange={(next) => {
    setOpen(next);
    if (!next && window.location.hash === "#cards") window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }}>
    <DialogContent className="pecu pecu-cards-dialog" aria-describedby={undefined}>
      <DialogTitle>My cards</DialogTitle>
      {!userId ? <p>Sign in to view your cards.</p> : error ? <div role="alert"><p>Could not load your cards.</p><Button disabled={busy} onClick={() => void refresh()}>Try again</Button></div> : !collection ? <p role="status">Loading your cards…</p> : <>
        {collection.status === "owned" ? <div className="pecu-card-collection">
          {collection.cards.map((owned) => {
            const card = PECU_CARDS[owned.id - 1]!;
            return <motion.figure key={card.id} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }}>
              <Suspense fallback={<img src={card.image} alt={card.name} width={540} height={720} />}><PecuCardModel id={card.id} name={card.name} image={card.image} /></Suspense>
              <figcaption>{card.name}{owned.copies > 1 ? ` · ${owned.copies} copies` : ""}</figcaption>
            </motion.figure>;
          })}
          <p>You received one of the {CARD_RECIPIENT_LIMIT.toLocaleString()} first-connection cards. Yours stays in your collection if you disconnect X.</p>
        </div> : collection.status === "sold_out" ? <p>All 3,000 first-connection cards have been claimed.</p> : collection.status === "x_already_claimed" ? <p>This X account already received its free card on another Pecu account. Sign in to that Pecu account to view it.</p> : <div className="pecu-card-connect">
          <p>Connect your X account to receive one randomly assigned Pecu card. One free card per person, limited to 3,000 recipients.</p>
          <p>{collection.remaining.toLocaleString()} cards remaining.</p>
          <Button className="pecu-button" disabled={busy} onClick={() => {
            if (collection.status === "eligible") void refresh();
            else { setOpen(false); window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search); openUserProfile(); }
          }}>{collection.status === "eligible" ? "Receive my card" : "Connect X in my account"}</Button>
        </div>}
      </>}
    </DialogContent>
  </Dialog>;
}
