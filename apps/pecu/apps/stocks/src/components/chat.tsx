import { NansenChart } from "./nansen-charts";
import { CommandMenu } from "./command-menu";
import { ConnectionRecovery } from "./inference-profile";
import { PreviewCard } from "./preview-card";
import { StockHoldings } from "./stock-holdings";
import { HistoryWindow } from "./history-window";
import { HistoryNavigation } from "./history-navigation";
import { useState, useRef } from "react";
import { ArrowUp, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import type { useAccount } from "../lib/use-account";
import { useCommandMenu } from "../lib/use-command-menu";
import { turnPresentation } from "../lib/turns";
import { confirmationCommand } from "../../../../src/web-contract";
import { MessageResponse } from "./ai-elements/message";
import { StreamedReply } from "./streamed-reply";
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
  const menu = useCommandMenu(draft, setDraft);
  const busyCode = account.inFlight
    ? confirmationCommand(account.inFlight)?.code
    : undefined;
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
            {(message) => {
              const presentation = turnPresentation(
                message,
                account.state?.messages ?? [],
              );
              if (presentation.kind === "command" && !presentation.showReply)
                return null;
              return (
                <div key={message.id}>
                  {presentation.kind === "chat" ? (
                    <div className="flex justify-end mb-4">
                      <div className="message user">{message.text}</div>
                    </div>
                  ) : null}
                  {message.reply ? (
                    <div
                      className={
                        presentation.kind === "command"
                          ? "message assistant pecu-outcome"
                          : "message assistant"
                      }
                    >
                      {message.reply.preview ? null : !(
                          (message.reply.holdings && message.reply.holdingsOnly) || message.reply.analyticsOnly
                        ) ? (
                        <MessageResponse>
                          {message.reply.question?.question ??
                            message.reply.text}
                        </MessageResponse>
                      ) : null}
                      <ConnectionRecovery reply={message.reply} />
                                  {message.reply.analytics?.map((result) => <NansenChart key={result.snapshot.key} snapshot={result.snapshot} />)}
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
                                message.id !==
                                  account.state?.messages.at(-1)?.id
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
                        <div className="pecu pecu-embed">
                          <PreviewCard
                            busy={account.pending}
                            confirming={
                              busyCode === message.reply.preview.code
                            }
                            onSend={(text) => account.send(text)}
                            preview={message.reply.preview}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : account.pending &&
                    account.partial.length &&
                    message.id === account.state?.messages.at(-1)?.id ? (
                    <div className="message assistant" role="status">
                      <StreamedReply paragraphs={account.partial} />
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
              );
            }}
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
      {account.pending && !busyCode ? (
        account.inFlight && account.partial.length ? (
          <div className="message assistant mx-6" role="status">
            <StreamedReply paragraphs={account.partial} />
          </div>
        ) : (
          <p className="muted px-6" role="status">
            Aero is working…
          </p>
        )
      ) : null}
      <div className="pecu pecu-embed pecu-prompt-wrap">
        <CommandMenu menu={menu} />
        <form
          className="chat-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Textarea
            aria-activedescendant={
              menu.open ? menu.optionId(menu.activeIndex) : undefined
            }
            aria-autocomplete="list"
            aria-controls={menu.open ? menu.listboxId : undefined}
            aria-expanded={menu.open}
            aria-label="Message Aero"
            placeholder="Ask about stocks or your wallet…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={menu.onKeyDown}
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
      </div>
    </section>
  );
}
