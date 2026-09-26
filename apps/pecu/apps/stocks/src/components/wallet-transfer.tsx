import { SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { portfolioSchema, portfolioTokenSchema, type Portfolio } from "../../../../src/portfolio-contract";
import type { LinkedWallet } from "../../../../src/linked-wallet-contract";
import { balanceAmount } from "../lib/balance-amount";
import { useLinkedWallets } from "../lib/linked-wallets";
import { errorText, sameAddress, shortAddress } from "../lib/profile";
import { request } from "../lib/use-account";
import { exceedsBalance, reviewTransfer, transferAttempt, transferDraftSchema, type TransferAttempt } from "../lib/wallet-transfer";
import { Button } from "./ui/button";
import { Field, ProfileDialog } from "./profile/profile-dialogs";
import { openConnectWallet } from "./profile/connect-wallet";

export function WalletTransfer({ pecuWallet, signer, onReviewed }: { pecuWallet: string; signer: string | null; onReviewed: (threadId: string) => void }) {
  const [open, setOpen] = useState(false);
  const { wallets, error } = useLinkedWallets(true);
  return <>
    <button className="pecu-wallet-copy" type="button" aria-label="Send tokens" title="Send tokens" onClick={() => setOpen(true)}><SendIcon size={16} /></button>
    {open && <TransferForm pecuWallet={pecuWallet} initialWallet={signer ?? pecuWallet} wallets={wallets ?? []} walletsError={error} onClose={() => setOpen(false)} onReviewed={(threadId) => { setOpen(false); onReviewed(threadId); }} />}
  </>;
}

export function TransferForm({ pecuWallet, initialWallet, wallets, walletsError, onClose, onReviewed }: {
  pecuWallet: string;
  initialWallet: string;
  wallets: readonly LinkedWallet[];
  walletsError?: string | null;
  onClose: () => void;
  onReviewed: (threadId: string) => void;
}) {
  const options = [{ address: pecuWallet, name: "Pecu wallet" }, ...wallets.filter((wallet) => !sameAddress(wallet.address, pecuWallet)).map((wallet) => ({ address: wallet.address, name: wallet.name ?? "Your wallet" }))];
  const [from, setFrom] = useState(initialWallet);
  const [to, setTo] = useState("");
  const [token, setToken] = useState("eth");
  const [customToken, setCustomToken] = useState("");
  const [amount, setAmount] = useState("");
  const [tokens, setTokens] = useState(["eth", "usdc"]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const sending = useRef(false);
  const attempt = useRef<TransferAttempt | null>(null);
  const reference = token === "custom" ? customToken.trim() : token;
  const destinations = options.filter((wallet) => !sameAddress(wallet.address, from));
  const destination = destinations.find((wallet) => sameAddress(wallet.address, to))?.address ?? destinations[0]?.address ?? "";
  useEffect(() => {
    let extra: string[] = [];
    try { extra = z.array(portfolioTokenSchema.catch("")).parse(JSON.parse(localStorage.getItem(`pecu:portfolio:${from.toLowerCase()}`) ?? "[]")).filter(Boolean); } catch { /* Balances work without local storage. */ }
    setTokens([...new Set(["eth", "usdc", ...extra.map((value) => value.toLowerCase())])].slice(0, 19));
  }, [from]);
  useEffect(() => {
    const controller = new AbortController();
    setPortfolio(null);
    setReadError("");
    setLoading(true);
    const refs = [...new Set([...tokens, ...(portfolioTokenSchema.safeParse(reference).success ? [reference] : [])])];
    const timer = setTimeout(() => {
      const query = new URLSearchParams([...refs.map((value) => ["token", value]), ["wallet", from]]);
      request(`portfolio?${query}`, undefined, controller.signal).then((raw) => {
        if (!controller.signal.aborted) setPortfolio(portfolioSchema.parse(raw));
      }).catch((reason) => { if (!controller.signal.aborted) setReadError(errorText(reason)); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, token === "custom" ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [from, tokens, reference, token, revision]);
  const balance = portfolio?.wallet && sameAddress(portfolio.wallet, from) ? portfolio.balances.find((row) => row.reference.toLowerCase() === reference.toLowerCase()) : undefined;
  const overBalance = balance?.amount != null && exceedsBalance(amount.trim(), balance.amount);
  const draft = transferDraftSchema.safeParse({ from, to: destination, token: balance?.address ?? reference, amount });
  const sourceOwned = options.some((wallet) => sameAddress(wallet.address, from));
  const canReview = sourceOwned && draft.success && !loading && !readError && !balance?.error && balance?.amount != null && !overBalance;
  const submit = async () => {
    if (sending.current || !canReview || !draft.success) return;
    sending.current = true;
    setBusy(true);
    setError("");
    if (!attempt.current || JSON.stringify(attempt.current.draft) !== JSON.stringify(draft.data)) attempt.current = transferAttempt(draft.data);
    try { onReviewed(await reviewTransfer(attempt.current, pecuWallet)); }
    catch (reason) { setError(errorText(reason)); }
    finally { sending.current = false; setBusy(false); }
  };
  return <ProfileDialog open title="Send tokens" description="Transfer between your wallets on Base." onClose={onClose} busy={busy}>
    <form className="pecu-profile-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <Field label="From">{(id) => <select id={id} className="pecu-input" value={from} title={from} disabled={busy} onChange={(event) => { setFrom(event.target.value); setToken("eth"); setAmount(""); setError(""); }}>{options.map((wallet) => <option key={wallet.address} value={wallet.address}>{wallet.name} · {shortAddress(wallet.address)}</option>)}</select>}</Field>
      <Field label="To">{(id) => <select id={id} className="pecu-input" value={destination} title={destination} disabled={busy || !destinations.length} onChange={(event) => setTo(event.target.value)}>{!destinations.length && <option value="">Link another wallet</option>}{destinations.map((wallet) => <option key={wallet.address} value={wallet.address}>{wallet.name} · {shortAddress(wallet.address)}</option>)}</select>}</Field>
      {!destinations.length && <Button type="button" variant="ghost" onClick={() => { onClose(); openConnectWallet({ link: true }); }}>Link a wallet</Button>}
      <Field label="Token">{(id) => <select id={id} className="pecu-input" value={token} disabled={busy} onChange={(event) => { setToken(event.target.value); setAmount(""); }}>{tokens.map((value) => <option key={value} value={value}>{portfolio?.balances.find((row) => row.reference === value)?.symbol ?? (value.startsWith("0x") ? shortAddress(value) : value.toUpperCase())}</option>)}<option value="custom">Other token…</option></select>}</Field>
      {token === "custom" && <Field label="Token ticker or Base contract address">{(id) => <input id={id} className="pecu-input" value={customToken} maxLength={64} disabled={busy} autoComplete="off" onChange={(event) => setCustomToken(event.target.value)} placeholder="WETH or 0x…" />}</Field>}
      <Field label="Amount" hint={loading ? "Loading balance…" : balance?.amount != null ? `Available: ${balanceAmount(balance.amount)} ${balance.symbol}` : balance?.error ?? "Balance unavailable"}>{(id) => <input id={id} className="pecu-input" inputMode="decimal" autoComplete="off" placeholder="0" maxLength={100} value={amount} disabled={busy} aria-invalid={overBalance || undefined} onChange={(event) => setAmount(event.target.value)} />}</Field>
      {overBalance && <p className="pecu-error" role="alert">Amount exceeds your balance.</p>}
      {(error || readError || walletsError) && <p className="pecu-error" role="alert">{error || readError || walletsError}</p>}
      {readError && <Button type="button" variant="ghost" onClick={() => setRevision((value) => value + 1)}>Retry balance</Button>}
      <div className="pecu-profile-form-actions">
        <Button type="submit" className="pecu-button pecu-button-primary" disabled={busy || !canReview}>{busy ? "Preparing review…" : "Review transfer"}</Button>
        <Button type="button" className="pecu-button pecu-button-quiet" disabled={busy} onClick={onClose}>Cancel</Button>
      </div>
    </form>
  </ProfileDialog>;
}
