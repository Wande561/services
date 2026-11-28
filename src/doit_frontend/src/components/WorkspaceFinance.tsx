import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDownRight, Banknote, ReceiptText, RotateCcw, WalletCards } from 'lucide-react';
import { formatRand } from '../utils/money';
import { workspaceFinance } from '../utils/workspaces';

function date(value: string) {
  return new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium' }).format(new Date(value));
}

export default function WorkspaceFinance({ workspaceId }: { workspaceId: string }) {
  const query = useQuery(workspaceFinance(workspaceId));
  if (query.isPending) return <p className="workspace-empty">Loading financial records…</p>;
  if (query.isError) return <p className="workspace-error" role="alert">{query.error.message}</p>;
  const data = query.data!;
  const maxMonth = Math.max(1, ...data.monthly.map(item => item.amountCents));
  return <div className="workspace-finance">
    <div className="workspace-metrics workspace-metrics--finance">
      <article className="workspace-metric"><span>Recorded payments</span><Banknote size={17} /><strong>{formatRand(data.summary.recordedCents)}</strong><small>{data.summary.recordedCount} entries</small></article>
      <article className="workspace-metric"><span>Confirmed deposits</span><WalletCards size={17} /><strong>{formatRand(data.summary.depositsCents)}</strong><small>May also appear in payments</small></article>
      <article className="workspace-metric"><span>Outstanding</span><AlertTriangle size={17} /><strong>{formatRand(data.summary.outstandingCents)}</strong><small>{data.summary.outstandingCount} completed bookings</small></article>
      <article className="workspace-metric"><span>Voided / refunded</span><RotateCcw size={17} /><strong>{formatRand(data.summary.voidedCents)}</strong><small>{data.summary.voidedCount} records</small></article>
    </div>
    <section className="workspace-card">
      <div className="workspace-card__head"><div><p className="workspace-kicker">LAST 12 MONTHS</p><h2>Revenue recorded</h2><p>Provider-recorded payments, excluding voided entries.</p></div></div>
      <div className="workspace-bars">{data.monthly.map(item => <div key={item.month} className="workspace-bar"><span>{formatRand(item.amountCents)}</span><div><i style={{ height: `${Math.max(3, (item.amountCents / maxMonth) * 100)}%` }} /></div><small>{item.label}</small></div>)}</div>
    </section>
    <div className="workspace-columns">
      <section className="workspace-card">
        <div className="workspace-card__head"><div><p className="workspace-kicker">PAYMENT HISTORY</p><h2>Recorded payments</h2></div><ReceiptText size={20} /></div>
        {!data.history.length && <p className="workspace-empty">No payments recorded yet.</p>}
        <div className="workspace-table">{data.history.map(item => <div key={item.id} className="workspace-table__row"><span><strong>{item.serviceTitle}</strong><small>{item.clientName} · {date(item.recordedAt)}</small></span><span><b>{formatRand(item.amountCents)}</b><small>{item.method}</small></span></div>)}</div>
      </section>
      <section className="workspace-card">
        <div className="workspace-card__head"><div><p className="workspace-kicker">FOLLOW UP</p><h2>Outstanding payments</h2></div><ArrowDownRight size={20} /></div>
        {!data.outstanding.length && <p className="workspace-empty">No outstanding balances.</p>}
        <div className="workspace-table">{data.outstanding.map(item => <div key={item.bookingId} className="workspace-table__row"><span><strong>{item.serviceTitle}</strong><small>{item.clientName} · completed {date(item.completedAt)}</small></span><span><b>{formatRand(item.dueCents)}</b><small>of {formatRand(item.priceCents)}</small></span></div>)}</div>
      </section>
    </div>
    <div className="workspace-columns">
      <section className="workspace-card">
        <div className="workspace-card__head"><div><p className="workspace-kicker">COMPLETED, NO RECORD</p><h2>Awaiting a payment record</h2></div></div>
        {!data.unrecorded.length && <p className="workspace-empty">Every completed booking has a payment record.</p>}
        <div className="workspace-table">{data.unrecorded.map(item => <div key={item.bookingId} className="workspace-table__row"><span><strong>{item.serviceTitle}</strong><small>{item.clientName} · {date(item.completedAt)}</small></span><span><b>{formatRand(item.priceCents ?? 0)}</b><small>agreed value</small></span></div>)}</div>
      </section>
      <section className="workspace-card">
        <div className="workspace-card__head"><div><p className="workspace-kicker">ADJUSTMENTS</p><h2>Voided / refunded</h2></div></div>
        {!data.voided.length && <p className="workspace-empty">No voided or refunded records.</p>}
        <div className="workspace-table">{data.voided.map(item => <div key={item.id} className="workspace-table__row"><span><strong>{item.serviceTitle}</strong><small>{item.clientName} · {date(item.recordedAt)}</small></span><span><b>{formatRand(item.amountCents)}</b><small>{item.voidedAt ? `voided ${date(item.voidedAt)}` : 'voided'}</small></span></div>)}</div>
      </section>
    </div>
  </div>;
}
