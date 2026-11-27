import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, ApiRequestError } from '../utils/apiRequest';
import { useAuth } from '../contexts/AppContext';

type Days = 7 | 30 | 90;
type DailyTrend = { day: string; bookingRequests: number; confirmedRequests: number; completedBookings: number; quoteRequests: number };
type BusinessInsights = {
  period: { days: Days; from: string; to: string; timezone: string };
  overview: {
    bookingRequests: number; pendingBookingRequests: number; confirmedBookings: number; completedBookings: number;
    quoteRequests: number; submittedQuotes: number; acceptedQuotes: number; rejectedQuotes: number; expiredQuotes: number;
    pendingQuoteRequests: number; awaitingClientResponse: number; expiringQuotes: number; quoteOutcomeCount: number; quoteAcceptanceRate: number | null;
  };
  comparison: { previousBookingRequests: number; previousQuoteRequests: number; bookingRequestChangePercent: number | null; quoteRequestChangePercent: number | null };
  trends: DailyTrend[];
  services: { serviceId: string; service: string; quoteRequests: number; bookingRequests: number; completedBookings: number }[];
  recommendations: { key: string; title: string; detail: string }[];
};
type Observation = { answer: string };

const card = 'rounded-2xl border border-home-line bg-home-surface p-5';
const rangeOptions: Days[] = [7, 30, 90];

function query(id: string, days: Days) {
  return {
    queryKey: ['providers', id, 'business-insights', days],
    queryFn: ({ signal }: { signal: AbortSignal }) => apiRequest<BusinessInsights>(`/providers/me/business-insights?days=${days}`, { signal }),
    enabled: !!id,
    staleTime: 60_000,
    retry: false,
  };
}

function trendGroups(rows: DailyTrend[], days: Days) {
  if (days === 7) return rows.map(row => ({ label: row.day.slice(5), bookingRequests: row.bookingRequests, quoteRequests: row.quoteRequests, completedBookings: row.completedBookings }));
  const groups: Array<{ label: string; bookingRequests: number; quoteRequests: number; completedBookings: number }> = [];
  rows.forEach((row, index) => {
    const groupIndex = Math.floor(index / 7);
    if (!groups[groupIndex]) groups[groupIndex] = { label: row.day.slice(5), bookingRequests: 0, quoteRequests: 0, completedBookings: 0 };
    groups[groupIndex].bookingRequests += row.bookingRequests;
    groups[groupIndex].quoteRequests += row.quoteRequests;
    groups[groupIndex].completedBookings += row.completedBookings;
  });
  return groups;
}

function deltaText(value: number | null) {
  if (value === null) return 'Not enough comparison data to calculate a percentage';
  if (value === 0) return 'No change from the previous period';
  return `${value > 0 ? '+' : ''}${value}% from the previous period`;
}

export default function ProviderBusinessInsights() {
  const { currentUser } = useAuth();
  const providerId = currentUser?.id ?? '';
  const [days, setDays] = useState<Days>(30);
  const [observation, setObservation] = useState('');
  const [observationError, setObservationError] = useState('');
  const [generating, setGenerating] = useState(false);
  const data = useQuery(query(providerId, days));
  const insight = data.data;
  const overview = insight?.overview;
  const groups = trendGroups(insight?.trends ?? [], days);
  const maximum = Math.max(1, ...groups.flatMap(row => [row.bookingRequests, row.quoteRequests, row.completedBookings]));
  const metrics = overview ? [
    { label: 'Booking requests', value: overview.bookingRequests, detail: `New in the last ${days} days` },
    { label: 'Awaiting booking response', value: overview.pendingBookingRequests, detail: 'Current pending requests' },
    { label: 'Confirmed bookings', value: overview.confirmedBookings, detail: 'Current confirmed total' },
    { label: 'Completed bookings', value: overview.completedBookings, detail: `Completed in the last ${days} days` },
    { label: 'Quote requests', value: overview.quoteRequests, detail: `Received in the last ${days} days` },
    { label: 'Quotes submitted', value: overview.submittedQuotes, detail: `Sent in the last ${days} days` },
    { label: 'Awaiting client response', value: overview.awaitingClientResponse, detail: 'Current active quotations' },
    { label: 'Expiring soon', value: overview.expiringQuotes, detail: 'Within the next 7 days' },
  ] : [];

  async function generateObservation() {
    if (!providerId || generating) return;
    setGenerating(true);
    setObservation('');
    setObservationError('');
    try {
      const result = await apiRequest<Observation>('/ai/provider/insights', { method: 'POST', data: { days } });
      setObservation(result.answer);
    } catch (cause) {
      setObservationError(cause instanceof ApiRequestError && cause.status === 429
        ? 'You have reached the AI request limit. Please try again shortly.'
        : 'AI observations are unavailable right now. Your business metrics remain available above.');
    } finally {
      setGenerating(false);
    }
  }

  return <section id="business-insights" className="mt-8 scroll-mt-24" aria-labelledby="business-insights-title">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div><p className="dashboard-kicker">PROVIDER ANALYTICS</p><h2 id="business-insights-title" className="text-3xl text-home-text">Business Insights</h2><p className="mt-1 text-sm text-emerald-300">Verified activity from your bookings, quotes, and services.</p></div>
      <div className="flex rounded-xl border border-home-line bg-home-surface p-1" role="group" aria-label="Insights date range">
        {rangeOptions.map(option => <button key={option} type="button" aria-pressed={days === option} onClick={() => { setDays(option); setObservation(''); setObservationError(''); }} className={`rounded-lg px-3 py-2 text-sm ${days === option ? 'bg-emerald-700 font-semibold text-white' : 'text-emerald-200 hover:bg-home-canvas'}`}>{option} days</button>)}
      </div>
    </div>

    {data.isPending && <p className={`${card} text-emerald-200`} role="status">Loading business insights…</p>}
    {data.isError && <p className={`${card} text-red-300`} role="alert">Business metrics could not be loaded. Refresh to try again.</p>}
    {insight && overview && <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(metric => <article key={metric.label} className={`${card} min-h-32`}><p className="text-sm text-emerald-300">{metric.label}</p><p className="mt-2 text-3xl font-semibold text-home-text">{metric.value}</p><p className="mt-1 text-xs text-emerald-300">{metric.detail}</p></article>)}</div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <article className={card}>
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-xl font-semibold text-home-text">Booking and quote activity</h3><p className="mt-1 text-xs text-emerald-300">Counts by day in Africa/Johannesburg time. Confirmed and completed bookings use their recorded statuses.</p></div><p className="text-xs text-emerald-300">{insight.period.from} – {insight.period.to} exclusive</p></div>
          {!insight.trends.some(row => row.bookingRequests || row.quoteRequests || row.completedBookings) && <p className="mt-6 rounded-xl bg-home-canvas p-4 text-sm text-emerald-200">No booking or quote activity was recorded in this period, so there is no trend to display.</p>}
          {!!insight.trends.length && <div className="mt-6 overflow-x-auto pb-2"><div className="provider-insights-chart" style={{ minWidth: `${Math.max(560, groups.length * 54)}px` }} role="img" aria-label={`Daily grouped counts of booking requests, quote requests, and completed bookings for the last ${days} days`}>
            {groups.map((row, index) => <div className="provider-insights-chart__group" key={`${row.label}-${index}`}><div className="provider-insights-chart__bars"><span title={`${row.bookingRequests} booking requests`} className="provider-insights-chart__bar is-booking" style={{ height: `${Math.max(3, row.bookingRequests / maximum * 100)}%` }} /><span title={`${row.quoteRequests} quote requests`} className="provider-insights-chart__bar is-quote" style={{ height: `${Math.max(3, row.quoteRequests / maximum * 100)}%` }} /><span title={`${row.completedBookings} completed bookings`} className="provider-insights-chart__bar is-completed" style={{ height: `${Math.max(3, row.completedBookings / maximum * 100)}%` }} /></div><span className="provider-insights-chart__label">{row.label}</span></div>)}
          </div><div className="mt-3 flex flex-wrap gap-4 text-xs text-emerald-200"><span><i className="provider-insights-legend is-booking" />Booking requests</span><span><i className="provider-insights-legend is-quote" />Quote requests</span><span><i className="provider-insights-legend is-completed" />Completed</span></div></div>}
          <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-home-canvas p-4"><p className="text-xs text-emerald-300">Booking request change</p><p className="mt-1 font-semibold text-home-text">{deltaText(insight.comparison.bookingRequestChangePercent)}</p><p className="mt-1 text-xs text-emerald-300">Previous period: {insight.comparison.previousBookingRequests}</p></div><div className="rounded-xl bg-home-canvas p-4"><p className="text-xs text-emerald-300">Quote request change</p><p className="mt-1 font-semibold text-home-text">{deltaText(insight.comparison.quoteRequestChangePercent)}</p><p className="mt-1 text-xs text-emerald-300">Previous period: {insight.comparison.previousQuoteRequests}</p></div></div>
        </article>

        <article className={card}>
          <h3 className="text-xl font-semibold text-home-text">Quote outcomes</h3><p className="mt-1 text-xs text-emerald-300">Outcomes recorded in this period; pending and active quotes are excluded from the rate.</p>
          <div className="mt-5 flex items-end gap-3"><p className="text-4xl font-semibold text-home-text">{overview.quoteAcceptanceRate === null ? '—' : `${overview.quoteAcceptanceRate}%`}</p><p className="pb-1 text-sm text-emerald-300">acceptance rate</p></div>
          {overview.quoteOutcomeCount === 0 ? <p className="mt-2 text-sm text-emerald-300">Not enough quote outcomes in this period to calculate a rate.</p> : <p className="mt-2 text-xs text-emerald-300">{overview.acceptedQuotes} accepted of {overview.quoteOutcomeCount} outcomes (accepted + rejected after submission + expired).</p>}
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-home-canvas p-3"><dt className="text-emerald-300">Accepted</dt><dd className="mt-1 text-xl font-semibold text-home-text">{overview.acceptedQuotes}</dd></div><div className="rounded-xl bg-home-canvas p-3"><dt className="text-emerald-300">Rejected</dt><dd className="mt-1 text-xl font-semibold text-home-text">{overview.rejectedQuotes}</dd></div><div className="rounded-xl bg-home-canvas p-3"><dt className="text-emerald-300">Expired</dt><dd className="mt-1 text-xl font-semibold text-home-text">{overview.expiredQuotes}</dd></div><div className="rounded-xl bg-home-canvas p-3"><dt className="text-emerald-300">Pending request</dt><dd className="mt-1 text-xl font-semibold text-home-text">{overview.pendingQuoteRequests}</dd></div></dl>
          <p className="mt-3 text-xs text-emerald-300">Expired means the latest submitted version passed its expiry time while still quoted; it does not mean the client rejected it. Response time is omitted because the application does not record a dedicated provider response event.</p>
        </article>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <article className={card}><h3 className="text-xl font-semibold text-home-text">Service activity</h3><p className="mt-1 text-xs text-emerald-300">Requests and completed bookings per service. Activity is not a measure of profit.</p>{!insight.services.length ? <p className="mt-4 text-sm text-emerald-300">No service listings are available to compare.</p> : <ul className="mt-4 space-y-3">{insight.services.map(service => <li key={service.serviceId} className="flex items-center justify-between gap-4 rounded-xl bg-home-canvas p-3"><span className="min-w-0 truncate font-medium text-home-text">{service.service}</span><span className="shrink-0 text-right text-xs text-emerald-200">{service.quoteRequests} quotes · {service.bookingRequests} bookings · {service.completedBookings} completed</span></li>)}</ul>}</article>
        <article className={card}><h3 className="text-xl font-semibold text-home-text">Opportunities to review</h3>{!insight.recommendations.length ? <p className="mt-4 text-sm text-emerald-300">No immediate items were identified from these records.</p> : <ul className="mt-4 space-y-3">{insight.recommendations.map(item => <li key={item.key} className="rounded-xl border border-home-line bg-home-canvas p-4"><p className="font-semibold text-home-text">{item.title}</p><p className="mt-1 text-sm text-emerald-200">{item.detail}</p></li>)}</ul>}</article>
      </div>

      <article className={`${card} mt-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-semibold text-home-text">AI business observations</h3><p className="mt-1 text-sm text-emerald-300">Generated from these aggregated metrics only; suggestions do not change your account or marketplace records.</p></div><button type="button" className="btn-primary" onClick={() => void generateObservation()} disabled={generating}>{generating ? 'Preparing observations…' : 'Generate observations'}</button></div>
        {generating && <p className="mt-4 text-sm text-emerald-200" role="status">Analysing your selected period…</p>}
        {observationError && <p className="mt-4 text-sm text-amber-200" role="alert">{observationError}</p>}
        {observation && <p className="mt-4 whitespace-pre-wrap rounded-xl bg-home-canvas p-4 text-sm leading-relaxed text-home-text">{observation}</p>}
      </article>
    </>}
  </section>;
}
