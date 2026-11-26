import { queryOptions } from '@tanstack/react-query';
import type { AvailabilitySlot, Booking, BookingStatus, ServiceListing } from '../types';
import { apiRequest } from './apiRequest';

export const bookingKey = ['bookings'] as const;

export function accountBookings(accountId: string) {
  return queryOptions({
    queryKey: [...bookingKey, 'account', accountId],
    queryFn: ({ signal }) => apiRequest<Booking[]>('/bookings', { signal }),
    enabled: Boolean(accountId),
    retry: false,
  });
}

export function providerAvailability(accountId: string) {
  return queryOptions({
    queryKey: [...bookingKey, 'availability', accountId],
    queryFn: ({ signal }) => apiRequest<(AvailabilitySlot & { reserved: boolean })[]>('/bookings/availability', { signal }),
    enabled: Boolean(accountId),
    retry: false,
  });
}

export function availableSlots(listingId: string) {
  return queryOptions({
    queryKey: [...bookingKey, 'slots', listingId],
    queryFn: ({ signal }) => apiRequest<AvailabilitySlot[]>(`/bookings/slots?${new URLSearchParams({ service: listingId })}`, { signal }),
    enabled: Boolean(listingId),
    retry: false,
  });
}

export function bookingListing(listingId: string) {
  return queryOptions({
    queryKey: ['services', 'listing', listingId],
    queryFn: ({ signal }) => apiRequest<ServiceListing>(`/services/${encodeURIComponent(listingId)}`, { signal }),
    enabled: Boolean(listingId),
    retry: false,
  });
}

export function addAvailability(data: { date: string; startTime: string; endTime: string }) {
  return apiRequest<AvailabilitySlot>('/bookings/availability', { method: 'POST', data });
}

export function closeAvailability(id: string) {
  return apiRequest<{ id: string }>(`/bookings/availability/${encodeURIComponent(id)}/close`, { method: 'PATCH' });
}

export function requestBooking(data: { listingId: string; slotId: string; address: string; notes: string }) {
  return apiRequest<Booking>('/bookings', { method: 'POST', data });
}

export function confirmCompletion(id: string) {
  return apiRequest<Booking>(`/bookings/${encodeURIComponent(id)}/confirm-completion`, { method: 'POST' });
}

export function updateBookingStatus(id: string, status: BookingStatus, details?: { emergency: boolean; reason: string }) {
  return apiRequest<Booking>(`/bookings/${encodeURIComponent(id)}/status`, { method: 'PATCH', data: { status } });
}

const dateTime = new Intl.DateTimeFormat('en-ZA', {
  timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23',
});
const time = new Intl.DateTimeFormat('en-ZA', {
  timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function formatSlot({ startsAt, endsAt }: Pick<AvailabilitySlot, 'startsAt' | 'endsAt'>) {
  return `${dateTime.format(new Date(startsAt))} – ${time.format(new Date(endsAt))} SAST`;
}
