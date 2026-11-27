import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, ClipboardList, MapPin, Sparkles, TrendingUp } from 'lucide-react';
import DashboardWelcome from '../components/DashboardWelcome';
import PresenceStatus from '../components/PresenceStatus';
import UpcomingAppointments from '../components/UpcomingAppointments';
import { useAuth } from '../contexts/AppContext';
import { accountBookings } from '../utils/bookings';
import { formatRand } from '../utils/money';
import { providerInsights } from '../utils/providers';
import { quotes, quoteTime } from '../utils/quotes';
import { providerReviews } from '../utils/reviews';
import { completedServiceValueCents } from '../utils/serviceValue';
import { totalRecordedCents } from '../utils/payments';
import { categoryLabel } from '../utils/serviceUtils';
import { bookingHistoryPath, formatInboxTime } from '../utils/inbox';

const panel = 'dashboard-panel rounded-2xl border border-home-line bg-home-surface p-6';
export default function ProviderDashboard() {
  const { currentUser } = useAuth(); const id = currentUser?.id ?? '';
  const bookings = useQuery(accountBookings(id)); const requests = useQuery(quotes(id)); const insights = useQuery(providerInsights(id)); const reviews = useQuery(providerReviews(id));
  const pending = requests.data?.filter(item => item.status === 'Pending' || item.status === 'RevisionRequested') ?? [];
  const completedAt = (item: NonNullable<typeof bookings.data>[number]) => Math.max(...[item.clientCompletedAt, item.providerCompletedAt].filter((value): value is string => !!value).map(value => new Date(value).getTime()), new Date(item.clientCompletedAt || item.providerCompletedAt ? 0 : item.updatedAt).getTime());
  const recentCompleted = (bookings.data ?? []).filter(item => item.status === 'Completed').sort((a, b) => completedAt(b) - completedAt(a)).slice(0, 3);
  const metrics = [
    { label: 'Money received', value: bookings.data ? formatRand(totalRecordedCents(bookings.data)) : '—', help: 'Payments recorded, including confirmed deposits' },
    { label: 'Completed service value', value: bookings.data ? formatRand(completedServiceValueCents(bookings.data)) : '—', help: 'Full value of completed quoted services' },
    { label: 'Bookings completed', value: bookings.data ? String(bookings.data.filter(item => item.status === 'Completed').length) : '—', help: 'All time' },
    { label: 'Quote requests received', value: requests.data ? String(requests.data.length) : '—', help: 'All time' },
    { label: 'Average rating', value: reviews.data?.averageRating != null ? `${reviews.data.averageRating.toFixed(1)} / 5` : '—', help: reviews.data ? `${reviews.data.reviewCount} reviews` : 'Reviews' },
  ];
  return <main className="dashboard-page provider-overview min-h-screen px-5 py-10"><div className="mx-auto max-w-7xl">
    <DashboardWelcome role="provider" />
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(item => <div key={item.label} className={`${panel} dashboard-metric`}><p className="text-sm text-emerald-300">{item.label}</p><p className="mt-2 text-3xl font-semibold text-home-text">{item.value}</p><p className="mt-2 text-xs text-emerald-300">{item.help}</p></div>)}</div>
    {(bookings.isError || requests.isError || insights.isError) && <p role="alert" className="mt-4 text-red-300">Some dashboard information could not be loaded. Refresh to try again.</p>}
    <section className={`${panel} dashboard-activity mt-6`}><div className="dashboard-section-heading"><div><p className="dashboard-kicker">RECENTLY COMPLETED</p><h2>Your activity</h2><p>Your latest completed bookings</p></div><Link className="dashboard-view-link" to="/bookings">View all <ArrowUpRight size={15} /></Link></div>{bookings.isPending && <p className="dashboard-empty">Loading activity…</p>}{bookings.isSuccess && !recentCompleted.length && <p className="dashboard-empty">Your completed bookings will appear here.</p>}<div className="dashboard-activity__list">{recentCompleted.map(item => <Link key={item.id} to={bookingHistoryPath(item.id)} className="dashboard-activity__item"><span className="dashboard-activity__icon"><Check size={17} /></span><span className="dashboard-activity__details"><strong>{item.serviceTitle}</strong><small>{item.clientName} · {formatInboxTime(new Date(completedAt(item)).toISOString())}</small></span><span className="dashboard-activity__badge">Completed</span><ArrowUpRight className="dashboard-activity__arrow" size={16} /></Link>)}</div></section>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><UpcomingAppointments bookings={bookings.data} loading={bookings.isPending} role="provider" />
      <section className={panel}><div className="flex items-center justify-between gap-3"><h2 className="text-3xl">Quote requests</h2><Link className="dashboard-view-link" to="/quotes">View all <ArrowUpRight size={15} aria-hidden="true" /></Link></div>{requests.isPending && <p className="mt-4">Loading requests…</p>}{requests.isSuccess && !pending.length && <p className="mt-4 text-sm text-emerald-300">No requests awaiting a quotation.</p>}<div className="mt-4 space-y-3">{pending.slice(0, 5).map(item => <Link key={item.id} to={`/quotes?request=${encodeURIComponent(item.id)}`} className="block rounded-xl border border-home-line p-4 hover:bg-home-canvas"><p className="font-semibold text-home-text">{item.listing.title}</p><p className="mt-1 text-sm text-emerald-300">{item.client.user.name || 'Client'} · {item.status === 'RevisionRequested' ? 'Changes requested' : 'Awaiting quotation'}</p><PresenceStatus userId={item.clientId} /><p className="mt-1 text-sm text-emerald-300">Preferred: {quoteTime(item.preferredAt)}</p></Link>)}</div></section></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className={`${panel} performance-panel`}><div className="dashboard-section-heading"><div><p className="dashboard-kicker">YOUR PROGRESS</p><h2>Weekly performance</h2><p>A little look at your last 7 days</p></div><span className="dashboard-heading-icon"><TrendingUp size={19} /></span></div>{insights.data && <div className="performance-grid">{[{ label: 'Quote requests', value: insights.data.weeklyRequests, icon: ClipboardList }, { label: 'Bookings', value: insights.data.weeklyBookings, icon: Sparkles }, { label: 'Completed', value: insights.data.weeklyCompleted, icon: Check }].map(({ label, value, icon: Icon }) => <div key={label} className="performance-stat"><Icon size={17} aria-hidden="true" /><strong>{value}</strong><span>{label}</span></div>)}</div>}{insights.isPending && <p className="dashboard-empty">Loading performance…</p>}</section>
      <section className={`${panel} marketplace-panel`}><div className="dashboard-section-heading"><div><p className="dashboard-kicker">AROUND YOU</p><h2>Local marketplace</h2>{insights.data && <p className="marketplace-location"><MapPin size={13} /> {insights.data.location}</p>}</div><span className="dashboard-heading-icon"><Sparkles size={19} /></span></div>{insights.data && (insights.data.localCategories.length ? <ul className="marketplace-categories">{insights.data.localCategories.map(row => <li key={row.category}><span><strong>{categoryLabel(row.category)}</strong><small>{row.newThisWeek} new in the last 7 days</small></span><span className="marketplace-count"><b>{row.count}</b> {row.count === 1 ? 'listing' : 'listings'}</span></li>)}</ul> : <p className="dashboard-empty">No published listings in this area yet.</p>)}{insights.isPending && <p className="dashboard-empty">Loading marketplace…</p>}</section></div>
  </div></main>;
}
