import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ProfileShell } from "@/components/profile/profile-shell";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile | Pecu" },
      { name: "description", content: "Create Safes with several owners, approve their transactions and manage owners and spending limits on Base." },
    ],
    links: [
      { rel: "icon", href: "/pecu-assets/favicon-32.png", type: "image/png", sizes: "32x32" },
      { rel: "icon", href: "/pecu-assets/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/pecu-assets/apple-touch-icon.png", sizes: "180x180" },
    ],
  }),
  component: ProfileLayout,
});

function ProfileLayout() {
  return (
    <ProfileShell>
      <Outlet />
    </ProfileShell>
  );
}
