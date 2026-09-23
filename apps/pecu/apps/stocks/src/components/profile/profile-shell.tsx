import { useClerk, useUser } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { MenuIcon, MessageSquareIcon, ShieldIcon, UserRoundIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { ProfileOverview } from "../../../../../src/safe-profile-contract";
import { ProfileContext, useProfileOverview } from "@/lib/profile";
import { AccountMenu } from "../account-menu";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";
import { ConnectWallet } from "./connect-wallet";

function ProfileNav({ overview, onNavigate }: { overview: ProfileOverview | null; onNavigate?: () => void }) {
  return (
    <nav className="pecu-profile-nav" aria-label="Profile">
      <div className="pecu-profile-group">
        <Link className="pecu-profile-link" to="/agent" onClick={onNavigate}>
          <MessageSquareIcon className="size-4" aria-hidden="true" />
          Chat
        </Link>
        <Link className="pecu-profile-link" to="/profile" activeOptions={{ exact: true }} activeProps={{ "aria-current": "page" }} onClick={onNavigate}>
          <UserRoundIcon className="size-4" aria-hidden="true" />
          Profile
        </Link>
      </div>
      {overview?.orgs.map((org) => (
        <div className="pecu-profile-group" key={org.id}>
          <p className="pecu-profile-group-head">{org.name}</p>
          {org.safes.length ? (
            <ul>
              {org.safes.map((safe) => (
                <li key={safe.address}>
                  <Link className="pecu-profile-link" to="/profile/safe/$address" params={{ address: safe.address }} activeProps={{ "aria-current": "page" }} onClick={onNavigate}>
                    <ShieldIcon className="size-4" aria-hidden="true" />
                    <span className="pecu-profile-link-name">{safe.name}</span>
                    {safe.status === "creating" ? <span className="pecu-profile-link-meta">Creating</span> : safe.status === "not-created" ? <span className="pecu-profile-link-meta">Not created</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="pecu-profile-link-empty">No Safes yet</p>
          )}
        </div>
      ))}
    </nav>
  );
}

export function ProfileShell({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const clerk = useClerk();
  const overview = useProfileOverview(Boolean(isSignedIn));
  const [navOpen, setNavOpen] = useState(false);
  const signIn = () => void clerk.openSignIn({ fallbackRedirectUrl: window.location.pathname });
  return (
    <ProfileContext.Provider value={{ overview: overview.value, refreshOverview: overview.refresh }}>
      <div className="pecu pecu-app pecu-profile-app">
        {isSignedIn ? (
          <aside className="pecu-rail" aria-label="Profile navigation">
            <a className="pecu-wordmark" href="/">pecu</a>
            <ProfileNav overview={overview.value} />
          </aside>
        ) : null}
        <div className="pecu-main">
          <header className="pecu-topbar">
            {isSignedIn ? (
              <Dialog open={navOpen} onOpenChange={setNavOpen}>
                <button className="pecu-chip pecu-profile-nav-toggle" type="button" aria-label="Open navigation" onClick={() => setNavOpen(true)}>
                  <MenuIcon className="size-4" />
                </button>
                <DialogContent animate={false} className="pecu pecu-threads-dialog pecu-profile-nav-dialog">
                  <DialogTitle>Profile</DialogTitle>
                  <DialogDescription className="sr-only">Your wallet, organizations and Safes.</DialogDescription>
                  <ProfileNav overview={overview.value} onNavigate={() => setNavOpen(false)} />
                </DialogContent>
              </Dialog>
            ) : null}
            <a className="pecu-wordmark" href="/">pecu</a>
            <div className="pecu-auth">
              {isSignedIn ? (
                <>
                  <ConnectWallet />
                  <AccountMenu />
                </>
              ) : isLoaded ? (
                <Button className="pecu-button" onClick={signIn} variant="outline">Sign in</Button>
              ) : null}
            </div>
          </header>
          <main className="pecu-profile">
            {isSignedIn ? (
              overview.error && !overview.value ? (
                <div className="pecu-profile-body">
                  <div className="pecu-error" role="alert">
                    <span>{overview.error}</span>
                    <Button className="pecu-inline-link" variant="link" size="sm" onClick={() => void overview.refresh()}>Try again</Button>
                  </div>
                </div>
              ) : children
            ) : isLoaded ? (
              <div className="pecu-profile-body">
                <div className="pecu-profile-empty-state">
                  <h1>Your Safes</h1>
                  <p>Sign in with Google, or with the X account you use with Pecu, to create Safes and approve their transactions.</p>
                  <Button className="pecu-button pecu-button-primary" onClick={signIn}>Sign in</Button>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </ProfileContext.Provider>
  );
}
