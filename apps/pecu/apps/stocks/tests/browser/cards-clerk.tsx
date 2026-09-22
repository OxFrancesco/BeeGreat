export const useUser = () => ({ user: { id: "user_preview", updatedAt: new Date(0) }, isSignedIn: true });
export const useClerk = () => ({ openUserProfile() { window.location.search = "?case=owned"; } });
