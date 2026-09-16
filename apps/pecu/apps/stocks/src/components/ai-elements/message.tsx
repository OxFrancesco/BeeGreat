// Ported from vercel/ai-elements packages/elements/src/message.tsx.
// Dropped branches and the Streamdown response renderer; Pecu replies are
// plain text from the X agent, so MessageResponse lays that text out compactly
// instead of rendering markdown.
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className,
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export type MessageActionProps = ComponentProps<typeof Button> & {
  label: string;
};

export const MessageAction = ({
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps) => (
  <Button size={size} title={label} type="button" variant={variant} {...props}>
    {children}
    <span className="sr-only">{label}</span>
  </Button>
);

const basescan = /^https:\/\/basescan\.org\/(tx|address)\/0x[0-9a-fA-F]+$/;
const url = /(https?:\/\/[^\s]+)/g;

/** Inline text with bare URLs turned into links. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(url).map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a href={part} key={index} rel="noreferrer" target="_blank">
            {basescan.test(part)
              ? part.includes("/tx/")
                ? "View transaction on Base"
                : "View on Basescan"
              : part.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}

/**
 * A block is text between blank lines. Pecu's agent writes lists as blocks of
 * two lines (a title, then figures), so three or more of those become one tight
 * two-column list instead of a tall stack of paragraphs. Runs of bare Basescan
 * links collapse into one numbered line.
 */
function renderBlocks(text: string): ReactNode[] {
  const blocks = text
    .trim()
    .split(/\n[ \t]*\n+/)
    .map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((lines) => lines.length);
  if (blocks.length >= 3 && blocks.every((lines) => lines.length === 2)) {
    return [
      <dl className="msg-list" key="list">
        {blocks.map(([title, detail], index) => (
          <div className="msg-list-row" key={index}>
            <dt>
              <Inline text={title} />
            </dt>
            <dd>
              <Inline text={detail} />
            </dd>
          </div>
        ))}
      </dl>,
    ];
  }
  return blocks.map((lines, blockIndex) => {
    const nodes: ReactNode[] = [];
    let links: string[] = [];
    const flushLinks = () => {
      if (!links.length) return;
      nodes.push(
        <span className="msg-links" key={`links-${nodes.length}`}>
          {links.length === 1 ? "" : `${links.length} transactions: `}
          {links.map((href, index) => (
            <a href={href} key={href} rel="noreferrer" target="_blank">
              {links.length === 1 ? "View transaction on Base" : `#${index + 1}`}
            </a>
          ))}
        </span>,
      );
      links = [];
    };
    for (const line of lines) {
      if (basescan.test(line) && line.includes("/tx/")) {
        links.push(line);
        continue;
      }
      flushLinks();
      nodes.push(
        <span className="msg-line" key={`line-${nodes.length}`}>
          <Inline text={line} />
        </span>,
      );
    }
    flushLinks();
    return (
      <p className="msg-block" key={blockIndex}>
        {nodes}
      </p>
    );
  });
}

export type MessageResponseProps = HTMLAttributes<HTMLDivElement> & {
  children: string;
};

export const MessageResponse = ({
  children,
  className,
  ...props
}: MessageResponseProps) => (
  <div className={cn("msg-response break-words", className)} {...props}>
    {renderBlocks(children)}
  </div>
);

export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({
  className,
  children,
  ...props
}: MessageToolbarProps) => (
  <div
    className={cn("mt-2 flex w-full items-center justify-between gap-4", className)}
    {...props}
  >
    {children}
  </div>
);
