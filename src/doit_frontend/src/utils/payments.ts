import type { Booking, BookingPayment, PaymentMethod } from '../types';
import { apiRequest } from './apiRequest';

export const paymentMethods: Record<PaymentMethod, string> = {
  Cash: 'Cash',
  BankTransfer: 'Bank transfer',
  CardInPerson: 'Card in person',
};

export function recordPayment(bookingId: string, data: { amountCents: number; method: PaymentMethod }) {
  return apiRequest<BookingPayment>(`/bookings/${encodeURIComponent(bookingId)}/payment`, { method: 'POST', data });
}

export function voidPayment(bookingId: string, paymentId: string) {
  return apiRequest<{ id: string }>(`/bookings/${encodeURIComponent(bookingId)}/payment/${encodeURIComponent(paymentId)}/void`, { method: 'PATCH' });
}

export function activePayment(booking: Booking) {
  return booking.payments.find(payment => !payment.voidedAt);
}

export function totalRecordedCents(bookings: Booking[]) {
  return bookings.reduce((total, booking) => total + (activePayment(booking)?.amountCents ?? 0) + (booking.quoteRequest?.depositConfirmedAt ? booking.quoteRequest.depositCents ?? 0 : 0), 0);
}

