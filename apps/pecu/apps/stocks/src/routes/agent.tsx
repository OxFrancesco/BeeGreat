import { useClerk, useUser, UserButton } from "@clerk/tanstack-react-start";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CopyIcon, MessageSquareIcon, PlusIcon, RotateCcwIcon, Trash2Icon } from "lucide-react";
import { useCallback, useState } from "react";
import { z } from "zod";
import { threadIdSchema, type previewSchema, type WebThread } from "../../../../src/web-contract";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { PecuMascot } from "@/components/pecu-mascot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAccount } from "@/lib/use-account";
import avatar from "@/assets/mascot/avatar.webp?url";

const searchSchema = z.object({ t: threadIdSchema.optional() });

export const Route = createFileRoute("/agent")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Agent | Pecu" },
      {
        name: "description",
        content:
          "Talk to the Pecu agent in the browser. Balances, quotes, swaps, transfers and analytics on Base, with transaction previews unless you enable YOLO.",
      },
    ],
    links: [{ rel: "icon", href: "/pecu-assets/icon-192.png", type: "image/png", sizes: "192x192" }],
  }),
  component: AgentPage,
});

const SUGGESTIONS = [
  "What's my balance?",
  "Quote 0.01 ETH to USDC",
  "Show my Aerodrome positions",
  "Odds of a Fed rate cut on Polymarket?",
  "/aero stocks",
];

type Preview = z.infer<typeof previewSchema>;

function AgentPage() {
  const { user } = useUser();
  const { t } = Route.useSearch();
  return <AgentWorkspace key={`${user?.id ?? "signed-out"}:${t ?? ""}`} threadId={t ?? null} />;
}

function AgentWorkspace({ threadId }: { threadId: string | null }) {
  const { isSignedIn } = useUser();
  const clerk = useClerk();
  const navigate = useNavigate({ from: Route.fullPath });
  const account = useAccount(Boolean(isSignedIn), threadId);
  const [draft, setDraft] = useState("");
  const [inFlight, setInFlight] = useState<string | null>(null);
  const [threadsOpen, setThreadsOpen] = useState(false);
  const signIn = () =>
    void clerk.openSignIn({ fallbackRedirectUrl: threadId ? `/agent?t=${threadId}` : "/agent" });
  const openThread = useCallback(
    (id: string | null) => {
      setThreadsOpen(false);
      void navigate({ search: id ? { t: id } : {} });
    },
    [navigate],
  );
  const newThread = useCallback(() => {
    if (!isSignedIn) return signIn();
    openThread(crypto.randomUUID().slice(0, 8));
  }, [isSignedIn, openThread]);
  const send = useCallback(
    async (text: string, requestId?: string) => {
      if (!isSignedIn) return signIn();
      setInFlight(text);
      try {
        await account.send(text, requestId);
      } finally {
        setInFlight(null);
      }
    },
    [account, isSignedIn],
  );
  const messages = account.state?.messages ?? [];
  const empty = messages.length === 0 && !inFlight;
  const noWallet = Boolean(isSignedIn && account.state && !account.state.wallet);
  const threads = account.state?.threads;
  const threadsSupported = threads !== undefined;
  const threadList = threadsSupported ? (
    <ThreadList
      active={threadId}
      onDelete={(id) => {
        void account.deleteThread(id).then((deleted) => {
          if (deleted && id === threadId) openThread(null);
        });
      }}
      onNew={newThread}
      onOpen={openThread}
      pending={account.pending}
      threads={threads}
    />
  ) : null;

  return (
    <div className="pecu pecu-app">
      {isSignedIn && threadsSupported ? (
        <aside aria-label="Threads" className="pecu-rail">
          <a className="pecu-wordmark" href="/">pecu</a>
          {threadList}
        </aside>
      ) : null}
      <div className="pecu-main">
      <header className="pecu-topbar">
        <a className="pecu-wordmark" href="/">pecu</a>
        {!threadsSupported && <PageNavigation />}
        <div className="pecu-auth">
          {isSignedIn ? (
            <>
              {threadsSupported ? (
              <Dialog onOpenChange={setThreadsOpen} open={threadsOpen}>
                <DialogTrigger asChild>
                  <button className="pecu-chip pecu-threads-toggle" type="button">
                    <MessageSquareIcon className="size-4" />
                    <span>Threads</span>
                  </button>
                </DialogTrigger>
                <DialogContent className="pecu pecu-threads-dialog">
                  <DialogHeader>
                    <DialogTitle>Threads</DialogTitle>
                    <DialogDescription>
                      Each thread is its own conversation with Pecu, with its own previews and
                      YOLO setting.
                    </DialogDescription>
                  </DialogHeader>
                  {threadList}
                </DialogContent>
              </Dialog>
              ) : null}
              {account.state?.wallet ? (
                <a
                  className="pecu-chip mono"
                  href={`https://basescan.org/address/${account.state.wallet}`}
                  rel="noreferrer"
                  target="_blank"
                  title={account.state.wallet}
                >
                  <span className="pecu-dot" />
                  <span>
                    {account.state.wallet.slice(0, 6)}…{account.state.wallet.slice(-4)}
                  </span>
                </a>
              ) : null}
              {account.state?.yolo ? (
                <button
                  className="pecu-chip pecu-chip-warn"
                  disabled={account.pending}
                  onClick={() => void send("/yolo off")}
                  type="button"
                >
                  YOLO on · turn off
                </button>
              ) : null}
              <UserButton />
            </>
          ) : (
            <Button className="pecu-button" onClick={signIn} variant="outline">
              Sign in with X
            </Button>
          )}
        </div>
      </header>

        <main className="pecu-chat">
          <h1 className="sr-only">Pecu agent</h1>
          <Conversation className="pecu-conversation">
            <ConversationContent scrollClassName="pecu-chat-scroll" className={empty ? "pecu-messages is-empty" : "pecu-messages"}>
              {empty ? (
                <ConversationEmptyState className="pecu-empty">
                  <PecuMascot className="pecu-hero-snail" state="idle" />
                  <div className="pecu-empty-copy">
                    <h2>{threadId ? "New thread." : "Hi, I'm Pecu."}</h2>
                    <p>
                      {isSignedIn
                        ? noWallet
                          ? "Your X account has no Pecu wallet yet."
                          : "Ask about your Base wallet, get a quote, or start a swap. Transactions require confirmation unless you enable YOLO."
                        : "Sign in with the X account you use with Pecu. Transactions require confirmation unless you enable YOLO."}
                    </p>
                    {noWallet ? (
                      <p className="pecu-notice">
                        The first message you send to{" "}
                        <a href="https://x.com/BeeGreatAI" rel="noreferrer" target="_blank">
                          @BeeGreatAI
                        </a>{" "}
                        on X creates it. Send <code>/wallet</code>, then come back and reload.
                      </p>
                    ) : null}
                  </div>
                </ConversationEmptyState>
              ) : (
                <>
                  {messages.map((message) => (
                    <div className="pecu-turn" key={message.id}>
                      <Message from="user">
                        <MessageContent className="pecu-bubble-user">
                          <MessageResponse>{message.text}</MessageResponse>
                        </MessageContent>
                      </Message>
                      <Message from="assistant">
                        <div className="pecu-assistant">
                          <img alt="" className="pecu-avatar" src={avatar} />
                          {message.reply ? (
                            <MessageContent className="pecu-bubble-bot">
                              <MessageResponse>
                                {message.reply.preview
                                  ? message.reply.preview.text
                                  : message.reply.text}
                              </MessageResponse>
                              {message.reply.preview ? (
                                <PreviewCard
                                  busy={account.pending}
                                  onSend={send}
                                  preview={message.reply.preview}
                                />
                              ) : null}
                              <MessageActions className="pecu-message-actions">
                                <MessageAction
                                  label="Copy reply"
                                  onClick={() =>
                                    void navigator.clipboard.writeText(
                                      message.reply?.preview?.text ?? message.reply?.text ?? "",
                                    )
                                  }
                                >
                                  <CopyIcon className="size-3.5" />
                                </MessageAction>
                              </MessageActions>
                            </MessageContent>
                          ) : (
                            <MessageContent className="pecu-bubble-bot pecu-bubble-muted">
                              <span>Still working on this one.</span>
                              <Button
                                className="pecu-inline-link"
                                disabled={account.pending}
                                onClick={() =>
                                  void send(message.text, message.id.split(":").at(-1))
                                }
                                size="sm"
                                variant="link"
                              >
                                Check again
                              </Button>
                            </MessageContent>
                          )}
                        </div>
                      </Message>
                    </div>
                  ))}
                  {inFlight ? (
                    <div className="pecu-turn" key="in-flight">
                      <Message from="user">
                        <MessageContent className="pecu-bubble-user">
                          <MessageResponse>{inFlight}</MessageResponse>
                        </MessageContent>
                      </Message>
                      <Message from="assistant">
                        <div className="pecu-assistant pecu-thinking" role="status">
                          <span className="pecu-avatar pecu-avatar-live">
                            <PecuMascot state="thinking" />
                          </span>
                          <Shimmer className="pecu-shimmer" duration={1.6}>
                            Pecu is working on it
                          </Shimmer>
                        </div>
                      </Message>
                    </div>
                  ) : null}
                </>
              )}
            </ConversationContent>
            <ConversationScrollButton className="pecu-scroll-button" />
          </Conversation>

          <div className="pecu-composer">
            {account.error ? (
              <div className="pecu-error" role="alert">
                <span>{account.error}</span>
                {account.retry ? (
                  <Button
                    className="pecu-inline-link"
                    disabled={account.pending}
                    onClick={() => void send(account.retry!.text, account.retry!.requestId)}
                    size="sm"
                    variant="link"
                  >
                    <RotateCcwIcon className="size-3.5" />
                    Retry
                  </Button>
                ) : null}
              </div>
            ) : null}
            {empty ? (
              <Suggestions className="pecu-suggestions">
                {SUGGESTIONS.map((text) => (
                  <Suggestion
                    className="pecu-suggestion"
                    disabled={account.pending}
                    key={text}
                    onClick={(value) => void send(value)}
                    suggestion={text}
                  />
                ))}
              </Suggestions>
            ) : null}
            <PromptInput
              className="pecu-prompt clay"
              onSubmit={({ text }, event) => {
                if (!isSignedIn) return signIn();
                event.currentTarget.reset();
                setDraft("");
                void send(text);
              }}
            >
              <PromptInputBody>
                <PromptInputTextarea
                  aria-label="Message Pecu"
                  className="pecu-textarea"
                  maxLength={4000}
                  onChange={(event) => setDraft(event.currentTarget.value)}
                  placeholder={
                    isSignedIn ? "Ask Pecu about your wallet…" : "Sign in with X to start"
                  }
                  value={draft}
                />
              </PromptInputBody>
              <PromptInputFooter className="pecu-prompt-footer">
                <PromptInputTools>
                  <span className="pecu-prompt-hint">
                    {account.state?.yolo ? "YOLO is on. New transaction requests execute without confirmation." : "Enter to send. Transactions require confirmation."}
                  </span>
                </PromptInputTools>
                <PromptInputSubmit
                  className="pecu-submit"
                  disabled={account.pending || (isSignedIn && !draft.trim())}
                  status={account.pending ? "submitted" : account.error ? "error" : "ready"}
                />
              </PromptInputFooter>
            </PromptInput>

          </div>
        </main>
      </div>
    </div>
  );
}

function ThreadList({
  threads,
  active,
  pending,
  onOpen,
  onNew,
  onDelete,
}: {
  threads: WebThread[];
  active: string | null;
  pending: boolean;
  onOpen: (id: string | null) => void;
  onNew: () => void;
  onDelete: (id: string | null) => void;
}) {
  const [confirming, setConfirming] = useState<string | null | undefined>(undefined);
  const current = threads.some((thread) => thread.id === active)
    ? threads
    : [{ id: active, title: "", createdAt: Date.now(), updatedAt: Date.now(), count: 0 }, ...threads];
  return (
    <div className="pecu-threads">
      <Button className="pecu-button pecu-new-thread" onClick={onNew} type="button">
        <PlusIcon className="size-4" />
        New thread
      </Button>
      <ul className="pecu-thread-list">
        {current.map((thread) => {
          const isActive = thread.id === active;
          const key = thread.id ?? "default";
          const title =
            thread.title || (thread.id === null ? "First conversation" : "New thread");
          return (
            <li className={isActive ? "pecu-thread is-active" : "pecu-thread"} key={key}>
              <button
                aria-current={isActive ? "true" : undefined}
                className="pecu-thread-open"
                onClick={() => onOpen(thread.id)}
                type="button"
              >
                <span className="pecu-thread-title">{title}</span>
                <span className="pecu-thread-meta">
                  {thread.count
                    ? relative(thread.updatedAt)
                    : "Empty"}
                </span>
              </button>
              {thread.count ? (
                confirming === thread.id ? (
                  <span className="pecu-thread-confirm">
                    <button
                      className="pecu-thread-danger"
                      disabled={pending}
                      onClick={() => {
                        setConfirming(undefined);
                        onDelete(thread.id);
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                    <button onClick={() => setConfirming(undefined)} type="button">
                      Keep
                    </button>
                  </span>
                ) : (
                  <button
                    aria-label={`Delete thread ${title}`}
                    className="pecu-thread-delete"
                    onClick={() => setConfirming(thread.id)}
                    type="button"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="pecu-thread-note">
        Deleting a thread removes its history here. Previews you already confirmed stay
        verifiable on Base.
      </p>
      <PageNavigation />
    </div>
  );
}

function PageNavigation() {
  return (
        <nav aria-label="Page navigation" className="pecu-nav">
          <a href="/#tools">Tools</a>
          <a href="/aero/cli">Aero</a>
          <a href="/aero/stocks">Stocks</a>
          <a aria-current="page" href="/agent">Agent</a>
        </nav>
  );
}

function relative(timestamp: number) {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function PreviewCard({
  preview,
  busy,
  onSend,
}: {
  preview: Preview;
  busy: boolean;
  onSend: (text: string) => Promise<void>;
}) {
  const expires = new Date(preview.expiresAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const labels: Record<Preview["state"], string> = {
    pending: `Waiting for you · expires ${expires}`,
    executing: "Submitted · waiting for the receipt",
    succeeded: "Executed and verified on Base",
    failed: "Failed",
    cancelled: "Cancelled",
    expired: "Expired without confirmation",
  };
  return (
    <Confirmation className="pecu-confirmation" state={preview.state}>
      <ConfirmationTitle className="pecu-confirmation-title">
        <span className="mono pecu-code">{preview.code}</span>
        <span>{labels[preview.state]}</span>
      </ConfirmationTitle>
      <ConfirmationRequest>
        <ConfirmationActions>
          {preview.state === "pending" ? (
            <ConfirmationAction
              className="pecu-button"
              disabled={busy}
              onClick={() => void onSend(`/cancel ${preview.code}`)}
              variant="outline"
            >
              Cancel
            </ConfirmationAction>
          ) : null}
          <ConfirmationAction
            className="pecu-button pecu-button-primary"
            disabled={busy}
            onClick={() => void onSend(`/confirm ${preview.code}`)}
          >
            {preview.state === "executing" ? "Check transaction" : "Confirm transaction"}
          </ConfirmationAction>
        </ConfirmationActions>
      </ConfirmationRequest>
      <ConfirmationAccepted>
        <span className="pecu-confirmation-note">
          Pecu read the receipt and checked the user operation itself succeeded.
        </span>
      </ConfirmationAccepted>
      <ConfirmationRejected>
        <span className="pecu-confirmation-note">
          {preview.state === "failed"
            ? "Execution encountered an error. Check the reply and transaction status before trying again."
            : "Nothing was sent. Ask again if you still want to do this."}
        </span>
      </ConfirmationRejected>
    </Confirmation>
  );
}
