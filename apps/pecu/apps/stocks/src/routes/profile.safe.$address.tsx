import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { SafeView } from "@/components/profile/safe-view";
import { safeTabs } from "@/lib/profile";

export const Route = createFileRoute("/profile/safe/$address")({
  validateSearch: z.object({ tab: z.enum(safeTabs).optional() }),
  component: SafePage,
});

function SafePage() {
  const { address } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <SafeView
      key={address}
      address={address}
      tab={tab ?? "transactions"}
      onTab={(next) => void navigate({ search: next === "transactions" ? {} : { tab: next }, replace: true, resetScroll: false })}
    />
  );
}
