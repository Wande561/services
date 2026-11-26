import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import DashboardWelcome from '../components/DashboardWelcome';
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

const panel = 'dashboard-panel rounded-2xl border border-home-line bg-home-surface p-6';
export default function ProviderDashboard() {
  const { currentUser } = useAuth(); const id = currentUser?.id ?? '';
  const bookings = useQuery(accountBookings(id)); const requests = useQuery(quotes(id)); const insights = useQuery(providerInsights(id)); const reviews = useQuery(providerReviews(id));
  const pending = requests.data?.filter(item => item.status === 'Pending' || item.status === 'RevisionRequested') ?? [];
  const metrics = [
    { label: 'Money received', value: bookings.data ? formatRand(totalRecordedCents(bookings.data)) : '—', help: 'Payments recorded, including confirmed deposits' },
    { label: 'Completed service value', value: bookings.data ? formatRand(completedServiceValueCents(bookings.data)) : '—', help: 'Full value of completed quoted services' },
    { label: 'Bookings completed', value: bookings.data ? String(bookings.data.filter(item => item.status === 'Completed').length) : '—', help: 'All time' },
    { label: 'Quote requests received', value: requests.data ? String(requests.data.length) : '—', help: 'All time' },
    { label: 'Average rating', value: reviews.data?.averageRating != null ? `${reviews.data.averageRating.toFixed(1)} / 5` : '—', help: reviews.data ? `${reviews.data.reviewCount} reviews` : 'Reviews' },
  ];
  return <main className="min-h-screen px-5 py-10"><div className="mx-auto max-w-7xl">
    <DashboardWelcome role="provider" />
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(item => <div key={item.label} className={`${panel} dashboard-metric`}><p className="text-sm text-emerald-300">{item.label}</p><p className="mt-2 text-3xl font-semibold text-home-text">{item.value}</p><p className="mt-2 text-xs text-emerald-300">{item.help}</p></div>)}</div>
    {(bookings.isError || requests.isError || insights.isError) && <p role="alert" className="mt-4 text-red-300">Some dashboard information could not be loaded. Refresh to try again.</p>}
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><UpcomingAppointments bookings={bookings.data} loading={bookings.isPending} role="provider" />
      <section className={panel}><div className="flex items-center justify-between gap-3"><h2 className="text-3xl">Quote requests</h2><Link className="text-sm text-emerald-300 underline" to="/quotes">View all</Link></div>{requests.isPending && <p className="mt-4">Loading requests…</p>}{requests.isSuccess && !pending.length && <p className="mt-4 text-sm text-emerald-300">No requests awaiting a quotation.</p>}<div className="mt-4 space-y-3">{pending.slice(0, 5).map(item => <Link key={item.id} to={`/quotes?request=${encodeURIComponent(item.id)}`} className="block rounded-xl border border-home-line p-4 hover:bg-home-canvas"><p className="font-semibold text-home-text">{item.listing.title}</p><p className="mt-1 text-sm text-emerald-300">{item.client.user.name || 'Client'} · {item.status === 'RevisionRequested' ? 'Changes requested' : 'Awaiting quotation'}</p><p className="mt-1 text-sm text-emerald-300">Preferred: {quoteTime(item.preferredAt)}</p></Link>)}</div></section></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2">      <section className={panel}><h2 className="text-2xl">Weekly performance</h2><p className="mt-2 text-sm text-emerald-300">Last 7 days</p>{insights.data && <div className="mt-4 space-y-2 text-home-text"><p>{insights.data.weeklyRequests} quote requests received</p><p>{insights.data.weeklyBookings} bookings created</p><p>{insights.data.weeklyCompleted} services completed</p></div>}</section>
      <section className={panel}><h2 className="text-2xl">Local marketplace</h2>{insights.data && <><p className="mt-2 text-sm text-emerald-300">Published services in {insights.data.location}</p>{insights.data.localCategories.length ? <ul className="mt-4 space-y-2">{insights.data.localCategories.map(row => <li key={row.category} className="flex justify-between gap-3 text-sm text-home-text"><span>{categoryLabel(row.category)}</span><span>{row.count} {row.count === 1 ? 'listing' : 'listings'} · {row.newThisWeek} created last 7 days</span></li>)}</ul> : <p className="mt-4 text-sm text-emerald-300">No published listings in this area yet.</p>}</>}</section></div>
  </div></main>;
}
