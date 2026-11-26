import type { Booking } from '../types';

/** Sum agreed quote totals for completed work; these amounts are not payment records. */
export function completedServiceValueCents(bookings: Booking[]) {
  return bookings.reduce((total, booking) => total + (booking.status === 'Completed' && booking.quoteRequestId && booking.listingPrice ? booking.listingPrice.priceCents : 0), 0);
}
