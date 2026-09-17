import { UserButton } from "@clerk/tanstack-react-start";
import { CpuIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { inferenceStatusSchema, type InferenceStatus } from "../../../../src/web-contract";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { openChatGptConnection } from "../lib/inference-navigation";
import { chatGptUserCode, needsChatGptConnection } from "../../../../src/inference-recovery";


export function PecuUserButton() {
  const profile = useRef<HTMLDivElement>(null);
  return (
    <div ref={profile}>
      <UserButton>
        <UserButton.MenuItems>
          <UserButton.Action label="ChatGPT connection" labelIcon={<CpuIcon size={16} />} onClick={openChatGptConnection} />
          <UserButton.Action label="manageAccount" />
          <UserButton.Action label="signOut" />
        </UserButton.MenuItems>
        <UserButton.UserProfilePage label="ChatGPT connection" labelIcon={<CpuIcon size={16} />} url="ai-connection">
          <InferenceProfile />
        </UserButton.UserProfilePage>
      </UserButton>
      <ChatGptConnectionDialog onCloseFocus={() => profile.current?.querySelector("button")?.focus()} />
    </div>
  );
}

export function ChatGptConnectionDialog({ onCloseFocus }: { onCloseFocus?: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sync = () => setOpen(window.location.hash === "#chatgpt");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next && window.location.hash === "#chatgpt") window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }}>
      <DialogContent animate={false} className="pecu pecu-connection-dialog" aria-describedby={undefined} aria-labelledby="pecu-inference-title" onCloseAutoFocus={onCloseFocus ? (event) => { event.preventDefault(); onCloseFocus(); } : undefined}>
        <InferenceProfile inDialog />
      </DialogContent>
    </Dialog>
  );
}

export function ConnectionRecovery({ reply }: { reply: { text: string; recovery?: "connect_chatgpt" } }) {
  if (!needsChatGptConnection(reply)) return null;
  return <Button className="pecu-button mt-3" onClick={openChatGptConnection}>Connect ChatGPT</Button>;
}

export function LoginCode({ code }: { code: string }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => { setCopyState("idle"); }, [code]);
  return <div>
    <div className="pecu-inference-code">
      <code className="select-all font-mono text-xl" aria-label="ChatGPT sign-in code">{code}</code>
      <Button className="pecu-button" variant="outline" onClick={async () => {
        try { await navigator.clipboard.writeText(code); setCopyState("copied"); }
        catch { setCopyState("failed"); }
      }}>{copyState === "copied" ? "Copied" : "Copy code"}</Button>
    </div>
    <span role="status" className={copyState === "failed" ? "pecu-inference-error" : "sr-only"}>{copyState === "failed" ? "Couldn't copy. Select the code and copy it manually." : copyState === "copied" ? "Code copied." : ""}</span>
  </div>;
}

export function InferenceProfile({ inDialog = false }: { inDialog?: boolean }) {
  const Title = inDialog ? DialogTitle : "h2";
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
  const userCode = status?.login ? status.login.userCode ?? chatGptUserCode(status.login.instructions) : undefined;
  return (
    <section className="pecu pecu-inference" aria-labelledby="pecu-inference-title" aria-busy={busy}>
      <Title className="sr-only" id="pecu-inference-title">ChatGPT connection</Title>

      {status ? <>

        {status.loginState === "expired" ? <p role="status">Sign-in expired. Connect ChatGPT to try again.</p> : null}
        {status.loginState === "failed" ? <p role="alert">ChatGPT sign-in didn't finish. Try connecting again.</p> : null}
        {status.login ? <div className="pecu-inference-login">
          {userCode ? <><p>Enter this code in ChatGPT:</p><LoginCode key={userCode} code={userCode} /></> : <p>{status.login.instructions}</p>}
          <a href={status.login.url} target="_blank" rel="noopener noreferrer" className="pecu-button pecu-inference-link">Continue with ChatGPT</a>
          <p className="pecu-inference-waiting" role="status">Waiting for you to finish signing in.</p>
          <Button className="pecu-button pecu-inference-cancel" variant="ghost" disabled={busy} onClick={() => void refresh("disconnect")}>Cancel sign-in</Button>
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
      </> : null}
      {!status && !error ? <p role="status">Checking connection…</p> : null}
      {error ? <div className="pecu-inference-error"><p role="alert">{error}</p><Button className="pecu-button" variant="outline" disabled={busy} onClick={() => void refresh()}>Try again</Button></div> : null}
    </section>
  );
}
