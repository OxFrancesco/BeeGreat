import { useClerk, useUser } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { MenuIcon, MessageSquareIcon, TelescopeIcon } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { ResearchList } from "../../../../../src/research-contract";
import { researchActive, researchPeriod, researchStateText, useResearches } from "@/lib/researches";
import { AccountMenu } from "../account-menu";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";

type ResearchContextValue = Readonly<{ list: ResearchList | null; error: string | null; refresh: () => Promise<void> }>;
const ResearchContext = createContext<ResearchContextValue>({ list: null, error: null, refresh: async () => {} });
export const useResearchList = () => useContext(ResearchContext);

function ResearchNav({ list, onNavigate }: { list: ResearchList | null; onNavigate?: () => void }) {
  return (
    <nav className="pecu-profile-nav" aria-label="Research">
      <div className="pecu-profile-group">
        <Link className="pecu-profile-link" to="/agent" onClick={onNavigate}>
          <MessageSquareIcon className="size-4" aria-hidden="true" />
          Chat
        </Link>
        <Link className="pecu-profile-link" to="/researches" activeOptions={{ exact: true }} activeProps={{ "aria-current": "page" }} onClick={onNavigate}>
          <TelescopeIcon className="size-4" aria-hidden="true" />
          Research
        </Link>
      </div>
      {list?.researches.length ? (
        <ul className="pecu-profile-group">
          {list.researches.map((research) => (
            <li key={research.code}>
              <Link className="pecu-profile-link pecu-research-link" to="/researches/$code" params={{ code: research.code }} activeProps={{ "aria-current": "page" }} onClick={onNavigate}>
                <span className="pecu-profile-link-name">{research.chain.name} · {researchPeriod(research)}</span>
                <span className="pecu-profile-link-meta">{researchActive(research) ? researchStateText(research) : research.state === "completed" ? research.window : researchStateText(research)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}

export function ResearchShell({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();
  const clerk = useClerk();
  const { list, error, load } = useResearches(Boolean(isSignedIn));
  const [navOpen, setNavOpen] = useState(false);
  const signIn = () => void clerk.openSignIn({ fallbackRedirectUrl: window.location.pathname });
  return (
    <ResearchContext.Provider value={{ list, error, refresh: load }}>
      <div className="pecu pecu-app pecu-profile-app">
        {isSignedIn ? (
          <aside className="pecu-rail" aria-label="Research navigation">
            <a className="pecu-wordmark" href="/">pecu</a>
            <ResearchNav list={list} />
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
                  <DialogTitle>Research</DialogTitle>
                  <DialogDescription className="sr-only">Your research reports.</DialogDescription>
                  <ResearchNav list={list} onNavigate={() => setNavOpen(false)} />
                </DialogContent>
              </Dialog>
            ) : null}
            <a className="pecu-wordmark" href="/">pecu</a>
            <div className="pecu-auth">
              {isSignedIn ? <AccountMenu /> : isLoaded ? <Button className="pecu-button" onClick={signIn} variant="outline">Sign in</Button> : null}
            </div>
          </header>
          <main className="pecu-profile">
            {isSignedIn ? children : isLoaded ? (
              <div className="pecu-profile-body">
                <div className="pecu-profile-empty-state">
                  <h1>Research</h1>
                  <p>Sign in with Google, or with the X account you use with Pecu, to start research and read your reports.</p>
                  <Button className="pecu-button pecu-button-primary" onClick={signIn}>Sign in</Button>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
    </ResearchContext.Provider>
  );
}
