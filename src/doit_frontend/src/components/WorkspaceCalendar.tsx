import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { workspaceBookings } from '../utils/workspaces';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WorkspaceCalendar({ workspaceId }: { workspaceId: string }) {
  const [cursor, setCursor] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  const query = useQuery(workspaceBookings(workspaceId, { from: start.toISOString(), to: end.toISOString() }));
  const bookings = query.data ?? [];
  const lead = (start.getDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), index - lead + 1);
    return { date, inMonth: date.getMonth() === start.getMonth(), items: bookings.filter(booking => new Date(booking.slot.startsAt).toDateString() === date.toDateString()) };
  });
  const label = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' }).format(start);
  return <section className="workspace-card workspace-calendar">
    <div className="workspace-card__head"><div><p className="workspace-kicker">YOUR SCHEDULE</p><h2>{label}</h2><p>All bookings across this workspace.</p></div><div className="workspace-calendar__nav"><button type="button" onClick={() => setCursor(new Date(start.getFullYear(), start.getMonth() - 1, 1))} aria-label="Previous month"><ChevronLeft size={16} /></button><button type="button" onClick={() => setCursor(new Date(start.getFullYear(), start.getMonth() + 1, 1))} aria-label="Next month"><ChevronRight size={16} /></button></div></div>
    {query.isPending && <p className="workspace-empty">Loading calendar…</p>}
    {query.isError && <p className="workspace-error" role="alert">{query.error.message}</p>}
    <div className="workspace-calendar__weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
    <div className="workspace-calendar__grid">{days.map(day => <div key={day.date.toISOString()} className={`workspace-calendar__day ${day.inMonth ? '' : 'is-outside'}`}><span>{day.date.getDate()}</span>{day.items.slice(0, 3).map(booking => <small key={booking.id} className={`workspace-calendar__booking status-${booking.status.toLowerCase()}`}>{new Intl.DateTimeFormat('en-ZA', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(booking.slot.startsAt))} {booking.serviceTitle}</small>)}{day.items.length > 3 && <small className="workspace-calendar__more">+{day.items.length - 3} more</small>}</div>)}</div>
  </section>;
}
