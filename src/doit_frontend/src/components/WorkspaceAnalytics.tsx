import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, CheckCircle2, CircleDollarSign, ClipboardList, Star, XCircle } from 'lucide-react';
import { formatRand } from '../utils/money';
import { workspaceAnalytics } from '../utils/workspaces';

const periods = [{ value: 7, label: 'Last 7 days' }, { value: 30, label: 'Last 30 days' }, { value: 90, label: 'Last 90 days' }, { value: 365, label: 'Last 12 months' }];

export default function WorkspaceAnalytics({ workspaceId }: { workspaceId: string }) {
  const [days, setDays] = useState(30);
  const query = useQuery(workspaceAnalytics(workspaceId, days));
  if (query.isPending) return <p className="workspace-empty">Loading analytics…</p>;
  if (query.isError) return <p className="workspace-error" role="alert">{query.error.message}</p>;
  const data = query.data!;
  const maxService = Math.max(1, ...data.business.popularServices.map(item => item.count));
  return <div className="workspace-analytics">
    <div className="workspace-analytics__head"><div><p className="workspace-kicker">BUSINESS PERFORMANCE</p><h2>Operational insights</h2><p>Understand workload and business performance. These figures are for operations, not individual competition.</p></div><select value={days} onChange={event => setDays(Number(event.target.value))} aria-label="Analytics period">{periods.map(period => <option key={period.value} value={period.value}>{period.label}</option>)}</select></div>
    <div className="workspace-metrics">
      <article className="workspace-metric"><span>Bookings</span><ClipboardList size={17} /><strong>{data.business.totalBookings}</strong></article>
      <article className="workspace-metric"><span>Completed</span><CheckCircle2 size={17} /><strong>{data.business.completedBookings}</strong></article>
      <article className="workspace-metric"><span>Cancelled</span><XCircle size={17} /><strong>{data.business.cancelledBookings}</strong></article>
      <article className="workspace-metric"><span>Revenue recorded</span><CircleDollarSign size={17} /><strong>{formatRand(data.business.revenueCents)}</strong></article>
      <article className="workspace-metric"><span>Average booking value</span><BarChart3 size={17} /><strong>{formatRand(data.business.averageBookingValueCents)}</strong></article>
    </div>
    <div className="workspace-columns">
      <section className="workspace-card">
        <div className="workspace-card__head"><div><p className="workspace-kicker">DEMAND</p><h2>Popular services</h2></div></div>
        {!data.business.popularServices.length && <p className="workspace-empty">No bookings in this period.</p>}
        <div className="workspace-service-bars">{data.business.popularServices.map(item => <div key={item.title}><span><strong>{item.title}</strong><small>{item.category}</small></span><div><i style={{ width: `${(item.count / maxService) * 100}%` }} /></div><b>{item.count}</b></div>)}</div>
      </section>
      <section className="workspace-card">
        <div className="workspace-card__head"><div><p className="workspace-kicker">STATUS</p><h2>Booking outcomes</h2></div></div>
        <div className="workspace-status-list">{Object.entries(data.business.statusCounts).map(([status, count]) => <div key={status}><span>{status}</span><b>{count}</b></div>)}{!Object.keys(data.business.statusCounts).length && <p className="workspace-empty">No bookings in this period.</p>}</div>
      </section>
    </div>
    <section className="workspace-card">
      <div className="workspace-card__head"><div><p className="workspace-kicker">TEAM INSIGHTS</p><h2>Workload and completion</h2><p>{data.note}</p></div><Star size={19} /></div>
      <div className="workspace-analytics-table">
        <div className="workspace-analytics-table__head"><span>Team member</span><span>Assigned</span><span>Completed</span><span>Revenue</span><span>Rating</span><span>Completion</span></div>
        {data.team.map(member => <div key={member.id} className="workspace-analytics-table__row"><span><strong>{member.name}</strong><small>{member.role} · {member.status}</small></span><span>{member.assignedBookings}</span><span>{member.completedBookings}</span><span>{formatRand(member.revenueCents)}</span><span>{member.averageRating != null ? `${member.averageRating.toFixed(1)} / 5` : '—'}</span><span>{member.completionRate != null ? `${member.completionRate}%` : '—'}</span></div>)}
      </div>
    </section>
  </div>;
}
