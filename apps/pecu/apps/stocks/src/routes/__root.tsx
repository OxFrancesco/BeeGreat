import { ClerkProvider, useUser } from "@clerk/tanstack-react-start";
import { useEffect, useRef } from "react";
import { historyStorage } from "../lib/history-storage";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import styles from "../styles.css?url";
import { Analytics } from "../components/analytics";
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "darkreader-lock" },
      { name: "color-scheme", content: "light" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Stocks | Aero" },
    ],
    links: [
      { rel: "stylesheet", href: styles },
    ],
  }),
  component: Root,
  notFoundComponent: () => (
    <main className="p-8">
      <h1>Page not found</h1>
      <a href="/stocks">Back to stocks</a>
    </main>
  ),
});
function Root() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClerkProvider
          publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
          signInFallbackRedirectUrl="/stocks"
          signUpFallbackRedirectUrl="/stocks"
        >
          <Outlet />
          <HistoryAccount />
          <Analytics />
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  );
}
function HistoryAccount() {
  const { user, isLoaded } = useUser();
  const previous = useRef(user?.id);
  useEffect(() => {
    if (!isLoaded) return;
    if (previous.current && previous.current !== user?.id) void historyStorage.remove(previous.current);
    previous.current = user?.id;
  }, [user?.id, isLoaded]);
  return null;
}
