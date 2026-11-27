import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './apiRequest';
import { inboxKey } from './inbox';

/** Clear updates for the items included in a successfully loaded page snapshot. */
export function useViewedUpdates(accountId: string, scope: 'quotes' | 'bookings', quoteIds: string[], bookingIds: string[], updatedAt: number) {
  const cache = useQueryClient();
  const lastSnapshot = useRef('');
  const ids = JSON.stringify({ quoteIds, bookingIds });
  useEffect(() => {
    if (!accountId || !updatedAt) return;
    const snapshot = `${accountId}:${scope}:${updatedAt}:${ids}`;
    if (lastSnapshot.current === snapshot) return;
    const viewed: { quoteIds: string[]; bookingIds: string[] } = JSON.parse(ids);
    if (!viewed.quoteIds.length && !viewed.bookingIds.length) return;
    lastSnapshot.current = snapshot;
    const count = Math.max(Math.ceil(viewed.quoteIds.length / 100), Math.ceil(viewed.bookingIds.length / 100));
    const before = new Date(updatedAt).toISOString();
    void Promise.all(Array.from({ length: count }, (_, i) => apiRequest('/notifications/read-viewed', { method: 'PATCH', data: { scope, before, quoteIds: viewed.quoteIds.slice(i * 100, (i + 1) * 100), bookingIds: viewed.bookingIds.slice(i * 100, (i + 1) * 100) } })))
      .then(() => Promise.all([cache.invalidateQueries({ queryKey: inboxKey }), cache.invalidateQueries({ queryKey: ['quotes', 'alerts', accountId] })]))
      .catch(() => { lastSnapshot.current = ''; });
  }, [accountId, cache, scope, ids, updatedAt]);
}
