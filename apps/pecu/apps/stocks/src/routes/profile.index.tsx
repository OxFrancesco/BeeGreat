import { createFileRoute } from "@tanstack/react-router";
import { ProfileHome } from "@/components/profile/profile-home";

export const Route = createFileRoute("/profile/")({
  component: ProfileHome,
});
