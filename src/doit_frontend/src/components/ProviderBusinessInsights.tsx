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

const rangeOptions: Days[] = [7, 30, 90];

export function businessInsightsQuery(id: string, days: Days) {
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
  const data = useQuery(businessInsightsQuery(providerId, days));
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

  const hasActivity = insight?.trends.some(row => row.bookingRequests || row.quoteRequests || row.completedBookings) ?? false;
  return <section id="business-insights" className="provider-business-insights insights-redesign" aria-labelledby="business-insights-title">
    <div className="insights-redesign__header"><div><p className="provider-home__eyebrow">YOUR PROGRESS</p><h2 id="business-insights-title">Business insights</h2><p>A closer look at how your business is doing.</p></div><div className="insights-redesign__range" role="group" aria-label="Insights date range">{rangeOptions.map(option => <button key={option} type="button" aria-pressed={days === option} onClick={() => { setDays(option); setObservation(''); setObservationError(''); }}>{option} days</button>)}</div></div>
    {data.isPending && <p className="insights-redesign__notice" role="status">Loading business insights…</p>}
    {data.isError && <p className="insights-redesign__notice" role="alert">Business insights could not be loaded. Refresh to try again.</p>}
    {insight && overview && <>
      <div className="insights-redesign__highlights">{[metrics[1], metrics[2], metrics[6], metrics[7]].map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>)}</div>
      <div className="insights-redesign__sections">
        <details><summary><span><strong>Activity &amp; trends</strong><small>Bookings, quotations and changes over time</small></span><span aria-hidden="true">+</span></summary><div className="insights-redesign__content">
          <div className="insights-redesign__mini-grid">{metrics.map(metric => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>)}</div>
          <h3>Booking and quote activity</h3><p className="insights-redesign__muted">{days === 7 ? 'Daily' : 'Weekly'} activity · South African time</p>
          {!hasActivity ? <p className="insights-redesign__notice">No activity in this period yet.</p> : <><div className="insights-redesign__chart-wrap"><div className="provider-insights-chart" style={{ minWidth: `${Math.max(560, groups.length * 54)}px` }} role="img" aria-label={`Booking requests, quote requests and completed bookings over the last ${days} days`}>{groups.map((row, index) => <div className="provider-insights-chart__group" key={`${row.label}-${index}`}><div className="provider-insights-chart__bars"><span title={`${row.bookingRequests} booking requests`} className="provider-insights-chart__bar is-booking" style={{ height: `${row.bookingRequests / maximum * 100}%`, visibility: row.bookingRequests ? 'visible' : 'hidden' }} /><span title={`${row.quoteRequests} quote requests`} className="provider-insights-chart__bar is-quote" style={{ height: `${row.quoteRequests / maximum * 100}%`, visibility: row.quoteRequests ? 'visible' : 'hidden' }} /><span title={`${row.completedBookings} completed bookings`} className="provider-insights-chart__bar is-completed" style={{ height: `${row.completedBookings / maximum * 100}%`, visibility: row.completedBookings ? 'visible' : 'hidden' }} /></div><span className="provider-insights-chart__label">{row.label}</span></div>)}</div></div><div className="insights-redesign__legend"><span><i className="provider-insights-legend is-booking" />Booking requests</span><span><i className="provider-insights-legend is-quote" />Quote requests</span><span><i className="provider-insights-legend is-completed" />Completed</span></div><ul className="sr-only">{groups.map((row, index) => <li key={`${row.label}-${index}`}>{row.label}: {row.bookingRequests} booking requests, {row.quoteRequests} quote requests, {row.completedBookings} completed bookings</li>)}</ul></>}
          <div className="insights-redesign__comparison"><div><span>Booking request change</span><strong>{deltaText(insight.comparison.bookingRequestChangePercent)}</strong><small>Previous period: {insight.comparison.previousBookingRequests}</small></div><div><span>Quote request change</span><strong>{deltaText(insight.comparison.quoteRequestChangePercent)}</strong><small>Previous period: {insight.comparison.previousQuoteRequests}</small></div></div>
        </div></details>
        <details><summary><span><strong>Quote outcomes</strong><small>See how clients responded to your quotes</small></span><span aria-hidden="true">+</span></summary><div className="insights-redesign__content"><div className="insights-redesign__rate"><strong>{overview.quoteAcceptanceRate === null ? '—' : `${overview.quoteAcceptanceRate}%`}</strong><span>acceptance rate</span></div><p className="insights-redesign__muted">{overview.quoteOutcomeCount === 0 ? 'Not enough quote outcomes to calculate a rate yet.' : `${overview.acceptedQuotes} accepted out of ${overview.quoteOutcomeCount} outcomes.`} Active quotes are excluded.</p><dl className="insights-redesign__mini-grid">{[['Accepted',overview.acceptedQuotes],['Rejected',overview.rejectedQuotes],['Expired',overview.expiredQuotes],['Pending requests',overview.pendingQuoteRequests]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="insights-redesign__muted">Expired quotes passed their expiry date and were not necessarily rejected.</p></div></details>
        <details><summary><span><strong>Services &amp; opportunities</strong><small>Service activity and suggestions</small></span><span aria-hidden="true">+</span></summary><div className="insights-redesign__content"><h3>Service activity</h3><p className="insights-redesign__muted">Requests and completed bookings by service.</p>{!insight.services.length ? <p className="insights-redesign__notice">No service listings to compare yet.</p> : <ul className="insights-redesign__list">{insight.services.map(service => <li key={service.serviceId}><strong>{service.service}</strong><span>{service.quoteRequests} quotes · {service.bookingRequests} bookings · {service.completedBookings} completed</span></li>)}</ul>}<h3>Opportunities to review</h3>{!insight.recommendations.length ? <p className="insights-redesign__muted">No immediate suggestions right now.</p> : <ul className="insights-redesign__list">{insight.recommendations.map(item => <li key={item.key}><strong>{item.title}</strong><span>{item.detail}</span></li>)}</ul>}<div className="insights-redesign__ai"><div><h3>AI business observations</h3><p className="insights-redesign__muted">Suggestions based on your business metrics.</p></div><button type="button" onClick={() => void generateObservation()} disabled={generating}>{generating ? 'Preparing…' : 'Generate observations'}</button></div>{generating && <p className="insights-redesign__muted" role="status">Analysing your selected period…</p>}{observationError && <p className="insights-redesign__notice" role="alert">{observationError}</p>}{observation && <p className="insights-redesign__notice whitespace-pre-wrap">{observation}</p>}</div></details>
      </div>
    </>}
  </section>;
}
