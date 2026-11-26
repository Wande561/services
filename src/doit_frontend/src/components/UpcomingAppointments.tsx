import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AccountRole, Booking } from '../types';
import { formatSlot } from '../utils/bookings';
import { bookingHistoryPath } from '../utils/inbox';
import { upcomingAppointments } from '../utils/upcomingAppointments';
import BookingSummary from './BookingSummary';

export default function UpcomingAppointments({ bookings, loading, role }: { bookings?: Booking[]; loading: boolean; role: AccountRole }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 60000); return () => window.clearInterval(timer); }, []);
  const { upcoming, priority, label } = upcomingAppointments(bookings ?? [], now);
  return <section className="dashboard-panel rounded-2xl border border-home-line bg-home-surface p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="appointment-kicker">YOUR SCHEDULE</p><h2 className="mt-2 text-3xl">{role === 'client' ? 'Your upcoming appointments' : 'Upcoming appointments'}</h2></div><Link className="text-sm text-emerald-300 underline" to="/bookings">View bookings</Link></div>
    {loading && <p className="mt-4">Loading appointments…</p>}
    {!loading && bookings && !upcoming.length && <p className="mt-4 text-sm text-emerald-300">No upcoming appointments yet.</p>}
    {priority.length > 0 && <div className="appointment-priority"><div className="appointment-priority__heading"><span><CalendarDays aria-hidden="true" /> NEXT UP</span><strong>{label}</strong></div><div className="appointment-priority__list">{priority.map(item => <Link key={item.id} to={bookingHistoryPath(item.id)}><span><strong>{item.serviceTitle}</strong><small>{role === 'provider' ? item.clientName : item.providerName} · {formatSlot(item)}</small></span><ArrowUpRight aria-hidden="true" /></Link>)}</div></div>}
    {upcoming.length > 0 && <div className="appointment-all"><div className="appointment-all__heading"><span>ALL UPCOMING</span><span>{upcoming.length} {upcoming.length === 1 ? 'appointment' : 'appointments'}</span></div><div className="space-y-3">{upcoming.map(item => <Link key={item.id} to={bookingHistoryPath(item.id)} className="block rounded-xl border border-home-line p-4 hover:bg-home-canvas"><BookingSummary booking={item} role={role} /></Link>)}</div></div>}
  </section>;
}
