import { useClerk, useUser } from "@clerk/tanstack-react-start";
import { Link, useRouterState } from "@tanstack/react-router";
import { LayersIcon, LogOutIcon, SettingsIcon, UserRoundIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useRef } from "react";
import { openChatGptConnection } from "../lib/inference-navigation";
import { ChatGptLogo } from "./chatgpt-logo";
import { ChatGptConnectionDialog } from "./inference-profile";
import { AccountAvatar, accountIdentity, type Account } from "./account-avatar";
import { openPecuCards, PecuCardsDialog } from "./pecu-cards";

export function useAccountIdentity(): Account {
  return accountIdentity(useUser().user);
}

export function AccountMenu() {
  const clerk = useClerk();
  const account = useAccountIdentity();
  const onProfile = useRouterState({ select: (state) => state.location.pathname.startsWith("/profile") });
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <>
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <button ref={trigger} className="pecu-account-trigger" type="button" aria-label="Account menu">
            <AccountAvatar account={account} size="small" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="pecu pecu-account-menu" align="end" sideOffset={10} collisionPadding={12}>
            <div className="pecu-account-head">
              <AccountAvatar account={account} size="large" />
              <div className="pecu-account-who">
                <p className="pecu-account-name">{account.name}</p>
                {account.handle ? <p className="pecu-account-handle">{account.handle}</p> : null}
              </div>
            </div>
            <DropdownMenu.Group className="pecu-account-group">
              <DropdownMenu.Item className="pecu-account-item" asChild>
                <Link to="/profile" aria-current={onProfile ? "page" : undefined}>
                  <UserRoundIcon aria-hidden="true" />
                  Profile
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item className="pecu-account-item" onSelect={openPecuCards}>
                <LayersIcon aria-hidden="true" />
                My cards
              </DropdownMenu.Item>
              <DropdownMenu.Item className="pecu-account-item" onSelect={openChatGptConnection}>
                <ChatGptLogo size={18} />
                ChatGPT connection
              </DropdownMenu.Item>
            </DropdownMenu.Group>
            <DropdownMenu.Separator className="pecu-account-separator" />
            <DropdownMenu.Group className="pecu-account-group">
              <DropdownMenu.Item className="pecu-account-item" onSelect={() => clerk.openUserProfile()}>
                <SettingsIcon aria-hidden="true" />
                Manage account
              </DropdownMenu.Item>
              <DropdownMenu.Item className="pecu-account-item" onSelect={() => void clerk.signOut({ redirectUrl: window.location.pathname })}>
                <LogOutIcon aria-hidden="true" />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Group>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <ChatGptConnectionDialog onCloseFocus={() => trigger.current?.focus()} />
      <PecuCardsDialog />
    </>
  );
}
