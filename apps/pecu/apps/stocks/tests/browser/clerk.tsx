export const useUser = () => ({ user: { id: "thread-test" }, isSignedIn: true });
export const useClerk = () => ({ openSignIn() {} });
export const UserButton = Object.assign(
  () => <button aria-label="Open user menu">Test</button>,
  { UserProfilePage: () => null },
);
