import { WalletPortfolio } from "../wallet-portfolio";
import { useClerk } from "@clerk/tanstack-react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRightIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import type { ProfileIntent, ProfileOrg } from "../../../../../src/safe-profile-contract";
import { profileAction, shortAddress, useProfile } from "@/lib/profile";
import { AccountAvatar } from "../account-avatar";
import { useAccountIdentity } from "../account-menu";
import { Button } from "../ui/button";
import { AddressLine } from "./address-line";
import { IntentDialog } from "./intent-dialog";
import { AddSafeDialog, ConfirmDialog, NameDialog } from "./profile-dialogs";

const statusText = { ready: null, creating: "Creating", "not-created": "Not created" } as const;

function OrgCard({ org, onAdd, onRename, onDelete }: { org: ProfileOrg; onAdd: () => void; onRename: () => void; onDelete: () => void }) {
  return (
    <article className="pecu-org-card" aria-labelledby={`org-${org.id}`}>
      <header className="pecu-org-head">
        <h3 id={`org-${org.id}`}>{org.name}</h3>
        <div className="pecu-owner-actions">
          <Button className="pecu-button pecu-button-quiet" aria-label={`Rename ${org.name}`} onClick={onRename}><PencilIcon className="size-4" /></Button>
          <Button className="pecu-button pecu-button-quiet" aria-label={`Delete ${org.name}`} onClick={onDelete}><Trash2Icon className="size-4" /></Button>
        </div>
      </header>
      {org.safes.length ? (
        <ul className="pecu-org-safes">
          {org.safes.map((safe) => (
            <li key={safe.address}>
              <Link className="pecu-org-safe" to="/profile/safe/$address" params={{ address: safe.address }}>
                <span className="pecu-org-safe-name">{safe.name}</span>
                <span className="mono pecu-org-safe-address">{shortAddress(safe.address)}</span>
                {statusText[safe.status] ? <span className="pecu-org-safe-status">{statusText[safe.status]}</span> : null}
                <ChevronRightIcon className="size-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pecu-profile-empty">No Safes yet.</p>
      )}
      <Button className="pecu-button pecu-org-add" onClick={onAdd}><PlusIcon className="size-4" />Add Safe</Button>
    </article>
  );
}

export function ProfileHome() {
  const { overview, refreshOverview } = useProfile();
  const account = useAccountIdentity();
  const clerk = useClerk();
  const navigate = useNavigate();
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [addTo, setAddTo] = useState<ProfileOrg | null>(null);
  const [renaming, setRenaming] = useState<ProfileOrg | null>(null);
  const [deleting, setDeleting] = useState<ProfileOrg | null>(null);
  const [intent, setIntent] = useState<{ value: ProfileIntent; safe: string } | null>(null);
  if (!overview) {
    return (
      <div className="pecu-profile-body">
        <div className="pecu-pnl-skeleton is-page" role="status">
          <span />
          <span className="is-total" />
          <span className="is-split" />
          <span className="sr-only">Loading your profile…</span>
        </div>
      </div>
    );
  }
  const openAdd = (orgId: string) => {
    const org = overview.orgs.find((item) => item.id === orgId);
    if (org) setAddTo(org);
  };
  return (
    <div className="pecu-profile-body">
      <section className="pecu-wallet-card" aria-labelledby="pecu-profile-name">
        <div className="pecu-profile-identity">
          <AccountAvatar account={account} size="profile" />
          <div className="pecu-safe-title">
            <h1 id="pecu-profile-name">{account.name}</h1>
            {account.handle ? <p className="pecu-profile-handle">{account.handle}</p> : null}
          </div>
          <Button className="pecu-button pecu-profile-manage" onClick={() => clerk.openUserProfile()}>Manage account</Button>
        </div>
        <div className="pecu-profile-wallet">
          <h2>Pecu wallet</h2>
          {overview.wallet ? (
            <AddressLine address={overview.wallet} explorer />
          ) : (
            <p className="pecu-profile-note">
              {overview.senderKind === "web" ? "Your Base wallet is created with your first message to Pecu or your first Safe action." : "Your X account has no Pecu wallet yet. Send /wallet to @BeeGreatAI on X, then reload."}
            </p>
          )}
          {overview.wallet ? <p className="pecu-profile-note">{overview.senderKind === "x" ? "The same wallet Pecu uses in your X chats." : "The wallet for this sign-in. It is separate from any X wallet."}</p> : null}
          {overview.wallet ? <WalletPortfolio address={overview.wallet} /> : null}
        </div>
      </section>
      <section className="pecu-profile-section" aria-labelledby="pecu-orgs">
        <div className="pecu-profile-section-head">
          <h2 id="pecu-orgs">Organizations</h2>
          {overview.orgs.length ? <Button className="pecu-button" onClick={() => setCreatingOrg(true)}><PlusIcon className="size-4" />New organization</Button> : null}
        </div>
        {overview.orgs.length ? (
          <div className="pecu-org-grid">
            {overview.orgs.map((org) => (
              <OrgCard key={org.id} org={org} onAdd={() => setAddTo(org)} onRename={() => setRenaming(org)} onDelete={() => setDeleting(org)} />
            ))}
          </div>
        ) : (
          <div className="pecu-profile-empty-state">
            <p>An organization holds Safes: shared wallets that need approvals from several owners before money moves.</p>
            <Button className="pecu-button pecu-button-primary" onClick={() => setCreatingOrg(true)}><PlusIcon className="size-4" />New organization</Button>
          </div>
        )}
      </section>
      <NameDialog
        open={creatingOrg}
        title="New organization"
        label="Organization name"
        submitLabel="Create"
        onClose={() => setCreatingOrg(false)}
        onSave={async (name) => {
          const result = await profileAction({ op: "org-create", name });
          await refreshOverview();
          if (result.orgId) window.setTimeout(() => openAdd(result.orgId!), 0);
        }}
      />
      <NameDialog
        open={renaming !== null}
        title="Rename organization"
        label="Organization name"
        initial={renaming?.name ?? ""}
        submitLabel="Save"
        onClose={() => setRenaming(null)}
        onSave={async (name) => {
          if (!renaming) return;
          await profileAction({ op: "org-rename", orgId: renaming.id, name });
          await refreshOverview();
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? "organization"}?`}
        body="This removes the organization and its saved names from your profile. Its Safes stay on Base with their funds, and you can add them again by address."
        confirmLabel="Delete organization"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await profileAction({ op: "org-delete", orgId: deleting.id });
          await refreshOverview();
        }}
      />
      <AddSafeDialog
        org={addTo}
        wallet={overview.wallet}
        open={addTo !== null}
        onClose={() => setAddTo(null)}
        onCreated={(value, safe) => {
          setAddTo(null);
          setIntent({ value, safe });
          void refreshOverview();
        }}
        onAdded={(safe) => {
          setAddTo(null);
          void refreshOverview();
          void navigate({ to: "/profile/safe/$address", params: { address: safe } });
        }}
      />
      <IntentDialog
        intent={intent?.value ?? null}
        onClose={() => {
          const safe = intent?.safe;
          setIntent(null);
          void refreshOverview();
          if (safe) void navigate({ to: "/profile/safe/$address", params: { address: safe } });
        }}
      />
    </div>
  );
}
