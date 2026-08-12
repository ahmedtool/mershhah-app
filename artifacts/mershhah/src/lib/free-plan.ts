// The free plan has no real expiry by design — new accounts get instant,
// unrestricted access without a forced trial countdown. There's no NULL/
// "unlimited" convention for subscriptions.end_date, so a far-future date
// is used as the "never expires" sentinel instead. Shared here because
// registration, login self-heal, and the account-status migration path
// each provision this same free subscription independently.
export const FREE_PLAN_ID = 'free';
export const FREE_PLAN_DURATION_YEARS = 100;

export function freeSubscriptionEndDate(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setFullYear(end.getFullYear() + FREE_PLAN_DURATION_YEARS);
  return end;
}
