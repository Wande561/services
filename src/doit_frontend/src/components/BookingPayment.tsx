import type { AccountRole, Booking } from '../types';
import { formatRand } from '../utils/money';
import { activePayment } from '../utils/payments';
import { formatListingPrice } from '../utils/serviceListings';

export default function BookingPayment({ booking }: { booking: Booking; role: AccountRole }) {
  const recorded = activePayment(booking);
  const deposit = booking.quoteRequest?.depositConfirmedAt ? booking.quoteRequest.depositCents ?? 0 : 0;
  if (!booking.listingPrice && !recorded) return null;
  return <section aria-label="Payment" className="booking-payment-summary">
    <div><span>{booking.status === 'Completed' && booking.quoteRequestId ? 'Completed quote' : 'Quote'}</span><strong>{booking.listingPrice ? formatListingPrice(booking.listingPrice) : formatRand(recorded!.amountCents)}</strong></div>
    {recorded ? <small>Payment recorded: {formatRand(recorded.amountCents)}</small> : deposit > 0 ? <small>Deposit confirmed: {formatRand(deposit)}</small> : null}
    {booking.status === 'Completed' && booking.quoteRequestId && !recorded && <small>Agreed service value · payment is arranged directly</small>}
  </section>;
}
