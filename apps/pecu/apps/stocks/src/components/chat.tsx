import { ConnectionRecovery } from "./inference-profile";
import { StockHoldings } from "./stock-holdings";
import { HistoryWindow } from "./history-window";
import { HistoryNavigation } from "./history-navigation";
import { useState, useRef } from "react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import type { useAccount } from "../lib/use-account";
import { MessageResponse } from "./ai-elements/message";
export function Chat({
  account,
  signedIn,
  signIn,
}: {
  account: ReturnType<typeof useAccount>;
  signedIn: boolean;
  signIn: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState("");
  async function submit() {
    if (!draft.trim()) return;
    if (!signedIn) {
      signIn();
      return;
    }
    const text = draft.trim();
    setDraft("");
    await account.send(text);
  }
  return (
    <section className="chat-panel" aria-label="Agent chat">
      <div className="chat-header">
        <h2>Ask Aero</h2>
        {account.state?.yolo ? (
          <span className="error">
            YOLO on
            <Button
              variant="link"
              onClick={() => void account.send("/yolo off")}
            >
              Turn off
            </Button>
          </span>
        ) : null}
      </div>
      <HistoryNavigation account={account} />
      {!account.state?.messages.length ? (
        <>
          <div className="empty-chat">
            <p>
              Ask about your holdings, buy a stock, or rebalance your basket.
            </p>
          </div>
          <div className="suggestions">
            {["Show my stock holdings", "Check my USDC balance"].map((text) => (
              <Button
                key={text}
                variant="outline"
                onClick={() => (signedIn ? void account.send(text) : signIn())}
              >
                {text}
              </Button>
            ))}
          </div>
        </>
      ) : (
        <div className="messages" aria-live="polite" ref={scrollRef}>
          <HistoryWindow
            items={account.state.messages}
            scrollRef={scrollRef}
            key={account.state.messages[0]?.id}
          >
            {(message) => (
              <div key={message.id}>
                <div className="flex justify-end mb-4">
                  <div className="message user">{message.text}</div>
                </div>
                {message.reply ? (
                  <div className="message assistant">
                    {!(message.reply.holdings && message.reply.holdingsOnly) ? (
                      <MessageResponse>
                        {message.reply.preview
                          ? message.reply.preview.text
                          : (message.reply.question?.question ?? message.reply.text)}
                      </MessageResponse>
                    ) : null}
                    <ConnectionRecovery reply={message.reply} />
                    {message.reply.holdings ? (
                      <StockHoldings {...message.reply.holdings} />
                    ) : null}
                    {message.reply.question?.options.length ? (
                      <div
                        className="flex flex-wrap gap-2 mt-3"
                        role="group"
                        aria-label="Answer Pecu"
                      >
                        {message.reply.question.options.map((option) => (
                          <Button
                            key={option}
                            variant="outline"
                            size="sm"
                            disabled={
                              !account.atLatest ||
                              account.pending ||
                              message.id !== account.state?.messages.at(-1)?.id
                            }
                            onClick={() =>
                              void account.answer(message.id, option)
                            }
                          >
                            {option}
                          </Button>
                        ))}
                      </div>
                    ) : null}
                    {account.atLatest &&
                    message.canRetry &&
                    message.id === account.state?.messages.at(-1)?.id ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Retry reply"
                        disabled={account.pending}
                        onClick={() => void account.regenerate(message)}
                      >
                        <RotateCcw size={14} />
                      </Button>
                    ) : null}
                    {message.reply.preview ? (
                      <div className="preview">
                        <span className="muted">
                          {message.reply.preview.state === "pending"
                            ? `Expires ${new Date(message.reply.preview.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : message.reply.preview.state}
                        </span>
                        <div className="preview-actions">
                          {["pending", "executing"].includes(
                            message.reply.preview.state,
                          ) ? (
                            <Button
                              disabled={account.pending}
                              onClick={() =>
                                void account.send(
                                  `/confirm ${message.reply!.preview!.code}`,
                                )
                              }
                            >
                              {message.reply.preview.state === "executing"
                                ? "Check transaction"
                                : "Confirm transaction"}
                            </Button>
                          ) : null}
                          {message.reply.preview.state === "pending" ? (
                            <Button
                              disabled={account.pending}
                              variant="outline"
                              onClick={() =>
                                void account.send(
                                  `/cancel ${message.reply!.preview!.code}`,
                                )
                              }
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="muted">
                    <span role="status">
                      {account.pending
                        ? "Pecu is answering…"
                        : "Waiting for Pecu…"}
                    </span>
                    {!account.pending ? (
                      <Button
                        variant="link"
                        disabled={account.pending}
                        onClick={() =>
                          void account.send(
                            message.text,
                            message.id.split(":").at(-1),
                          )
                        }
                      >
                        Resume response
                      </Button>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </HistoryWindow>
        </div>
      )}
      {account.error ? (
        <div className="error m-4" role="alert">
          {account.error}
          {account.retry ? (
            <Button
              variant="link"
              disabled={account.pending}
              onClick={() =>
                void account.send(
                  account.retry!.text,
                  account.retry!.requestId,
                  account.retry!.retryOf,
                  account.retry!.answerTo,
                )
              }
            >
              <RotateCcw size={14} />
              Retry request
            </Button>
          ) : null}
        </div>
      ) : null}
      {account.pending ? (
        <p className="muted px-6" role="status">
          Aero is working…
        </p>
      ) : null}
      <form
        className="chat-compose"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <Textarea
          aria-label="Message Aero"
          placeholder="Ask about stocks or your wallet…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={4000}
        />
        <Button
          type="submit"
          size="icon"
          className="h-11 w-11 rounded-xl"
          aria-label="Send message"
          disabled={account.pending || !draft.trim()}
        >
          <ArrowUp size={19} />
        </Button>
      </form>
    </section>
  );
}
