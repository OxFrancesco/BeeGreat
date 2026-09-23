import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountAvatar, accountIdentity } from "../src/components/account-avatar";

test("the account menu names the person from Clerk without leaking internal ids", () => {
  expect(accountIdentity({ fullName: "Francesco Oddo", username: "oxfrancesco_", hasImage: true, imageUrl: "https://img.clerk.com/a.png" }))
    .toEqual({ name: "Francesco Oddo", handle: "@oxfrancesco_", image: "https://img.clerk.com/a.png", initials: "FO" });
  expect(accountIdentity({ fullName: " ", externalAccounts: [{ provider: "oauth_x", username: "pecu_user" }] }))
    .toMatchObject({ name: "pecu_user", handle: "@pecu_user", image: null, initials: "P" });
  expect(accountIdentity({ fullName: "Ada Lovelace", primaryEmailAddress: { emailAddress: "ada@example.com" }, hasImage: false, imageUrl: "https://img.clerk.com/default.png" }))
    .toEqual({ name: "Ada Lovelace", handle: "ada@example.com", image: null, initials: "AL" });
  expect(accountIdentity({ primaryEmailAddress: { emailAddress: "ada@example.com" } })).toMatchObject({ name: "ada@example.com", handle: null });
  expect(accountIdentity(null)).toMatchObject({ name: "Your account", handle: null, initials: "YA" });
});

test("avatars show the photo when there is one and initials otherwise", () => {
  expect(renderToStaticMarkup(<AccountAvatar account={accountIdentity({ fullName: "Ada Lovelace" })} size="small" />)).toContain(">AL<");
  const photo = renderToStaticMarkup(<AccountAvatar account={accountIdentity({ fullName: "Ada", hasImage: true, imageUrl: "https://img.clerk.com/a.png" })} size="profile" />);
  expect(photo).toContain('src="https://img.clerk.com/a.png"');
  expect(photo).toContain("is-profile");
});
