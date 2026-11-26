import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { AppNotification, BookingMessage, Conversation, MessageThread } from '../types';
import { apiRequest } from './apiRequest';

export const inboxKey = ['inbox'] as const;
const pollInterval = 5_000;

function before(cursor: string | null) {
  return cursor ? `?${new URLSearchParams({ before: cursor })}` : '';
}

export function messagePath(bookingId: string) {
  return `/messages?${new URLSearchParams({ booking: bookingId })}`;
}

export function bookingHistoryPath(bookingId: string) {
  return `/bookings?${new URLSearchParams({ booking: bookingId })}`;
}

export function inboxUnread(accountId: string) {
  return queryOptions({
    queryKey: [...inboxKey, accountId, 'unread'],
    queryFn: ({ signal }) => apiRequest<{ messages: number; notifications: number }>('/notifications/unread', { signal }),
    enabled: Boolean(accountId),
    refetchInterval: pollInterval,
    retry: false,
  });
}

export function conversations(accountId: string) {
  return queryOptions({
    queryKey: [...inboxKey, accountId, 'conversations'],
    queryFn: ({ signal }) => apiRequest<Conversation[]>('/messages', { signal }),
    enabled: Boolean(accountId),
    refetchInterval: pollInterval,
    retry: false,
  });
}

export function messageThread(accountId: string, bookingId: string) {
  return infiniteQueryOptions({
    queryKey: [...inboxKey, accountId, 'thread', bookingId],
    queryFn: ({ signal, pageParam }) => apiRequest<MessageThread & { items: BookingMessage[]; nextCursor: string | null }>(
      `/messages/${encodeURIComponent(bookingId)}${before(pageParam)}`, { signal },
    ),
    initialPageParam: null as string | null,
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: Boolean(accountId && bookingId),
    refetchInterval: pollInterval,
    retry: false,
  });
}

export function notifications(accountId: string) {
  return infiniteQueryOptions({
    queryKey: [...inboxKey, accountId, 'notifications'],
    queryFn: ({ signal, pageParam }) => apiRequest<{ items: AppNotification[]; nextCursor: string | null }>(
      `/notifications${before(pageParam)}`, { signal },
    ),
    initialPageParam: null as string | null,
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: Boolean(accountId),
    refetchInterval: pollInterval,
    retry: false,
  });
}

export function sendMessage(bookingId: string, body: string) {
  return apiRequest<BookingMessage>(`/messages/${encodeURIComponent(bookingId)}`, { method: 'POST', data: { body } });
}

export function readMessages(bookingId: string, ids: string[]) {
  return apiRequest<{ success: boolean }>(`/messages/${encodeURIComponent(bookingId)}/read`, { method: 'PATCH', data: { ids } });
}

export function readNotifications(id?: string) {
  return apiRequest<{ success: boolean }>(
    id ? `/notifications/${encodeURIComponent(id)}/read` : '/notifications/read-all', { method: 'PATCH' },
  );
}

const dateTime = new Intl.DateTimeFormat('en-ZA', {
  timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short',
});

export function formatInboxTime(value: string) {
  return dateTime.format(new Date(value));
}
