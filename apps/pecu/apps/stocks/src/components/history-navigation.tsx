import { Button } from "./ui/button";
import type { useAccount } from "../lib/use-account";
export function HistoryNavigation({
  account,
}: {
  account: ReturnType<typeof useAccount>;
}) {
  const older = account.state?.olderCursor,
    newer = account.state?.newerCursor;
  if (!older && !newer && !account.paging) return null;
  return (
    <nav className="history-navigation" aria-label="Message history">
      <Button
        variant="ghost"
        size="sm"
        disabled={!older || account.paging}
        onClick={() => older && void account.pageMessages({ before: older })}
      >
        Earlier messages
      </Button>
      {newer ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            disabled={account.paging}
            onClick={() => void account.pageMessages({ after: newer })}
          >
            Later messages
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={account.paging}
            onClick={() => void account.pageMessages()}
          >
            Latest
          </Button>
        </>
      ) : null}
      {account.paging ? <span role="status">Loading…</span> : null}
    </nav>
  );
}
