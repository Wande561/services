import { ArrowUpRight, CalendarClock, CheckCircle2, CreditCard, FileText, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Booking } from '../types';
import { bookingHistoryPath } from '../utils/inbox';
import { formatRand } from '../utils/money';
import { quoteTime, type QuoteRequest } from '../utils/quotes';

type AttentionIcon = 'quote' | 'deposit' | 'appointment' | 'review' | 'completion';

interface AttentionItem {
  id: string;
  title: string;
  detail: string;
  href: string;
  icon: AttentionIcon;
  priority: number;
}

const icons = {
  quote: FileText,
  deposit: CreditCard,
  appointment: CalendarClock,
  review: Star,
  completion: CheckCircle2,
};

const dayMs = 24 * 60 * 60 * 1000;

function appointmentTime(value: string) {
  return `${new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(value))} SAST`;
}

function clientItems(bookings: Booking[], requests: QuoteRequest[], now: number) {
  const items: AttentionItem[] = [];
  for (const request of requests) {
    const href = `/quotes?request=${encodeURIComponent(request.id)}`;
    if (request.status === 'DepositPending') {
      items.push({
        id: `deposit-${request.id}`, title: 'Pay the booking deposit', href, icon: 'deposit', priority: 0,
        detail: `${request.listing.title} · ${formatRand(request.depositCents ?? 0)}`,
      });
      continue;
    }
    if (request.status === 'SlotUnavailable') {
      items.push({
        id: `slot-${request.id}`, title: 'Choose another appointment time', href, icon: 'quote', priority: 0,
        detail: `${request.listing.title} · the requested time was taken`,
      });
      continue;
    }
    if (request.status !== 'Quoted') continue;
    const expiry = request.versions[0]?.expiresAt;
    if (!expiry || new Date(expiry).getTime() <= now) continue;
    const expiring = new Date(expiry).getTime() - now <= 2 * dayMs;
    items.push({
      id: `quote-${request.id}`, title: 'Review your quotation', href, icon: 'quote', priority: expiring ? 0 : 1,
      detail: `${request.listing.title} · ${expiring ? `expires ${quoteTime(expiry)}` : 'ready to review'}`,
    });
  }
  for (const booking of bookings) {
    const startsAt = new Date(booking.startsAt).getTime();
    if (booking.status === 'Confirmed' && startsAt >= now && startsAt <= now + 7 * dayMs) {
      items.push({
        id: `appointment-${booking.id}`, title: 'Upcoming appointment', href: bookingHistoryPath(booking.id), icon: 'appointment', priority: 1,
        detail: `${booking.serviceTitle} · ${appointmentTime(booking.startsAt)}`,
      });
    }
    if (booking.status === 'Completed' && !booking.review) {
      items.push({
        id: `review-${booking.id}`, title: 'Leave a review', href: bookingHistoryPath(booking.id), icon: 'review', priority: 2,
        detail: `${booking.serviceTitle} · ${booking.providerName}`,
      });
    }
  }
  return items;
}

function providerItems(bookings: Booking[], requests: QuoteRequest[], now: number) {
  const items: AttentionItem[] = [];
  for (const request of requests) {
    const href = `/quotes?request=${encodeURIComponent(request.id)}`;
    if (request.status === 'Pending' || request.status === 'RevisionRequested') {
      items.push({
        id: `respond-${request.id}`, title: 'Respond to a quote request', href, icon: 'quote', priority: 0,
        detail: `${request.client.user.name || 'Client'} · ${request.listing.title}`,
      });
    } else if (request.status === 'DepositPending') {
      items.push({
        id: `deposit-${request.id}`, title: 'Confirm the deposit was received', href, icon: 'deposit', priority: 0,
        detail: `${request.listing.title} · ${formatRand(request.depositCents ?? 0)}`,
      });
    }
  }
  for (const booking of bookings) {
    if (booking.status === 'Confirmed' && booking.clientCompletedAt && !booking.providerCompletedAt) {
      items.push({
        id: `complete-${booking.id}`, title: 'Confirm the service is complete', href: bookingHistoryPath(booking.id), icon: 'completion', priority: 0,
        detail: `${booking.serviceTitle} · ${booking.clientName}`,
      });
    }
    const startsAt = new Date(booking.startsAt).getTime();
    if (booking.status === 'Confirmed' && startsAt >= now && startsAt <= now + 7 * dayMs) {
      items.push({
        id: `appointment-${booking.id}`, title: 'Upcoming appointment', href: bookingHistoryPath(booking.id), icon: 'appointment', priority: 1,
        detail: `${booking.serviceTitle} · ${appointmentTime(booking.startsAt)}`,
      });
    }
  }
  return items;
}

export default function AttentionPanel({ role, bookings, quotes, loading, compact = false }: {
  role: 'client' | 'provider';
  bookings?: Booking[];
  quotes?: QuoteRequest[];
  loading?: boolean;
  compact?: boolean;
}) {
  const now = Date.now();
  const items = role === 'client'
    ? clientItems(bookings ?? [], quotes ?? [], now)
    : providerItems(bookings ?? [], quotes ?? [], now);
  const visible = items.sort((a, b) => a.priority - b.priority).slice(0, 6);

  if (compact) return <section className="provider-attention" aria-label="Next steps">
    {loading ? <p role="status">Checking your workspace…</p> : visible.length ? <><div className="provider-attention__heading"><span className="provider-attention__icon"><CalendarClock size={19} aria-hidden="true" /></span><div><strong>Needs your attention</strong><p>{visible.length} {visible.length === 1 ? 'update' : 'updates'} to review</p></div></div><div className="provider-attention__items">{visible.map(item => <Link key={item.id} to={item.href}><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div></> : <><div className="provider-attention__heading"><span className="provider-attention__icon"><CheckCircle2 size={19} aria-hidden="true" /></span><div><strong>You’re all caught up</strong><p>New requests and updates will appear here.</p></div></div><Link className="provider-attention__link" to="/bookings">View bookings <ArrowUpRight size={16} aria-hidden="true" /></Link></>}
  </section>;

  return <section className="dashboard-panel attention-panel mt-6 rounded-2xl border border-home-line p-6" aria-labelledby="attention-heading">
    <div className="attention-panel__head">
      <div><p className="dashboard-kicker">NEXT STEPS</p><h2 id="attention-heading">Needs your attention</h2><p>Everything that is waiting on you, in one place.</p></div>
      {visible.length > 0 && <span className="attention-count" aria-label={`${visible.length} items need attention`}>{visible.length}</span>}
    </div>
    {loading && <p className="dashboard-empty">Checking your workspace…</p>}
    {!loading && !visible.length && <div className="attention-empty"><span className="attention-empty__icon"><CheckCircle2 aria-hidden="true" /></span><div><strong>All caught up</strong><p>New requests and updates will appear here.</p></div></div>}
    {visible.length > 0 && <div className="attention-list">{visible.map(item => {
      const Icon = icons[item.icon];
      return <Link key={item.id} to={item.href} className={`attention-item attention-item--${item.icon}`}>
        <span className="attention-item__icon"><Icon size={17} aria-hidden="true" /></span>
        <span className="attention-item__copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
        <ArrowUpRight className="attention-item__arrow" size={16} aria-hidden="true" />
      </Link>;
    })}</div>}
  </section>;
}
