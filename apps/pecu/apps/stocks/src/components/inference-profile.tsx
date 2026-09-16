import { UserButton } from "@clerk/tanstack-react-start";
import { CpuIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { inferenceStatusSchema, type InferenceStatus } from "../../../../src/web-contract";
import { Button } from "./ui/button";

export function PecuUserButton() {
  return (
    <UserButton>
      <UserButton.UserProfilePage label="AI connection" labelIcon={<CpuIcon size={16} />} url="ai-connection">
        <InferenceProfile />
      </UserButton.UserProfilePage>
    </UserButton>
  );
}

export function InferenceProfile() {
  const [status, setStatus] = useState<InferenceStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const refresh = useCallback(async (action?: "connect" | "disconnect") => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/aero/stocks/api/inference${action ? `-${action}` : ""}`, {
        method: action ? "POST" : "GET",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(action ? "Could not update your connection. Wait for any reply to finish, then try again." : "Could not check your connection. Try again.");
      const next = inferenceStatusSchema.parse(await response.json());
      if (mounted.current) { setStatus(next); setConfirmDisconnect(false); }
    } catch {
      if (mounted.current) setError(action ? "Could not update your connection. Wait for any reply to finish, then try again." : "Could not check your connection. Try again.");
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, [refresh]);
  useEffect(() => {
    if (!status?.login) return;
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [status?.login, refresh]);
  return (
    <section className="pecu pecu-inference" aria-labelledby="pecu-inference-title" aria-busy={busy}>
      <h2 id="pecu-inference-title">AI connection</h2>
      <p>Use your ChatGPT subscription for Pecu's AI replies, here and in X chat.</p>
      {status ? <>
        <dl>
          <div><dt>ChatGPT</dt><dd>{status.connected ? "Connected" : "Not connected"}</dd></div>
          <div><dt>Model</dt><dd>{status.model}</dd></div>
          <div><dt>Reasoning</dt><dd className="capitalize">{status.reasoning}</dd></div>
          <div><dt>Runs through</dt><dd>OpenCode</dd></div>
          <div><dt>Last AI request</dt><dd>{status.lastResponse ? <>{status.lastResponse.ok ? "Provider responded" : "Provider returned an error"}<time dateTime={new Date(status.lastResponse.at).toISOString()}>{new Date(status.lastResponse.at).toLocaleString()}</time></> : "No requests yet"}</dd></div>
        </dl>
        {status.loginState === "expired" ? <p role="status">Sign-in expired. Connect ChatGPT to try again.</p> : null}
        {status.loginState === "failed" ? <p role="alert">ChatGPT sign-in didn't finish. Try connecting again.</p> : null}
        {status.login ? <div className="pecu-inference-login" role="status">
          <p>{status.login.instructions}</p>
          <a href={status.login.url} target="_blank" rel="noopener noreferrer" className="pecu-button pecu-inference-link">Continue with ChatGPT</a>
          <p>Waiting for you to finish signing in.</p>
          <Button className="pecu-button" variant="outline" disabled={busy} onClick={() => void refresh("disconnect")}>Cancel sign-in</Button>
        </div> : null}
        {!status.connected && !status.login ? <Button className="pecu-button" disabled={busy} onClick={() => void refresh("connect")}>Connect ChatGPT</Button> : null}
        {status.connected ? <>
          {confirmDisconnect ? <div className="pecu-inference-login">
            <p>Disconnect ChatGPT? AI replies will stop until you reconnect. Your wallet and wallet commands will still work.</p>
            <div className="pecu-inference-actions">
              <Button className="pecu-button" variant="outline" disabled={busy} onClick={() => setConfirmDisconnect(false)}>Keep connected</Button>
              <Button className="pecu-button" disabled={busy} onClick={() => void refresh("disconnect")}>Disconnect</Button>
            </div>
          </div> : <Button className="pecu-button" variant="outline" disabled={busy} onClick={() => setConfirmDisconnect(true)}>Disconnect ChatGPT</Button>}
        </> : null}
        <p className="pecu-inference-note">Your connection is used only for your Pecu account. ChatGPT usage limits still apply. Remaining usage isn't available here.</p>
      </> : null}
      {error ? <p role="alert">{error}</p> : null}
      <div className="pecu-inference-actions" aria-live="polite">
        <Button className="pecu-button" variant="outline" disabled={busy} onClick={() => void refresh()}>{busy ? "Checking…" : "Refresh"}</Button>
        {status ? <span>Checked {new Date(status.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> : null}
      </div>
    </section>
  );
}
