import { ClerkProvider } from "@clerk/tanstack-react-start";
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
          <Analytics />
        </ClerkProvider>
        <Scripts />
      </body>
    </html>
  );
}
