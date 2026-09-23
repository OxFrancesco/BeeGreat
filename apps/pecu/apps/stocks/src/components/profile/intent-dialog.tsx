import { useEffect, useState } from "react";
import type { ProfileIntent } from "../../../../../src/safe-profile-contract";
import { confirmationCommand } from "../../../../../src/web-contract";
import { errorText, newRequestId, profileAction } from "@/lib/profile";
import { PreviewCard } from "../preview-card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";

export function IntentDialog({ intent, onClose }: { intent: ProfileIntent | null; onClose: () => void }) {
  const [current, setCurrent] = useState(intent);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    setCurrent(intent);
    setMessage(null);
  }, [intent]);
  const send = async (text: string) => {
    const command = confirmationCommand(text);
    if (!command || !current) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await profileAction({ op: command.kind === "confirm" ? "intent-confirm" : "intent-cancel", requestId: newRequestId(), code: command.code });
      if (result.intent) setCurrent(result.intent);
      const state = result.intent?.preview.state;
      if (result.message && state !== "succeeded" && state !== "cancelled") setMessage(result.message);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={intent !== null} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="pecu pecu-profile-dialog pecu-intent-dialog">
        <DialogTitle className="sr-only">{current?.preview.title ?? "Review transaction"}</DialogTitle>
        <DialogDescription className="sr-only">Review the details, then confirm with your Pecu wallet.</DialogDescription>
        {current ? <PreviewCard preview={current.preview} busy={busy} confirming={busy} onSend={send} /> : null}
        <p className={message ? "pecu-profile-message" : "sr-only"} role="status">{message ?? ""}</p>
      </DialogContent>
    </Dialog>
  );
}
