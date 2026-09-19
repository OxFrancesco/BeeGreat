import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useUser } from "@clerk/tanstack-react-start";
import { webSenderId } from "../../../../src/web-identity";

export function Analytics() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { user, isLoaded } = useUser();
  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    void import("../../../../src/browser-analytics").then(async ({ identifyAnalytics, trackPage }) => {
      if (!active) return;
      await identifyAnalytics(user ? webSenderId(user.id, user.externalAccounts) : null);
      if (active) trackPage(pathname);
    }).catch(() => {});
    return () => { active = false; };
  }, [user, isLoaded, pathname]);
  return null;
}
