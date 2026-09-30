import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ResearchShell } from "@/components/researches/research-shell";

export const Route = createFileRoute("/researches")({
  head: () => ({
    meta: [
      { title: "Research | Pecu" },
      { name: "description", content: "Reports that explain why a chain moved, from chain data, Nansen flows and posts on X." },
    ],
    links: [
      { rel: "icon", href: "/pecu-assets/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/pecu-assets/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/pecu-assets/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  component: ResearchLayout,
});

function ResearchLayout() {
  return (
    <ResearchShell>
      <Outlet />
    </ResearchShell>
  );
}
