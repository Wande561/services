import { ArrowUpRight, Banknote, CalendarClock, ReceiptText, WalletCards, Wrench, Package, Car } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Booking } from '../types';
import { bookingHistoryPath, formatInboxTime } from '../utils/inbox';
import { formatRand } from '../utils/money';
import { activePayment, paymentMethods } from '../utils/payments';
import { completedServiceValueCents } from '../utils/serviceValue';
import type { QuoteRequest } from '../utils/quotes';

export default function ClientPayments({ bookings, quotes, loading, error, quotesLoading, quotesError }: { bookings?: Booking[]; quotes?: QuoteRequest[]; loading: boolean; error: boolean; quotesLoading: boolean; quotesError: boolean }) {
  const records = (bookings ?? []).flatMap(booking => {
    const payment = activePayment(booking);
    const deposit = booking.quoteRequest?.depositConfirmedAt && booking.quoteRequest.depositCents != null ? [{ id: `deposit-${booking.id}`, booking, amount: booking.quoteRequest.depositCents, date: booking.quoteRequest.depositConfirmedAt, label: 'Confirmed deposit' }] : [];
    return [...deposit, ...(payment ? [{ id: payment.id, booking, amount: payment.amountCents, date: payment.recordedAt, label: paymentMethods[payment.method] }] : [])];
  }).sort((a, b) => b.date.localeCompare(a.date));
  const deposits = records.filter(item => item.id.startsWith('deposit-'));
  const total = (items: typeof records) => items.reduce((sum, item) => sum + item.amount, 0);
  const completedAwaiting = (bookings ?? []).filter(booking => booking.status === 'Completed' && !activePayment(booking) && !(booking.listingPrice?.priceCents === 0 && !booking.listingPrice?.maxPriceCents));
  const voided = (bookings ?? []).flatMap(booking => booking.payments.filter(payment => payment.voidedAt).map(payment => ({ booking, payment })));
  const completedQuotes = (bookings ?? []).filter(booking => booking.status === 'Completed' && booking.quoteRequestId).map(booking => ({ booking, quote: quotes?.find(quote => quote.id === booking.quoteRequestId) })).filter(item => item.quote?.versions[0]);
  const missingQuotes = (bookings ?? []).filter(booking => booking.status === 'Completed' && booking.quoteRequestId).length - completedQuotes.length;
  const costTotals = completedQuotes.reduce((sum, item) => { const version = item.quote!.versions[0]; return { labour: sum.labour + version.labourCents, materials: sum.materials + version.materialsCents, travel: sum.travel + version.travelCents }; }, { labour: 0, materials: 0, travel: 0 });
  const categories = [{ label: 'Labour', amount: costTotals.labour, icon: Wrench }, { label: 'Materials', amount: costTotals.materials, icon: Package }, { label: 'Travel', amount: costTotals.travel, icon: Car }];
  return <section className="payments-view mt-6" aria-label="Payments overview">
    <header className="payments-view__header"><div><p>YOUR PAYMENTS / OVERVIEW</p><h2>Your money, at a glance.</h2><span>Deposits and payments recorded by your providers.</span></div><span className="payments-view__icon"><WalletCards aria-hidden="true" /></span></header>
    {loading && <p className="dashboard-empty" role="status">Loading payments…</p>}
    {error && <p role="alert" className="dashboard-empty text-red-300">Could not load payments.</p>}
    {!loading && !error && <>
      <div className="payments-totals"><div className="payments-totals__main"><span>RECORDED TOTAL</span><strong>{formatRand(total(records))}</strong><small>{records.length} {records.length === 1 ? 'record' : 'records'}</small></div><div><span>CONFIRMED DEPOSITS</span><strong>{formatRand(total(deposits))}</strong><small>{deposits.length} {deposits.length === 1 ? 'deposit' : 'deposits'}</small></div><div><span>COMPLETED SERVICE VALUE</span><strong>{formatRand(completedServiceValueCents(bookings ?? []))}</strong><small>Agreed quotation totals</small></div></div>
      <p className="payments-note">These are provider-confirmed records, not bank transactions. If a recorded payment includes a deposit, the total may count that deposit twice.</p>
      <div className="payments-columns"><section className="payments-section"><div className="payments-section__head"><div><p>YOUR ACTIVITY</p><h3>Payment history</h3></div><ReceiptText aria-hidden="true" /></div>{records.length ? <ul className="payments-list">{records.map(item => <li key={item.id}><Link to={bookingHistoryPath(item.booking.id)}><span className="payments-list__icon"><Banknote size={17} /></span><span className="payments-list__detail"><strong>{item.booking.serviceTitle}</strong><small>{item.booking.providerName} · {item.label}<br />{formatInboxTime(item.date)}</small></span><strong>{formatRand(item.amount)}</strong><ArrowUpRight size={16} aria-hidden="true" /></Link></li>)}</ul> : <p className="payments-empty">No payments recorded yet.</p>}</section>
      <div className="payments-side"><section className="payments-section"><div className="payments-section__head"><div><p>COMPLETED SERVICES</p><h3>Where it goes</h3></div><WalletCards aria-hidden="true" /></div><p className="payments-section__hint">Agreed costs from completed quotes. Payments aren't allocated to individual costs.</p>{quotesLoading ? <p className="payments-empty">Loading quotation costs…</p> : quotesError ? <p className="payments-empty" role="alert">Could not load quotation costs.</p> : completedQuotes.length ? <><div className="cost-breakdown">{categories.map(({ label, amount, icon: Icon }) => <div key={label}><span className="cost-breakdown__icon"><Icon size={17} aria-hidden="true" /></span><span>{label}</span><strong>{formatRand(amount)}</strong></div>)}</div>{missingQuotes > 0 && <p className="payments-section__hint">Some completed quotation details are unavailable and are not included in this breakdown.</p>}</> : <p className="payments-empty">{missingQuotes ? 'Quotation details for your completed services are unavailable.' : 'Completed quotation costs will appear here.'}</p>}</section>
      <section className="payments-section"><div className="payments-section__head"><div><p>TO KEEP IN MIND</p><h3>Awaiting a record</h3></div><CalendarClock aria-hidden="true" /></div>{completedAwaiting.length ? <><p className="payments-section__hint">These completed services have no other payment recorded yet.</p><ul className="payments-bookings">{completedAwaiting.map(booking => <li key={booking.id}><Link to={bookingHistoryPath(booking.id)}><span><strong>{booking.serviceTitle}</strong><small>{booking.providerName}{booking.quoteRequest?.depositConfirmedAt ? ' · deposit confirmed' : ''}</small></span><ArrowUpRight size={16} /></Link></li>)}</ul></> : <p className="payments-empty">No completed services awaiting a payment record.</p>}</section></div></div>
      {voided.length > 0 && <details className="payments-voided"><summary>Voided records <span>{voided.length}</span></summary><p>These records are excluded from the totals.</p><ul>{voided.map(({ booking, payment }) => <li key={payment.id}><span>{booking.serviceTitle} · {paymentMethods[payment.method]}<small>Voided {formatInboxTime(payment.voidedAt!)}</small></span><strong>{formatRand(payment.amountCents)}</strong></li>)}</ul></details>}
    </>}
  </section>;
}
