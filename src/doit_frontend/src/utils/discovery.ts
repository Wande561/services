import { queryOptions } from '@tanstack/react-query';
import { apiRequest } from './apiRequest';
import type { ServiceListing, VerificationTier } from '../types';
export type Discovery = { location: string; favorites: ServiceListing[]; favoriteProviders: { id: string; name: string; location: string; verificationTier: VerificationTier }[]; recent: ServiceListing[]; recommended: ServiceListing[]; popular: ServiceListing[] };
export const discoveryKey = ['client-discovery'] as const;
export function clientDiscovery(id: string, enabled: boolean) { return queryOptions({ queryKey: [...discoveryKey, id], queryFn: ({ signal }) => apiRequest<Discovery>('/client/discovery', { signal }), enabled: Boolean(id && enabled), retry: false }); }
