import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import DashboardWelcome from '../components/DashboardWelcome';
import AttentionPanel from '../components/AttentionPanel';
import ClientPayments from '../components/ClientPayments';
import ServiceListingCard from '../components/ServiceListingCard';
import UpcomingAppointments from '../components/UpcomingAppointments';
import { useAuth } from '../contexts/AppContext';
import { accountBookings } from '../utils/bookings';
import { clientDiscovery } from '../utils/discovery';
import { bookingHistoryPath, formatInboxTime } from '../utils/inbox';
import { formatRand } from '../utils/money';
import { totalRecordedCents } from '../utils/payments';
import { quotes, quoteTime } from '../utils/quotes';
import { completedServiceValueCents } from '../utils/serviceValue';
import type { ServiceListing } from '../types';

const panel = 'dashboard-panel rounded-2xl border border-home-line bg-home-surface p-6';
function ServiceSection({ title, help, items, empty }: { title: string; help: string; items: ServiceListing[]; empty: string }) {
  return <section className={panel}><h2 className="text-3xl">{title}</h2><p className="mt-2 text-sm text-emerald-300">{help}</p>{items.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(item => <ServiceListingCard key={item.id} listing={item} bookable />)}</div> : <p className="mt-4 text-sm text-emerald-300">{empty}</p>}</section>;
}
export default function Dashboard() {
  const { currentUser } = useAuth(); const id = currentUser?.id ?? '';
  const bookings = useQuery(accountBookings(id)); const requests = useQuery(quotes(id)); const discovery = useQuery(clientDiscovery(id, true));
  const [tab, setTab] = useState<'overview' | 'payments'>('overview');
  const now = Date.now();
  const activeQuotes = (requests.data?.filter(item => ['Pending', 'Quoted', 'RevisionRequested', 'DepositPending'].includes(item.status)) ?? []).sort((a, b) => { const deadline = (item: typeof a) => item.status === 'Quoted' && item.versions[0] && new Date(item.versions[0].expiresAt).getTime() > now ? new Date(item.versions[0].expiresAt).getTime() : Infinity; return deadline(a) - deadline(b); });
  const awaitingCount = activeQuotes.filter(item => item.status === 'Pending' || item.status === 'RevisionRequested').length;
  const receivedCount = activeQuotes.filter(item => item.status === 'Quoted' && item.versions[0] && new Date(item.versions[0].expiresAt).getTime() > now).length;
  const expiringCount = activeQuotes.filter(item => item.status === 'Quoted' && item.versions[0] && new Date(item.versions[0].expiresAt).getTime() > now && new Date(item.versions[0].expiresAt).getTime() - now <= 48 * 3600000).length;
  const expired = (date?: string) => !!date && new Date(date).getTime() <= now;
  const quoteLabel = (status: string, expiry?: string) => status === 'Quoted' ? expired(expiry) ? 'Quotation expired' : expiry && new Date(expiry).getTime() - now <= 48 * 3600000 ? `Expires ${quoteTime(expiry)}` : 'Quotation received' : status === 'Pending' ? 'Awaiting quotation' : status === 'RevisionRequested' ? 'Changes requested' : status === 'DepositPending' ? 'Deposit pending' : status === 'Accepted' ? 'Quote accepted' : status === 'Declined' ? 'Quote declined' : status === 'SlotUnavailable' ? 'Appointment unavailable' : status;
  const activity = [
    ...(bookings.data ?? []).map(item => ({ id: `booking-${item.id}`, when: item.updatedAt, label: `${item.serviceTitle} · ${item.status}`, detail: item.providerName, href: bookingHistoryPath(item.id) })),
    ...(requests.data ?? []).map(item => ({ id: `quote-${item.id}`, when: item.updatedAt, label: `${item.listing.title} · ${item.status === 'Declined' && !item.versions.length ? 'Request withdrawn' : quoteLabel(item.status, item.versions[0]?.expiresAt)}`, detail: item.provider.businessName || 'Provider', href: `/quotes?request=${encodeURIComponent(item.id)}` })),
  ].sort((a,b) => b.when.localeCompare(a.when)).slice(0, 6);
  const metrics = [
    { label: 'Total bookings', value: bookings.data ? String(bookings.data.length) : '—', hint: 'All booking statuses' },
    { label: 'Completed bookings', value: bookings.data ? String(bookings.data.filter(b => b.status === 'Completed').length) : '—', hint: 'Confirmed by both parties' },
    { label: 'Total paid', value: bookings.data ? formatRand(totalRecordedCents(bookings.data)) : '—', hint: 'Payments and deposits recorded' },
    { label: 'Completed service value', value: bookings.data ? formatRand(completedServiceValueCents(bookings.data)) : '—', hint: 'Full agreed value of completed services' },
  ];
  return <main className="dashboard-page client-overview min-h-screen px-5 py-10"><div className="mx-auto max-w-7xl"><DashboardWelcome role="client" />
    <AttentionPanel role="client" bookings={bookings.data} quotes={requests.data} loading={bookings.isPending || requests.isPending} />
    <nav aria-label="Dashboard sections" className="dashboard-tabs mt-6 flex gap-2"><button type="button" className={tab === 'overview' ? 'btn-primary' : 'btn-secondary'} aria-current={tab === 'overview' ? 'page' : undefined} onClick={() => setTab('overview')}>Overview</button><button type="button" className={tab === 'payments' ? 'btn-primary' : 'btn-secondary'} aria-current={tab === 'payments' ? 'page' : undefined} onClick={() => setTab('payments')}>Payments</button></nav>
    {tab === 'payments' ? <ClientPayments bookings={bookings.data} quotes={requests.data} loading={bookings.isPending} error={bookings.isError} quotesLoading={requests.isPending} quotesError={requests.isError} /> : <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <div key={metric.label} className={`${panel} dashboard-metric`}><p className="text-sm text-emerald-300">{metric.label}</p><p className="mt-2 text-3xl font-semibold text-home-text">{metric.value}</p><p className="mt-2 text-xs text-emerald-300">{metric.hint}</p></div>)}</div>
      {(bookings.isError || requests.isError || discovery.isError) && <p role="alert" className="mt-4 text-red-300">Some dashboard information could not be loaded. Refresh to try again.</p>}
      <div className="mt-6 grid gap-6 lg:grid-cols-2"><UpcomingAppointments bookings={bookings.data} loading={bookings.isPending} role="client" />
      <section className={panel}><div className="flex justify-between gap-3"><h2 className="text-3xl">Quote requests</h2><Link to="/quotes" className="dashboard-view-link">View all <ArrowUpRight size={15} aria-hidden="true" /></Link></div>{requests.isPending && <p className="mt-4">Loading quotes…</p>}{requests.isSuccess && activeQuotes.length > 0 && <p className="mt-3 text-sm text-emerald-300">{awaitingCount} awaiting quotation · {receivedCount} received · {expiringCount} expiring within 48 hours</p>}{requests.isSuccess && !activeQuotes.length && <p className="mt-4 text-sm text-emerald-300">No active quote requests.</p>}<div className="mt-4 space-y-3">{activeQuotes.slice(0, 5).map(item => <Link key={item.id} to={`/quotes?request=${encodeURIComponent(item.id)}`} className="block rounded-xl border border-home-line p-4"><p className="font-semibold text-home-text">{item.listing.title}</p><p className="mt-1 text-sm text-emerald-300">{item.provider.businessName || 'Provider'} · {quoteLabel(item.status, item.versions[0]?.expiresAt)}</p></Link>)}</div></section></div>
      <section className={`${panel} mt-6`}><div className="flex justify-between gap-3"><h2 className="text-3xl">Your activity</h2></div>{(bookings.isPending || requests.isPending) && <p className="mt-4">Loading activity…</p>}{bookings.isSuccess && requests.isSuccess && !activity.length && <p className="mt-4 text-sm text-emerald-300">Your bookings and quotation updates will appear here.</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2">{activity.map(item => <Link key={item.id} to={item.href} className="rounded-xl border border-home-line p-4"><p className="text-home-text">{item.label}</p><p className="mt-1 text-sm text-emerald-300">{item.detail} · {formatInboxTime(item.when)}</p></Link>)}</div></section>
      {discovery.isPending && <p className="mt-6">Loading services…</p>}{discovery.data && <div className="mt-6 space-y-6"><ServiceSection title="Recommended services" help="Based on your location and categories you have viewed, saved or requested." items={discovery.data.recommended.slice(0, 3)} empty="Explore services or add your location to see recommendations." /><ServiceSection title="Recently viewed services" help="Services you opened recently." items={discovery.data.recent} empty="Services you view will appear here." />
        <section className={panel}><h2 className="text-3xl">Your favourites</h2><p className="mt-2 text-sm text-emerald-300">Your saved providers and services.</p>{!discovery.data.favoriteProviders.length && !discovery.data.favorites.length && <p className="mt-4 text-sm text-emerald-300">Save a provider or service to find them here.</p>}{discovery.data.favoriteProviders.length > 0 && <div className="mt-4 flex flex-wrap gap-3">{discovery.data.favoriteProviders.map(provider => <Link key={provider.id} to={`/providers/${encodeURIComponent(provider.id)}`} className="rounded-xl border border-home-line px-4 py-3 text-home-text">{provider.name} · {provider.location}{provider.verificationTier !== 'Basic' && <span className="ml-2 text-emerald-300">✓ Verified</span>}</Link>)}</div>}<div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{discovery.data.favorites.map(item => <ServiceListingCard key={item.id} listing={item} bookable />)}</div></section>
        <ServiceSection title="Popular in your area" help={`Most requested services in ${discovery.data.location}, based on quote requests.`} items={discovery.data.popular.slice(0, 3)} empty="There are not enough local quote requests to show popular services yet." /></div>}
    </>}
  </div></main>;
}
