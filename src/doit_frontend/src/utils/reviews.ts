import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { Review, ReviewStats } from '../types';
import { apiRequest } from './apiRequest';

export const reviewsKey = ['reviews'] as const;

export function reviewsPath(listingId: string) {
  return `/services/${encodeURIComponent(listingId)}/reviews`;
}

export function listingReviews(listingId: string) {
  return infiniteQueryOptions({
    queryKey: [...reviewsKey, 'listing', listingId],
    queryFn: ({ signal, pageParam }) => apiRequest<ReviewStats & { items: (Review & { id: string })[]; nextCursor: string | null }>(
      `/reviews/services/${encodeURIComponent(listingId)}${pageParam ? `?${new URLSearchParams({ before: pageParam })}` : ''}`, { signal },
    ),
    initialPageParam: null as string | null,
    getNextPageParam: lastPage => lastPage.nextCursor,
    enabled: Boolean(listingId),
    retry: false,
  });
}

export function providerReviews(accountId: string) {
  return queryOptions({
    queryKey: [...reviewsKey, 'provider', accountId],
    queryFn: ({ signal }) => apiRequest<ReviewStats>('/reviews/mine', { signal }),
    enabled: Boolean(accountId),
    retry: false,
  });
}

export function leaveReview(bookingId: string, data: { rating: number; comment: string }) {
  return apiRequest<Review>(`/reviews/${encodeURIComponent(bookingId)}`, { method: 'POST', data });
}

export function leaveClientReview(bookingId: string, data: { rating: number; comment: string }) {
  return apiRequest<Review>(`/reviews/${encodeURIComponent(bookingId)}/client`, { method: 'POST', data });
}
