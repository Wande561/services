import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, Check, CheckCircle2, ChevronDown, ClipboardList, Clock3, FileText, MapPin, Sparkles, TrendingUp } from 'lucide-react';
import AttentionPanel from '../components/AttentionPanel';
import FilterSelect from '../components/FilterSelect';
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
import ProviderBusinessInsights, { businessInsightsQuery } from '../components/ProviderBusinessInsights';
import { upcomingAppointments } from '../utils/upcomingAppointments';
import { formatSlot } from '../utils/bookings';

const panel = 'dashboard-panel rounded-2xl border border-home-line bg-home-surface p-6';
export default function ProviderDashboard() {
  const { currentUser, switchRole, logout } = useAuth(); const id = currentUser?.id ?? '';
  const navigate = useNavigate();
  const [modeError, setModeError] = useState('');
  const [switchingMode, setSwitchingMode] = useState(false);
  async function switchToClient() {
    if (!currentUser?.profile || switchingMode) return;
    setSwitchingMode(true); setModeError('');
    try {
      await switchRole({ role: 'client', name: currentUser.name || 'My account', phone: currentUser.profile.phone, location: currentUser.profile.location });
      navigate('/dashboard');
    } catch (error) { setModeError(error instanceof Error ? error.message : 'Could not switch account mode'); }
    finally { setSwitchingMode(false); }
  }
  const bookings = useQuery(accountBookings(id)); const requests = useQuery(quotes(id)); const insights = useQuery(providerInsights(id)); const reviews = useQuery(providerReviews(id));
  const [bookingTab, setBookingTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const business = useQuery(businessInsightsQuery(id, period));
  const upcoming = upcomingAppointments(bookings.data ?? [], Date.now()).upcoming;
  const completed = (bookings.data ?? []).filter(item => item.status === 'Completed').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const shownBookings = bookingTab === 'upcoming' ? upcoming : completed;
  const snapshot = business.data?.overview;
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
  return <main className="dashboard-page provider-overview provider-home min-h-screen"><div className="provider-home__inner">
    <div className="provider-home__top"><span>Workspace <span aria-hidden="true">/</span> <strong>Overview</strong></span><div><details className="provider-home__mode"><summary>Provider mode <ChevronDown size={14} aria-hidden="true" /></summary><div className="provider-home__account-menu"><strong>{currentUser?.name || currentUser?.profile?.businessName || 'My account'}</strong><small>{currentUser?.email}</small><button type="button" onClick={() => void switchToClient()} disabled={switchingMode}>{switchingMode ? 'Switching…' : 'Switch to client'}</button><button type="button" onClick={() => void logout()}>Sign out</button></div></details><Link className="provider-home__icon-link" to="/notifications" aria-label="Notifications"><Bell size={19} aria-hidden="true" /></Link></div></div>
    {modeError && <p className="provider-home__error" role="alert">{modeError}</p>}
    <header className="provider-home__welcome"><div><p className="provider-home__eyebrow">YOUR WORKSPACE</p><h1>Welcome, <em>{currentUser?.profile?.businessName || currentUser?.name || 'Provider'}</em>!</h1><p>Your bookings, quotes and next steps, all in one place.</p></div><Link className="provider-home__primary" to="/provider-dashboard/listings"><BriefcaseBusiness size={17} aria-hidden="true" /> Manage services <ArrowUpRight size={15} aria-hidden="true" /></Link></header>
    <AttentionPanel role="provider" bookings={bookings.data} quotes={requests.data} loading={bookings.isPending || requests.isPending} compact />
    <section className="provider-snapshot" aria-labelledby="snapshot-title"><div className="provider-home__section-head"><div><p className="provider-home__eyebrow">THE BIG PICTURE</p><h2 id="snapshot-title">Business snapshot</h2></div><div className="provider-snapshot__range"><FilterSelect label="Snapshot date range" name="snapshot-period" compact defaultValue="30" options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }]} onChange={value => setPeriod(Number(value) as 7 | 30 | 90)} popoverClassName="provider-period-popover" /></div></div>
      {business.isError && <p role="alert" className="provider-home__error">Business snapshot could not be loaded. Refresh to try again.</p>}
      <div className="provider-snapshot__grid">{[
        {label:'Booking requests', value:snapshot?.bookingRequests, description:`Received in the last ${period} days`, icon:CalendarDays},
        {label:'Quote requests', value:snapshot?.quoteRequests, description:`Received in the last ${period} days`, icon:FileText},
        {label:'Completed bookings', value:snapshot?.completedBookings, description:`Completed in the last ${period} days`, icon:CheckCircle2},
        {label:'Awaiting your response', value:snapshot?.pendingQuoteRequests, description:'Quote requests waiting for you', icon:Clock3},
      ].map(({label,value,description,icon:Icon}) => <article className="provider-snapshot__card" key={label}><div><span>{label}</span><Icon size={16} aria-hidden="true" /></div><strong>{value ?? '—'}</strong><small>{description}</small></article>)}</div>
    </section>
    <div className="provider-home__columns"><section className="provider-home__card provider-bookings"><div className="provider-home__section-head"><h2>Bookings</h2><Link to="/bookings">View all <ArrowRight size={15} aria-hidden="true" /></Link></div><div className="provider-bookings__tabs" role="group" aria-label="Booking status"><button type="button" aria-pressed={bookingTab === 'upcoming'} onClick={() => setBookingTab('upcoming')}>Upcoming <span>{bookings.data ? upcoming.length : '—'}</span></button><button type="button" aria-pressed={bookingTab === 'completed'} onClick={() => setBookingTab('completed')}>Completed <span>{bookings.data ? completed.length : '—'}</span></button></div>
      {bookings.isPending ? <p className="provider-home__empty">Loading bookings…</p> : bookings.isError ? <p className="provider-home__empty" role="alert">Bookings could not be loaded.</p> : shownBookings.length ? <div className="provider-bookings__list">{shownBookings.slice(0, 4).map(item => <Link key={item.id} to={bookingHistoryPath(item.id)}><span className="provider-home__tile-icon"><CalendarDays size={17} aria-hidden="true" /></span><span><strong>{item.serviceTitle}</strong><small>{item.clientName} · {formatSlot(item)}</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div> : <div className="provider-home__empty"><span className="provider-home__tile-icon"><CalendarDays size={19} aria-hidden="true" /></span><strong>No {bookingTab} bookings</strong><p>{bookingTab === 'upcoming' ? 'Your upcoming appointments will appear here.' : 'Your completed bookings will appear here.'}</p>{bookingTab === 'upcoming' && completed.length > 0 && <button type="button" onClick={() => setBookingTab('completed')}>View completed bookings</button>}</div>}
    </section><section className="provider-home__card provider-quotes"><div className="provider-home__section-head"><div><h2>Quote activity</h2><p>Last {period} days</p></div><Link to="/quotes">View all <ArrowRight size={15} aria-hidden="true" /></Link></div><dl>{[['Requests received',snapshot?.quoteRequests],['Quotes submitted',snapshot?.submittedQuotes],['Awaiting client response',snapshot?.awaitingClientResponse]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl><p className="provider-quotes__note"><Clock3 size={15} aria-hidden="true" /> {snapshot ? `${snapshot.expiringQuotes} quotes expiring in the next 7 days` : 'Quote activity will appear here'}</p></section></div>
    <ProviderBusinessInsights />
    <details className="provider-more"><summary>More activity <span>View performance and recent bookings <span aria-hidden="true">↓</span></span></summary>
    <div className="dashboard-metrics mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(item => <div key={item.label} className={`${panel} dashboard-metric`}><p className="text-sm text-emerald-300">{item.label}</p><p className="mt-2 text-3xl font-semibold text-home-text">{item.value}</p><p className="mt-2 text-xs text-emerald-300">{item.help}</p></div>)}</div>
    {(bookings.isError || requests.isError || insights.isError) && <p role="alert" className="mt-4 text-red-300">Some dashboard information could not be loaded. Refresh to try again.</p>}
    <section className={`${panel} dashboard-activity mt-6`}><div className="dashboard-section-heading"><div><p className="dashboard-kicker">RECENTLY COMPLETED</p><h2>Your activity</h2><p>Your latest completed bookings</p></div><Link className="dashboard-view-link" to="/bookings">View all <ArrowUpRight size={15} /></Link></div>{bookings.isPending && <p className="dashboard-empty">Loading activity…</p>}{bookings.isSuccess && !recentCompleted.length && <p className="dashboard-empty">Your completed bookings will appear here.</p>}<div className="dashboard-activity__list">{recentCompleted.map(item => <Link key={item.id} to={bookingHistoryPath(item.id)} className="dashboard-activity__item"><span className="dashboard-activity__icon"><Check size={17} /></span><span className="dashboard-activity__details"><strong>{item.serviceTitle}</strong><small>{item.clientName} · {formatInboxTime(new Date(completedAt(item)).toISOString())}</small></span><span className="dashboard-activity__badge">Completed</span><ArrowUpRight className="dashboard-activity__arrow" size={16} /></Link>)}</div></section>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><UpcomingAppointments bookings={bookings.data} loading={bookings.isPending} role="provider" />
      <section className={panel}><div className="flex items-center justify-between gap-3"><h2 className="text-3xl">Quote requests</h2><Link className="dashboard-view-link" to="/quotes">View all <ArrowUpRight size={15} aria-hidden="true" /></Link></div>{requests.isPending && <p className="mt-4">Loading requests…</p>}{requests.isSuccess && !pending.length && <p className="mt-4 text-sm text-emerald-300">No requests awaiting a quotation.</p>}<div className="mt-4 space-y-3">{pending.slice(0, 5).map(item => <Link key={item.id} to={`/quotes?request=${encodeURIComponent(item.id)}`} className="block rounded-xl border border-home-line p-4 hover:bg-home-canvas"><p className="font-semibold text-home-text">{item.listing.title}</p><p className="mt-1 text-sm text-emerald-300">{item.client.user.name || 'Client'} · {item.status === 'RevisionRequested' ? 'Changes requested' : 'Awaiting quotation'}</p><PresenceStatus userId={item.clientId} /><p className="mt-1 text-sm text-emerald-300">Preferred: {quoteTime(item.preferredAt)}</p></Link>)}</div></section></div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className={`${panel} performance-panel`}><div className="dashboard-section-heading"><div><p className="dashboard-kicker">YOUR PROGRESS</p><h2>Weekly performance</h2><p>A little look at your last 7 days</p></div><span className="dashboard-heading-icon"><TrendingUp size={19} /></span></div>{insights.data && <div className="performance-grid">{[{ label: 'Quote requests', value: insights.data.weeklyRequests, icon: ClipboardList }, { label: 'Bookings', value: insights.data.weeklyBookings, icon: Sparkles }, { label: 'Completed', value: insights.data.weeklyCompleted, icon: Check }].map(({ label, value, icon: Icon }) => <div key={label} className="performance-stat"><Icon size={17} aria-hidden="true" /><strong>{value}</strong><span>{label}</span></div>)}</div>}{insights.isPending && <p className="dashboard-empty">Loading performance…</p>}</section>
      <section className={`${panel} marketplace-panel`}><div className="dashboard-section-heading"><div><p className="dashboard-kicker">AROUND YOU</p><h2>Local marketplace</h2>{insights.data && <p className="marketplace-location"><MapPin size={13} /> {insights.data.location}</p>}</div><span className="dashboard-heading-icon"><Sparkles size={19} /></span></div>{insights.data && (insights.data.localCategories.length ? <ul className="marketplace-categories">{insights.data.localCategories.map(row => <li key={row.category}><span><strong>{categoryLabel(row.category)}</strong><small>{row.newThisWeek} new in the last 7 days</small></span><span className="marketplace-count"><b>{row.count}</b> {row.count === 1 ? 'listing' : 'listings'}</span></li>)}</ul> : <p className="dashboard-empty">No published listings in this area yet.</p>)}{insights.isPending && <p className="dashboard-empty">Loading marketplace…</p>}</section></div>
    </details>
  </div></main>;
}
