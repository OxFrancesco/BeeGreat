import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useStickToBottomContext } from "use-stick-to-bottom";

export function HistoryWindow<T extends { id: string }>({
  items,
  scrollRef,
  children,
}: {
  items: T[];
  scrollRef: RefObject<HTMLElement | null>;
  children: (item: T) => ReactNode;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);
  useEffect(() => {
    const node = list.current,
      scroll = scrollRef.current;
    if (!node || !scroll) return;
    setMargin(
      node.getBoundingClientRect().top -
        scroll.getBoundingClientRect().top +
        scroll.scrollTop,
    );
  }, [scrollRef]);
  const virtual = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 260,
    getItemKey: (index) => items[index]!.id,
    overscan: 2,
    scrollMargin: margin,
  });
  return (
    <div
      ref={list}
      data-history-window
      style={{
        height: virtual.getTotalSize(),
        position: "relative",
        flexShrink: 0,
      }}
    >
      {virtual.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={virtual.measureElement}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${row.start - margin}px)`,
            paddingBottom: 18,
          }}
        >
          {children(items[row.index]!)}
        </div>
      ))}
    </div>
  );
}

export function ConversationHistory<T extends { id: string }>(props: {
  items: T[];
  children: (item: T) => ReactNode;
}) {
  const { scrollRef } = useStickToBottomContext();
  return <HistoryWindow {...props} scrollRef={scrollRef} />;
}
