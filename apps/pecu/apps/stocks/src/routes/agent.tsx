import { CommandMenu } from "../components/command-menu";
import { ConnectionRecovery } from "../components/inference-profile";
import { CopyButton } from "../components/copy-button";
import { PreviewCard } from "../components/preview-card";
import { StockHoldings } from "../components/stock-holdings";
import { ConversationHistory } from "@/components/history-window";
import { HistoryNavigation } from "@/components/history-navigation";
import { PecuUserButton } from "../components/inference-profile";
import { useClerk, useUser } from "@clerk/tanstack-react-start";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  MessageSquareIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { z } from "zod";
import {
  confirmationCommand,
  threadIdSchema,
  type WebThread,
} from "../../../../src/web-contract";
import { useCommandMenu } from "../lib/use-command-menu";
import { turnPresentation } from "../lib/turns";
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
  MessagePlain,
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
import { WalletChip } from "@/components/wallet-chip";
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
import { useChatGptConnected } from "@/lib/inference-navigation";
import { needsChatGptConnection } from "../../../../src/inference-recovery";
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
    links: [
      {
        rel: "icon",
        href: "/pecu-assets/favicon-32.png",
        type: "image/png",
        sizes: "32x32",
      },
      {
        rel: "icon",
        href: "/pecu-assets/icon-192.png",
        type: "image/png",
        sizes: "192x192",
      },
      {
        rel: "apple-touch-icon",
        href: "/pecu-assets/apple-touch-icon.png",
        sizes: "180x180",
      },
    ],
  }),
  component: AgentPage,
});

const SUGGESTIONS = [
  "What's my balance?",
  "Quote 0.01 ETH to USDC",
  "Show my Aerodrome positions",
  "Odds of a Fed rate cut on Polymarket?",
  "/stocks",
];

function AgentPage() {
  const { user } = useUser();
  const { t } = Route.useSearch();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMotion, setSidebarMotion] = useState(true);
  const toggleSidebar = useCallback((animate = true) => {
    setSidebarMotion(animate);
    setSidebarCollapsed((value) => !value);
  }, []);
  return (
    <AgentWorkspace
      sidebarMotion={sidebarMotion}
      sidebarCollapsed={sidebarCollapsed}
      toggleSidebar={toggleSidebar}
      key={user?.id ?? "signed-out"}
      threadId={t ?? null}
    />
  );
}

function AgentWorkspace({
  threadId,
  sidebarCollapsed,
  sidebarMotion,
  toggleSidebar,
}: {
  threadId: string | null;
  sidebarCollapsed: boolean;
  sidebarMotion: boolean;
  toggleSidebar: (animate?: boolean) => void;
}) {
  const sidebarToggleRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  const sidebarTransition = {
    duration: sidebarMotion && !reducedMotion ? 0.2 : 0,
    ease: [0.77, 0, 0.175, 1] as const,
  };
  const { isSignedIn } = useUser();
  const clerk = useClerk();
  const navigate = useNavigate({ from: Route.fullPath });
  const account = useAccount(Boolean(isSignedIn), threadId);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const draftKey = threadId ?? "default";
  const draft = drafts[draftKey] ?? "";
  const setDraft = (value: string) =>
    setDrafts((current) => ({ ...current, [draftKey]: value }));
  const menu = useCommandMenu(draft, setDraft);
  const inFlight = account.inFlight;
  const busyCode = inFlight ? confirmationCommand(inFlight)?.code : undefined;
  const [threadsOpen, setThreadsOpen] = useState(false);
  const signIn = () =>
    void clerk.openSignIn({
      fallbackRedirectUrl: `${threadId ? `/agent?t=${threadId}` : "/agent"}${window.location.hash === "#chatgpt" ? "#chatgpt" : ""}`,
    });
  const openThread = useCallback(
    (id: string | null) => {
      setThreadsOpen(false);
      void navigate({ search: id ? { t: id } : {}, resetScroll: false });
    },
    [navigate],
  );
  const newThread = useCallback(() => {
    if (!isSignedIn) return signIn();
    const id = crypto.randomUUID().slice(0, 8);
    account.prepareNewThread(id);
    openThread(id);
  }, [isSignedIn, openThread, account.prepareNewThread]);
  const send = useCallback(
    async (text: string, requestId?: string, answerTo?: string) => {
      if (!isSignedIn) return signIn();
      await account.send(text, requestId, undefined, answerTo);
    },
    [account, isSignedIn],
  );
  const messages = account.state?.messages ?? [];
  const loadingConversation = account.loading && !inFlight;
  // The mascot marks the latest visible reply; fully hidden command turns do not count.
  const mascotMessageId =
    account.atLatest && !inFlight
      ? [...messages].reverse().find((message) => {
          const presentation = turnPresentation(message, messages);
          return presentation.kind === "chat" || presentation.showReply;
        })?.id
      : undefined;
  const empty = !account.loading && account.atLatest && messages.length === 0 && !inFlight;
  const noWallet = Boolean(
    isSignedIn && account.state && !account.state.wallet,
  );
  const webSender = account.state?.senderKind === "web";
  const threads = account.state?.threads;
  const threadsSupported = threads !== undefined;
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || !isSignedIn || !account.threadsLoaded) return;
    landed.current = true;
    // Opening /agent lands on the most recently active thread; the unnamed original conversation only when it is the latest.
    const latest = account.threadPage.threads[0];
    if (threadId === null && latest?.id) void navigate({ search: { t: latest.id }, replace: true, resetScroll: false });
  }, [isSignedIn, threadId, account.threadsLoaded, account.threadPage.threads, navigate]);
  const chatGptConnected = useChatGptConnected();
  const previousConnection = useRef(chatGptConnected);
  useEffect(() => {
    const before = previousConnection.current;
    previousConnection.current = chatGptConnected;
    // A sign-in that finished on this page answers the question that asked for it, instead of leaving the inline ask.
    if (before !== false || chatGptConnected !== true) return;
    const last = messages.at(-1);
    if (!last?.reply || !last.canRetry || !needsChatGptConnection(last.reply) || !account.atLatest || account.pending) return;
    void account.regenerate(last);
  }, [chatGptConnected, messages, account]);
  useEffect(() => {
    if (!isSignedIn || !threadsSupported) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        !event.metaKey ||
        !event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.key.toLowerCase() !== "s" ||
        event.isComposing
      )
        return;
      event.preventDefault();
      if (event.repeat) return;
      if (window.matchMedia("(max-width: 900px)").matches) {
        setThreadsOpen((open) => !open);
      } else {
        if (document.getElementById("pecu-thread-sidebar")?.contains(document.activeElement)) {
          sidebarToggleRef.current?.focus();
        }
        toggleSidebar(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSignedIn, threadsSupported, toggleSidebar]);
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
      onPrefetch={account.prefetch}
      pending={account.pending}
      threads={threads}
      account={account}
    />
  ) : null;

  return (
    <div className="pecu pecu-app" data-sidebar-collapsed={sidebarCollapsed}>
      {isSignedIn && threadsSupported ? (
        <motion.aside
          id="pecu-thread-sidebar"
          aria-label="Threads"
          className="pecu-rail"
          inert={sidebarCollapsed}
          aria-hidden={sidebarCollapsed}
          initial={false}
          animate={{ transform: sidebarCollapsed ? "translateX(-100%)" : "translateX(0%)" }}
          transition={sidebarTransition}
        >
          <a className="pecu-wordmark" href="/">
            pecu
          </a>
          {threadList}
        </motion.aside>
      ) : null}
      <div className="pecu-main">
        <header className="pecu-topbar">
          {isSignedIn && threadsSupported ? (
            <motion.button
              layout="position"
              layoutDependency={sidebarCollapsed}
              transition={{ layout: sidebarTransition }}
              ref={sidebarToggleRef}
              className="pecu-chip pecu-sidebar-toggle"
              type="button"
              aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
              aria-expanded={!sidebarCollapsed}
              aria-controls="pecu-thread-sidebar"
              aria-keyshortcuts="Meta+Shift+S"
              title={`${sidebarCollapsed ? "Open" : "Close"} sidebar (⌘⇧S)`}
              onClick={(event) => toggleSidebar(event.detail !== 0)}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpenIcon className="size-4" />
              ) : (
                <PanelLeftCloseIcon className="size-4" />
              )}
            </motion.button>
          ) : null}
          <a className="pecu-wordmark" href="/">
            pecu
          </a>
          {!threadsSupported && <PageNavigation />}
          <div className="pecu-auth">
            {isSignedIn ? (
              <>
                {threadsSupported ? (
                  <Dialog onOpenChange={setThreadsOpen} open={threadsOpen}>
                    <DialogTrigger asChild>
                      <button
                        aria-label="Threads"
                        className="pecu-chip pecu-threads-toggle"
                        type="button"
                      >
                        <MessageSquareIcon className="size-4" />
                        <span>Threads</span>
                      </button>
                    </DialogTrigger>
                    <DialogContent animate={false} className="pecu pecu-threads-dialog">
                      <DialogHeader>
                        <DialogTitle>Threads</DialogTitle>
                        <DialogDescription>
                          Each thread is its own conversation with Pecu, with
                          its own previews and YOLO setting.
                        </DialogDescription>
                      </DialogHeader>
                      {threadList}
                    </DialogContent>
                  </Dialog>
                ) : null}
                {account.state?.wallet ? (
                  <WalletChip key={account.state.wallet} address={account.state.wallet} />
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
                <PecuUserButton />
              </>
            ) : (
              <Button
                className="pecu-button"
                onClick={signIn}
                variant="outline"
              >
                Sign in
              </Button>
            )}
          </div>
        </header>

        <motion.main className="pecu-chat" layout="position" layoutDependency={sidebarCollapsed} transition={{ layout: sidebarTransition }}>
          <h1 className="sr-only">Pecu agent</h1>
          <HistoryNavigation account={account} />
          <Conversation
            className="pecu-conversation"
            aria-busy={loadingConversation && !account.error}
            key={`${threadId ?? "default"}:${account.state?.messages[0]?.id ?? "empty"}`}
            initial="instant"
            resize="instant"
          >
            {loadingConversation ? (
              <div className="pecu-conversation-status" role="status">
                {account.error ? (
                  <p className="pecu-bubble-muted">Could not load this conversation.</p>
                ) : (
                  <>
                    <PecuMascot className="pecu-conversation-loader" state="loading" />
                    <span className="sr-only">Loading conversation…</span>
                  </>
                )}
              </div>
            ) : null}
            <ConversationContent
              scrollClassName="pecu-chat-scroll"
              className={empty ? "pecu-messages is-empty" : "pecu-messages"}
            >
              {loadingConversation ? null : empty ? (
                <ConversationEmptyState className="pecu-empty">
                  <PecuMascot className="pecu-hero-snail" state="idle" />
                  <div className="pecu-empty-copy">
                    <h2>{threadId ? "New thread." : "Hi, I'm Pecu."}</h2>
                    <p>
                      {isSignedIn
                        ? noWallet
                          ? webSender
                            ? "Your Base wallet is created with your first message."
                            : "Your X account has no Pecu wallet yet."
                          : "Ask about your Base wallet, get a quote, or start a swap. Transactions require confirmation unless you enable YOLO."
                        : "Sign in with Google, or with the X account you use with Pecu. Transactions require confirmation unless you enable YOLO."}
                    </p>
                    {noWallet && !webSender ? (
                      <p className="pecu-notice">
                        The first message you send to{" "}
                        <a
                          href="https://x.com/BeeGreatAI"
                          rel="noreferrer"
                          target="_blank"
                        >
                          @BeeGreatAI
                        </a>{" "}
                        on X creates it. Send <code>/wallet</code>, then come
                        back and reload.
                      </p>
                    ) : null}
                  </div>
                </ConversationEmptyState>
              ) : (
                <>
                  {!messages.length && !inFlight ? <p className="pecu-bubble-muted">No messages on this page.</p> : null}
                  <ConversationHistory items={messages}>
                    {(message) => {
                      const presentation = turnPresentation(message, messages);
                      if (
                        presentation.kind === "command" &&
                        !presentation.showReply
                      )
                        return null;
                      const reply = message.reply;
                      const copyText = reply
                        ? reply.preview
                          ? `${reply.preview.title ? `${reply.preview.title}\n` : ""}${reply.preview.text}`
                          : reply.question
                            ? `${reply.question.question}${reply.question.options
                                .map((option, index) => `\n${index + 1}. ${option}`)
                                .join("")}`
                            : reply.text
                        : "";
                      const hasMascot =
                        message.id === mascotMessageId &&
                        presentation.kind === "chat";
                      return (
                        <div className="pecu-turn" key={message.id}>
                          {presentation.kind === "chat" ? (
                            <Message from="user">
                              <MessageContent className="pecu-bubble-user">
                                <MessagePlain>{message.text}</MessagePlain>
                              </MessageContent>
                              <MessageActions className="pecu-message-actions">
                                <CopyButton
                                  label="Copy message"
                                  text={message.text}
                                />
                              </MessageActions>
                            </Message>
                          ) : null}
                          <Message from="assistant">
                            <div
                              className={
                                (hasMascot
                                  ? "pecu-assistant has-mascot"
                                  : "pecu-assistant") +
                                (presentation.kind === "command"
                                  ? " pecu-outcome"
                                  : "")
                              }
                            >
                              {hasMascot ? (
                                <img
                                  alt=""
                                  className="pecu-avatar"
                                  src={avatar}
                                />
                              ) : null}
                              {reply ? (
                                <MessageContent className="pecu-bubble-bot">
                                  {reply.preview ? null : !(
                                      reply.holdings && reply.holdingsOnly
                                    ) ? (
                                    <MessageResponse>
                                      {reply.question?.question ?? reply.text}
                                    </MessageResponse>
                                  ) : null}
                                  <ConnectionRecovery reply={reply} />
                                  {reply.holdings ? (
                                    <StockHoldings {...reply.holdings} />
                                  ) : null}
                                  {reply.question?.options.length ? (
                                    <div
                                      className="flex flex-wrap gap-2 mt-3"
                                      role="group"
                                      aria-label="Answer Pecu"
                                    >
                                      {reply.question.options.map((option) => (
                                        <Button
                                          key={option}
                                          variant="outline"
                                          size="sm"
                                          disabled={
                                            !account.atLatest ||
                                            account.pending ||
                                            message.id !==
                                              account.state?.messages.at(-1)
                                                ?.id
                                          }
                                          onClick={() =>
                                            void send(
                                              option,
                                              undefined,
                                              message.id,
                                            )
                                          }
                                        >
                                          {option}
                                        </Button>
                                      ))}
                                    </div>
                                  ) : null}
                                  {reply.preview ? (
                                    <PreviewCard
                                      busy={account.pending}
                                      confirming={
                                        busyCode === reply.preview.code
                                      }
                                      onSend={send}
                                      preview={reply.preview}
                                    />
                                  ) : null}
                                  <MessageActions className="pecu-message-actions">
                                    <CopyButton
                                      label="Copy reply"
                                      text={copyText}
                                    />
                                    {account.atLatest &&
                                    message.canRetry &&
                                    message.id === messages.at(-1)?.id ? (
                                      <MessageAction
                                        label="Retry reply"
                                        disabled={account.pending}
                                        onClick={() =>
                                          void account.regenerate(message)
                                        }
                                      >
                                        <RotateCcwIcon className="size-3.5" />
                                      </MessageAction>
                                    ) : null}
                                  </MessageActions>
                                </MessageContent>
                              ) : (
                                <MessageContent className="pecu-bubble-bot pecu-bubble-muted">
                                  <span role="status">
                                    {account.pending
                                      ? "Pecu is answering…"
                                      : "Waiting for Pecu…"}
                                  </span>
                                  {!account.pending ? (
                                    <Button
                                      className="pecu-inline-link"
                                      disabled={account.pending}
                                      onClick={() =>
                                        void send(
                                          message.text,
                                          message.id.split(":").at(-1),
                                        )
                                      }
                                      size="sm"
                                      variant="link"
                                    >
                                      Resume response
                                    </Button>
                                  ) : null}
                                </MessageContent>
                              )}
                            </div>
                          </Message>
                        </div>
                      );
                    }}
                  </ConversationHistory>
                  {inFlight && !busyCode ? (
                    <div className="pecu-turn" key="in-flight">
                      <Message from="user">
                        <MessageContent className="pecu-bubble-user">
                          <MessagePlain>{inFlight}</MessagePlain>
                        </MessageContent>
                      </Message>
                      <Message from="assistant">
                        <div
                          className="pecu-assistant has-mascot pecu-thinking"
                          role="status"
                        >
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
            {!loadingConversation ? <ConversationScrollButton className="pecu-scroll-button" /> : null}
          </Conversation>

          <div className="pecu-composer">
            {account.error ? (
              <div className="pecu-error" role="alert">
                <span>{account.error}</span>
                {account.retry ? (
                  <Button
                    className="pecu-inline-link"
                    disabled={account.pending}
                    onClick={() =>
                      void account.send(
                        account.retry!.text,
                        account.retry!.requestId,
                        account.retry!.retryOf,
                        account.retry!.answerTo,
                      )
                    }
                    size="sm"
                    variant="link"
                  >
                    <RotateCcwIcon className="size-3.5" />
                    Retry
                  </Button>
                ) : account.loading ? (
                  <Button
                    className="pecu-inline-link"
                    onClick={() =>
                      void account
                        .reload()
                        .catch((error) =>
                          account.setError(
                            error instanceof Error
                              ? error.message
                              : "Could not load this conversation.",
                          ),
                        )
                    }
                    size="sm"
                    variant="link"
                  >
                    Retry loading
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
            <div className="pecu-prompt-wrap">
              <CommandMenu menu={menu} />
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
                    aria-activedescendant={
                      menu.open ? menu.optionId(menu.activeIndex) : undefined
                    }
                    aria-autocomplete="list"
                    aria-controls={menu.open ? menu.listboxId : undefined}
                    aria-expanded={menu.open}
                    aria-label="Message Pecu"
                    className="pecu-textarea"
                    maxLength={4000}
                    onChange={(event) => setDraft(event.currentTarget.value)}
                    onKeyDown={menu.onKeyDown}
                    placeholder={
                      isSignedIn
                        ? "Ask Pecu about your wallet…"
                        : "Sign in to start"
                    }
                    value={draft}
                  />
                </PromptInputBody>
              <PromptInputFooter className="pecu-prompt-footer">
                <PromptInputTools>
                  <span className="pecu-prompt-hint">
                    {account.state?.yolo
                      ? "YOLO is on. New transaction requests execute without confirmation."
                      : "Enter to send. Transactions require confirmation."}
                  </span>
                </PromptInputTools>
                <PromptInputSubmit
                  className="pecu-submit"
                  disabled={
                    account.pending ||
                    account.loading ||
                    (isSignedIn && !draft.trim())
                  }
                  status={
                    account.pending
                      ? "submitted"
                      : account.error
                        ? "error"
                        : "ready"
                  }
                />
              </PromptInputFooter>
              </PromptInput>
            </div>
          </div>
        </motion.main>
      </div>
    </div>
  );
}

function ThreadList({
  threads,
  account,
  active,
  pending,
  onOpen,
  onPrefetch,
  onNew,
  onDelete,
}: {
  threads: WebThread[];
  account: ReturnType<typeof useAccount>;
  active: string | null;
  pending: boolean;
  onOpen: (id: string | null) => void;
  onPrefetch: (id: string | null) => void;
  onNew: () => void;
  onDelete: (id: string | null) => void;
}) {
  const [confirming, setConfirming] = useState<string | null | undefined>(
    undefined,
  );
  const current = threads.some((thread) => thread.id === active)
    ? threads
    : [
        account.state?.thread ?? {
          id: active,
          title: "",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          count: 0,
        },
        ...threads,
      ];
  return (
    <div className="pecu-threads">
      <Button
        className="pecu-button pecu-new-thread"
        onClick={onNew}
        type="button"
      >
        <PlusIcon className="size-4" />
        New thread
      </Button>
      <ul className="pecu-thread-list">
        {current.map((thread) => {
          const isActive = thread.id === active;
          const key = thread.id ?? "default";
          const title =
            thread.title ||
            (thread.id === null ? "First conversation" : "New thread");
          return (
            <li
              className={isActive ? "pecu-thread is-active" : "pecu-thread"}
              key={key}
            >
              <button
                aria-current={isActive ? "true" : undefined}
                className="pecu-thread-open"
                onClick={() => onOpen(thread.id)}
                onMouseEnter={() => onPrefetch(thread.id)}
                onFocus={() => onPrefetch(thread.id)}
                onTouchStart={() => onPrefetch(thread.id)}
                type="button"
              >
                <span className="pecu-thread-title">{title}</span>
                <span className="pecu-thread-meta">
                  {thread.count ? relative(thread.updatedAt) : "Empty"}
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
                    <button
                      onClick={() => setConfirming(undefined)}
                      type="button"
                    >
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
      <nav className="history-navigation" aria-label="Thread pages">
        {account.threadPage.olderCursor ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={account.threadsLoading}
            onClick={() =>
              void account.loadThreads({
                before: account.threadPage.olderCursor!,
              })
            }
          >
            Older threads
          </Button>
        ) : null}
        {account.threadPage.newerCursor ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={account.threadsLoading}
              onClick={() =>
                void account.loadThreads({
                  after: account.threadPage.newerCursor!,
                })
              }
            >
              Newer threads
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={account.threadsLoading}
              onClick={() => void account.loadThreads()}
            >
              Recent
            </Button>
          </>
        ) : null}
      </nav>
      {account.threadsError ? (
        <div role="alert">
          {account.threadsError}
          <Button variant="link" onClick={() => void account.loadThreads()}>
            Retry
          </Button>
        </div>
      ) : null}
      <p className="pecu-thread-note">
        Deleting a thread removes its history here. Previews you already
        confirmed stay verifiable on Base.
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
      <a aria-current="page" href="/agent">
        Agent
      </a>
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
