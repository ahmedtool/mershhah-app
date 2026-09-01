// Our own dedicated team/test account - gets every plan feature unlocked
// (no branch/menu-item/tool caps) and every paid tool for free, so the team
// can exercise the full product without hitting caps or real charges.
// Single source of truth so the entitlements override (useUser.tsx) and the
// tools-store checkout bypass (owner/store/page.tsx) never drift apart.
export const UNLIMITED_ACCOUNT_EMAILS = ['ahmednasmhi@gmail.com'];

export function isUnlimitedAccount(email: string | null | undefined): boolean {
  return !!email && UNLIMITED_ACCOUNT_EMAILS.includes(email);
}
