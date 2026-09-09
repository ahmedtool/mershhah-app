// Parses the exact "يوميًا H:MM ص/م - H:MM ص/م" format produced by
// generateHoursText() (EditBranchDialog) and the Google Places hours
// auto-fill — optionally followed by "(الجمعة H:MM ص/م - H:MM ص/م)" — to
// determine whether a branch is open right now. This is the only format
// the app itself ever writes into `branches.opening_hours`, so no other
// shape needs to be supported.
interface TimeRange {
  openMinutes: number;
  closeMinutes: number;
}

function to24Minutes(hour: number, minute: number, period: 'ص' | 'م'): number {
  let h = hour % 12;
  if (period === 'م') h += 12;
  return h * 60 + minute;
}

function isWithinRange(nowMinutes: number, range: TimeRange): boolean {
  const { openMinutes, closeMinutes } = range;
  if (closeMinutes > openMinutes) {
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }
  // Overnight range (closes after midnight), e.g. open 07:30, close 03:00.
  return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
}

export function isBranchOpenNow(openingHours?: string | null): boolean | null {
  if (!openingHours) return null;
  const matches = [...openingHours.matchAll(/(\d{1,2}):(\d{2})\s*(ص|م)/g)];
  if (matches.length < 2) return null;

  const toRange = (open: RegExpMatchArray, close: RegExpMatchArray): TimeRange => ({
    openMinutes: to24Minutes(Number(open[1]), Number(open[2]), open[3] as 'ص' | 'م'),
    closeMinutes: to24Minutes(Number(close[1]), Number(close[2]), close[3] as 'ص' | 'م'),
  });

  const baseRange = toRange(matches[0], matches[1]);
  const fridayRange = matches.length >= 4 ? toRange(matches[2], matches[3]) : null;

  const isFridayToday = new Date().getDay() === 5;
  const activeRange = isFridayToday && fridayRange ? fridayRange : baseRange;

  const now = new Date();
  return isWithinRange(now.getHours() * 60 + now.getMinutes(), activeRange);
}
