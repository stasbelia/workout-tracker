import { Activity } from './profileApi';
// UTC is used only for calendar arithmetic, never to determine the phone's today.
export function activityWeeks(activity: Activity): { date: string; count: number; level: number; inYear: boolean; future: boolean }[][] {
  const counts = new Map(activity.days.map(day => [day.date, day.count]));
  const first = new Date(Date.UTC(activity.year, 0, 1));
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7);
  const last = new Date(Date.UTC(activity.year, 11, 31));
  last.setUTCDate(last.getUTCDate() + (7 - last.getUTCDay()) % 7);
  const weeks = [];
  for (const cursor = new Date(first); cursor <= last;) {
    const week = [];
    for (let row = 0; row < 7; row++) {
      const date = cursor.toISOString().slice(0, 10), count = counts.get(date) ?? 0;
      week.push({ date, count, level: count > 0 ? 1 : 0, inYear: cursor.getUTCFullYear() === activity.year, future: date > activity.today });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}
