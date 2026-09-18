import { useEffect, useRef } from "react";
import type { useCommandMenu } from "../lib/use-command-menu";

export function CommandMenu({
  menu,
}: {
  menu: ReturnType<typeof useCommandMenu>;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [menu.activeIndex]);
  if (!menu.open) return null;
  return (
    <div
      className="pecu-command-menu"
      id={menu.listboxId}
      ref={listRef}
      role="listbox"
    >
      {menu.items.map((item, index) => (
        <div
          aria-selected={index === menu.activeIndex}
          className="pecu-command-item"
          id={menu.optionId(index)}
          key={item.command}
          onClick={() => menu.select(item)}
          onMouseDown={(event) => event.preventDefault()}
          onMouseEnter={() => menu.setActiveIndex(index)}
          role="option"
        >
          <span className="mono pecu-command-name">{item.command}</span>
          {item.args ? (
            <span className="pecu-command-args">{item.args}</span>
          ) : null}
          <span className="pecu-command-summary">{item.summary}</span>
        </div>
      ))}
    </div>
  );
}
