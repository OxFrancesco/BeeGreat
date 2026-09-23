import { useState, type PropsWithChildren, type ReactNode } from "react";
export const useUser = () => ({ user: { id: "thread-test", fullName: "Ada Lovelace", username: "ada", hasImage: false, imageUrl: "", externalAccounts: [], primaryEmailAddress: null }, isSignedIn: true, isLoaded: true });
export const useClerk = () => ({ openSignIn() {}, openUserProfile() {}, async signOut() {} });
export const UserButton = Object.assign(
  ({ children }: PropsWithChildren) => {
    const [open, setOpen] = useState(false);
    return <div><button aria-label="Open user menu" onClick={() => setOpen(!open)}>Profile</button>{open ? <div aria-label="Profile menu">{children}</div> : null}</div>;
  },
  {
    UserProfilePage: () => null,
    MenuItems: ({ children }: PropsWithChildren) => <>{children}</>,
    Action: ({ label, labelIcon, onClick }: { label: string; labelIcon?: ReactNode; onClick?: () => void }) => <button onClick={onClick}>{labelIcon}{label === "manageAccount" ? "Manage account" : label === "signOut" ? "Sign out" : label}</button>,
  },
);
