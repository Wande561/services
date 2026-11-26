import { queryOptions } from '@tanstack/react-query';
import { apiRequest } from './apiRequest';
import type { VerificationTier } from '../types';
export interface VerificationSubmission {
  id: string; kind: 'Individual' | 'Business'; status: 'Pending' | 'Approved' | 'Rejected';
  legalName: string | null; businessName: string | null; registrationNumber: string | null;
  contactPhone: string; contactEmail: string; createdAt: string; reviewedAt: string | null; reviewNote: string | null;
  documents: { id: string; kind: string }[];
  provider?: { userId: string; role: 'client' | 'provider'; businessName: string | null; user: { name: string | null } };
}
export const verificationKey = ['verification'] as const;
export function myVerification(accountId: string) { return queryOptions({ queryKey: [...verificationKey, 'mine', accountId], queryFn: ({ signal }) => apiRequest<{ tier: VerificationTier; submission: VerificationSubmission | null }>('/verification/mine', { signal }), enabled: Boolean(accountId), retry: false }); }
export function verificationQueue(accountId: string, enabled: boolean) { return queryOptions({ queryKey: [...verificationKey, 'queue', accountId], queryFn: ({ signal }) => apiRequest<VerificationSubmission[]>('/verification/admin/submissions', { signal }), enabled, retry: false }); }
export function tierLabel(tier: VerificationTier) { return tier === 'IdentityVerified' ? 'Identity verified' : tier === 'BusinessVerified' ? 'Business verified' : 'Basic account'; }
