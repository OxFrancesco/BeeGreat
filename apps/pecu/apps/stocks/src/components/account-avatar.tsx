export type Account = Readonly<{ name: string; handle: string | null; image: string | null; initials: string }>;
export type AccountUser = Readonly<{
  fullName?: string | null;
  username?: string | null;
  hasImage?: boolean;
  imageUrl?: string;
  primaryEmailAddress?: Readonly<{ emailAddress: string }> | null;
  externalAccounts?: ReadonlyArray<Readonly<{ provider: string; username?: string | null }>>;
}> | null | undefined;

export function accountIdentity(user: AccountUser): Account {
  const x = user?.externalAccounts?.find((account) => ["x", "twitter", "oauth_x", "oauth_twitter"].includes(String(account.provider)));
  const username = user?.username ?? x?.username ?? null;
  const email = user?.primaryEmailAddress?.emailAddress ?? null;
  const name = user?.fullName?.trim() || username || email || "Your account";
  const handle = username ? `@${username}` : email && email !== name ? email : null;
  return {
    name,
    handle,
    image: user?.hasImage && user.imageUrl ? user.imageUrl : null,
    initials: name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]!.toUpperCase()).join("") || "P",
  };
}

export function AccountAvatar({ account, size }: { account: Account; size: "small" | "large" | "profile" }) {
  return (
    <span className={`pecu-avatar-circle is-${size}`} aria-hidden="true">
      {account.image ? <img alt="" src={account.image} referrerPolicy="no-referrer" /> : <span>{account.initials}</span>}
    </span>
  );
}

