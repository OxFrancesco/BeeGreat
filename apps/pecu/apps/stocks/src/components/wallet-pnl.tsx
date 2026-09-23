import { ArrowLeftIcon, ExternalLinkIcon, Maximize2Icon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PnlSnapshot } from "../../../../src/analytics-contract";
import type { PnlDays } from "../../../../src/web-contract";
import {
  loadPnl,
  lossClass,
  pnlPeriod,
  pnlPeriods,
  pnlSummary,
  retrievedAgo,
  signedUsd,
  useWalletPnl,
  type PnlRow,
  type PnlSummary,
} from "@/lib/wallet-pnl";
import { cn } from "@/lib/utils";
import { SignedBars } from "./nansen-charts";
import { Button } from "./ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";

const pageHash = "#pnl";
const previewDays: PnlDays = 30;
const shortAddress = (value: string) => (/^0x[0-9a-fA-F]{40}$/.test(value) ? `${value.slice(0, 6)}…${value.slice(-4)}` : value);

function usePnlHash() {
  const [open, setOpen] = useState(false);
  const pushed = useRef(false);
  useEffect(() => {
    const sync = () => {
      const next = window.location.hash === pageHash;
      if (!next) pushed.current = false;
      setOpen(next);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return {
    open,
    pushed: () => {
      pushed.current = true;
    },
    close: () => {
      if (window.location.hash !== pageHash) return setOpen(false);
      if (pushed.current) return window.history.back();
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      setOpen(false);
    },
  };
}

export function WalletPnl({ address }: { address: string }) {
  const page = usePnlHash();
  const [preview, setPreview] = useState(false);
  const trigger = useRef<HTMLAnchorElement>(null);
  const quiet = useRef(false);
  useEffect(() => {
    if (!page.open) return;
    setPreview(false);
    quiet.current = true;
  }, [page.open]);
  const prefetch = () => void loadPnl(address, previewDays).catch(() => {});
  return (
    <>
      <HoverCard
        open={preview && !page.open}
        onOpenChange={(next) => {
          if (!next || !quiet.current) setPreview(next);
        }}
        openDelay={400}
        closeDelay={150}
      >
        <HoverCardTrigger asChild>
          <a
            ref={trigger}
            className="pecu-wallet-address mono"
            href={pageHash}
            onPointerEnter={(event) => {
              if (event.pointerType === "touch") return;
              quiet.current = false;
              prefetch();
            }}
            onFocus={prefetch}
            onBlur={() => {
              if (!page.open) quiet.current = false;
            }}
            onClick={() => {
              page.pushed();
              setPreview(false);
            }}
          >
            {shortAddress(address)}
            <span className="sr-only"> P&L</span>
          </a>
        </HoverCardTrigger>
        <HoverCardContent className="pecu pecu-pnl-card" side="bottom" align="end" sideOffset={8} collisionPadding={12}>
          <PnlPreview address={address} onExpand={page.pushed} />
        </HoverCardContent>
      </HoverCard>
      <PnlPage address={address} open={page.open} onClose={page.close} onCloseFocus={() => trigger.current?.focus()} />
    </>
  );
}

function PnlPreview({ address, onExpand }: { address: string; onExpand: () => void }) {
  const pnl = useWalletPnl(address, previewDays, true);
  const snapshot = pnl.value?.snapshot;
  return (
    <div aria-busy={!pnl.value && !pnl.error}>
      <div className="pecu-pnl-card-head">
        <span>P&L · {pnlPeriod(previewDays).long}</span>
        <a className="pecu-pnl-expand" href={pageHash} aria-label="Open full P&L" onClick={onExpand}>
          <Maximize2Icon className="size-4" />
        </a>
      </div>
      {pnl.value ? (
        snapshot ? (
          <PnlPreviewBody snapshot={snapshot} />
        ) : (
          <p className="pecu-pnl-note">Your wallet is not ready yet.</p>
        )
      ) : pnl.error ? (
        <PnlError message={pnl.error} onRetry={pnl.retry} />
      ) : (
        <div className="pecu-pnl-skeleton" role="status">
          <span className="is-total" />
          <span />
          <span />
          <span className="sr-only">Loading P&L…</span>
        </div>
      )}
    </div>
  );
}

export function PnlPreviewBody({ snapshot, now }: { snapshot: PnlSnapshot; now?: number }) {
  const summary = useMemo(() => pnlSummary(snapshot), [snapshot]);
  if (!summary.rows.length)
    return (
      <>
        <p className="pecu-pnl-note">No trades on Base in the last {pnlPeriod(previewDays).long}.</p>
        <PnlSource snapshot={snapshot} now={now} />
      </>
    );
  return (
    <>
      <p className={cn("pecu-pnl-card-total", lossClass(summary.total))}>{signedUsd(summary.total)}</p>
      <dl className="pecu-pnl-card-split">
        <dt>Realized</dt>
        <dd className={lossClass(summary.realized)}>{signedUsd(summary.realized)}</dd>
        <dt>Unrealized</dt>
        <dd className={lossClass(summary.unrealized)}>{signedUsd(summary.unrealized)}</dd>
      </dl>
      <ul className="pecu-pnl-card-movers">
        {summary.rows.slice(0, 3).map((row) => (
          <li key={row.key}>
            <span>{row.symbol}</span>
            <span className={cn("mono", lossClass(row.total))}>{signedUsd(row.total)}</span>
          </li>
        ))}
      </ul>
      <PnlNotes summary={summary} snapshot={snapshot} />
      <PnlSource snapshot={snapshot} now={now} />
    </>
  );
}

function PnlPage({ address, open, onClose, onCloseFocus }: { address: string; open: boolean; onClose: () => void; onCloseFocus: () => void }) {
  const [days, setDays] = useState<PnlDays>(previewDays);
  const pnl = useWalletPnl(address, days, open);
  const snapshot = pnl.value?.snapshot;
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          className="pecu pecu-pnl-page"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onCloseFocus();
          }}
        >
          <div className="pecu-pnl-bar">
            <DialogPrimitive.Close className="pecu-chip pecu-pnl-back" aria-label="Back to chat">
              <ArrowLeftIcon className="size-4" />
            </DialogPrimitive.Close>
            <div className="pecu-pnl-periods" role="group" aria-label="Period">
              {pnlPeriods.map((period) => (
                <button key={period.days} type="button" aria-pressed={period.days === days} onClick={() => setDays(period.days)}>
                  <span aria-hidden="true">{period.short}</span>
                  <span className="sr-only">{period.long}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="pecu-pnl-body" aria-busy={!pnl.value && !pnl.error}>
            <header className="pecu-pnl-heading">
              <DialogPrimitive.Title>P&L</DialogPrimitive.Title>
              <p>
                <span className="mono">{shortAddress(address)}</span>
                {" · "}
                <a href={`https://basescan.org/address/${address}`} target="_blank" rel="noreferrer">
                  Basescan
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              </p>
            </header>
            {pnl.value ? (
              snapshot ? (
                <PnlReport key={days} snapshot={snapshot} days={days} />
              ) : (
                <p className="pecu-pnl-note">Your wallet is not ready yet.</p>
              )
            ) : pnl.error ? (
              <PnlError message={pnl.error} onRetry={pnl.retry} />
            ) : (
              <div className="pecu-pnl-skeleton is-page" role="status">
                <span />
                <span className="is-total" />
                <span className="is-split" />
                <span className="is-chart" />
                <span className="sr-only">Loading P&L…</span>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

const pageRows = 10;

export function PnlReport({ snapshot, days }: { snapshot: PnlSnapshot; days: PnlDays }) {
  const summary = useMemo(() => pnlSummary(snapshot), [snapshot]);
  const [all, setAll] = useState(false);
  const period = pnlPeriod(days).long;
  if (!summary.rows.length)
    return (
      <>
        <p className="pecu-pnl-note">No trades on Base in the last {period}.</p>
        <PnlSource snapshot={snapshot} full />
      </>
    );
  const bars = summary.rows
    .filter((row): row is PnlRow & { total: number } => row.total !== null && Math.abs(row.total) >= 0.005)
    .slice(0, 8)
    .map((row) => ({ label: row.symbol, value: row.total }));
  return (
    <>
      <section className="pecu-pnl-hero" aria-label="Totals">
        <p className="pecu-pnl-hero-label">Total on Base, last {period}</p>
        <p className={cn("pecu-pnl-total", lossClass(summary.total))}>{signedUsd(summary.total)}</p>
        <dl className="pecu-pnl-split">
          <div>
            <dt>Realized</dt>
            <dd className={lossClass(summary.realized)}>{signedUsd(summary.realized)}</dd>
          </div>
          <div>
            <dt>Unrealized</dt>
            <dd className={lossClass(summary.unrealized)}>{signedUsd(summary.unrealized)}</dd>
          </div>
        </dl>
        <PnlNotes summary={summary} snapshot={snapshot} />
      </section>
      {bars.length ? (
        <div className="pecu-pnl-chart" aria-hidden="true">
          <SignedBars rows={bars} />
        </div>
      ) : null}
      <div className="pecu-pnl-table-wrap">
        <table className="pecu-pnl-table">
          <caption className="sr-only">P&L by token</caption>
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col" className="is-part">Realized</th>
              <th scope="col" className="is-part">Unrealized</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {(all ? summary.rows : summary.rows.slice(0, pageRows)).map((row) => (
              <tr key={row.key}>
                <th scope="row">
                  <span className="pecu-pnl-token">
                    <strong>{row.symbol}</strong>
                    <span className="mono">{shortAddress(row.address)}</span>
                  </span>
                </th>
                <td className={cn("is-part", lossClass(row.realized))}>{signedUsd(row.realized)}</td>
                <td className={cn("is-part", lossClass(row.unrealized))}>{signedUsd(row.unrealized)}</td>
                <td>
                  <span className={lossClass(row.total)}>{signedUsd(row.total)}</span>
                  <span className="pecu-pnl-parts">
                    <span className={lossClass(row.realized)}>{signedUsd(row.realized)} realized</span>
                    <span className={lossClass(row.unrealized)}>{signedUsd(row.unrealized)} unrealized</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {summary.rows.length > pageRows ? (
        <Button className="pecu-button pecu-button-quiet pecu-pnl-more" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : "Show all"}
        </Button>
      ) : null}
      <PnlSource snapshot={snapshot} full />
    </>
  );
}

function PnlNotes({ summary, snapshot }: { summary: PnlSummary; snapshot: PnlSnapshot }) {
  if (summary.missing)
    return (
      <p className="pecu-pnl-note">
        Nansen has no price for {summary.missing} {summary.missing === 1 ? "token" : "tokens"}. Missing values are left out of the totals.
      </p>
    );
  return snapshot.partial ? <p className="pecu-pnl-note">Nansen returned part of the history. Totals may be incomplete.</p> : null;
}

function PnlSource({ snapshot, full = false, now }: { snapshot: PnlSnapshot; full?: boolean; now?: number }) {
  return (
    <p className="pecu-pnl-source">
      <a href="https://nansen.ai" target="_blank" rel="noreferrer">
        Data: Nansen
      </a>
      {" · "}
      {full
        ? `Retrieved ${new Date(snapshot.observedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
        : retrievedAgo(snapshot.observedAt, now)}
    </p>
  );
}

function PnlError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="pecu-error pecu-pnl-error" role="alert">
      <span>{message}</span>
      <Button className="pecu-inline-link" onClick={onRetry} size="sm" variant="link">
        Try again
      </Button>
    </div>
  );
}
