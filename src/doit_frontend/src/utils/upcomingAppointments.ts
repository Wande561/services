import type { Booking } from '../types';

// South Africa uses UTC+02:00 year-round, regardless of the viewer's timezone.
export function sastDay(timestamp: number) { return new Date(timestamp + 2 * 60 * 60 * 1000).toISOString().slice(0, 10); }
export function upcomingAppointments(bookings: Booking[], now: number) {
  const upcoming = bookings.filter(item => (item.status === 'Pending' || item.status === 'Confirmed') && new Date(item.endsAt).getTime() > now).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const nextDay = upcoming.length ? sastDay(new Date(upcoming[0].startsAt).getTime()) : null;
  const priority = nextDay ? upcoming.filter(item => sastDay(new Date(item.startsAt).getTime()) === nextDay) : [];
  const today = sastDay(now);
  const tomorrow = sastDay(now + 24 * 60 * 60 * 1000);
  const label = nextDay === today ? 'Today' : nextDay === tomorrow ? 'Tomorrow' : nextDay ? new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'full' }).format(new Date(`${nextDay}T12:00:00+02:00`)) : '';
  return { upcoming, priority, label };
}
