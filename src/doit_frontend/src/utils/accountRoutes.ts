import type { ProfileRole } from '../types';

export function accountHome(role?: ProfileRole | null) {
  if (role === 'admin') return '/admin';
  if (role === 'provider') return '/provider-dashboard';
  if (role === 'client') return '/dashboard';
  return '/onboarding';
}

export function bookingPath(listingId: string, photoId?: string | null) {
  const params = new URLSearchParams({ service: listingId });
  if (photoId) params.set('photo', photoId);
  return `/book?${params}`;
}

export function accountDestination(role: ProfileRole | undefined, params: URLSearchParams) {
  const booking = params.get('book');
  if (role) return role === 'client' && booking ? bookingPath(booking, params.get('photo')) : accountHome(role);
  const next = new URLSearchParams();
  if (booking) { next.set('book', booking); const photo = params.get('photo'); if (photo) next.set('photo', photo); }
  const roleHint = params.get('role');
  if (roleHint === 'client' || roleHint === 'provider') next.set('role', roleHint);
  return next.size ? `/onboarding?${next}` : '/onboarding';
}
