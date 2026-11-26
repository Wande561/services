import { queryOptions } from '@tanstack/react-query';
import { apiRequest } from './apiRequest';

export interface QuoteVersion {
  id: string; version: number; serviceDescription: string; labourCents: number; materialsCents: number; travelCents: number; totalCents: number;
  depositRequired: boolean; depositCents: number | null; bankName: string | null; accountNumber: string | null; paymentReference: string | null;
  durationMinutes: number; appointmentAt: string; notes: string | null; expiresAt: string; createdAt: string;
}
export interface QuoteRequest {
  id: string; createdAt: string; updatedAt: string; description: string; preferredAt: string; location: string; additionalInfo: string | null;
  status: 'Pending' | 'Quoted' | 'Accepted' | 'Declined' | 'RevisionRequested' | 'DepositPending' | 'SlotUnavailable'; changeRequest: string | null;
  clientRating?: { averageRating: number | null; reviewCount: number };
  listing: { title: string }; client: { verificationTier: import('../types').VerificationTier; user: { name: string | null } }; provider: { businessName: string | null; verificationTier: import('../types').VerificationTier };
  depositCents: number | null; bankName: string | null; accountNumber: string | null; paymentReference: string | null; depositConfirmedAt: string | null;
  photos: { id: string; mimeType: string; isListingReference: boolean }[]; versions: QuoteVersion[]; booking: { id: string } | null;
}
export interface QuoteAlert { id: string; requestId: string; message: string; createdAt: string; readAt: string | null; request: { listing: { title: string } } }
export const quoteKey = ['quotes'] as const;
export function quotes(accountId: string) { return queryOptions({ queryKey: [...quoteKey, accountId], queryFn: ({ signal }) => apiRequest<QuoteRequest[]>('/quotes', { signal }), enabled: Boolean(accountId), retry: false }); }
export function quoteAlerts(accountId: string) { return queryOptions({ queryKey: [...quoteKey, 'alerts', accountId], queryFn: ({ signal }) => apiRequest<QuoteAlert[]>('/quotes/alerts', { signal }), enabled: Boolean(accountId), retry: false, refetchInterval: 5000 }); }
export function quoteTime(value: string) { return new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short', hourCycle: 'h23' }).format(new Date(value)) + ' SAST'; }
export function sastTime(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00` : value;
  return `${normalized}+02:00`;
}
export function sastInputTime(value: string | Date) {
  const date = new Date(value);
  return new Date(date.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

/** Convert a typed 12-hour or 24-hour time into HH:MM. */
export function parsePreferredTime(value: string): string | null {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i.exec(value.trim());
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const period = match[3]?.toLowerCase();
  if (minute > 59 || (period ? hour < 1 || hour > 12 : hour > 23)) return null;
  if (period === 'am' && hour === 12) hour = 0;
  if (period === 'pm' && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function durationInHours(minutes: number) {
  const hours = minutes / 60;
  return `${new Intl.NumberFormat('en-ZA', { maximumFractionDigits: 2 }).format(hours)} ${minutes === 60 ? 'hour' : 'hours'}`;
}
