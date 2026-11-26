import { queryOptions } from '@tanstack/react-query';
import type { PriceUnit, ServiceListing, ServiceListingInput } from '../types';
import { apiRequest } from './apiRequest';
import { formatRand } from './money';

export const catalogKey = ['services', 'catalog'] as const;

export function catalogListings(params = new URLSearchParams()) {
  const search = params.toString();
  return queryOptions({
    queryKey: [...catalogKey, search],
    queryFn: ({ signal }) => apiRequest<{ listings: ServiceListing[]; total: number; pageSize: number }>(
      search ? `/services?${search}` : '/services', { signal },
    ),
    retry: false,
  });
}

export function providerListings(accountId: string) {
  return queryOptions({
    queryKey: ['services', 'mine', accountId],
    queryFn: ({ signal }) => apiRequest<ServiceListing[]>('/services/mine', { signal }),
    enabled: Boolean(accountId),
    retry: false,
  });
}

export function saveListing(input: ServiceListingInput, id?: string) {
  return apiRequest<ServiceListing>(id ? `/services/${encodeURIComponent(id)}` : '/services', {
    method: id ? 'PUT' : 'POST',
    data: input,
  });
}

export function setListingPublication(id: string, isPublished: boolean) {
  return apiRequest<ServiceListing>(`/services/${encodeURIComponent(id)}/publication`, {
    method: 'PATCH',
    data: { isPublished },
  });
}

export const priceUnits: Record<PriceUnit, string> = {
  PerHour: 'per hour',
  PerSession: 'per session',
  PerProject: 'per project',
  PerSquareMeter: 'per square metre',
};

export function formatListingPrice({ priceCents, maxPriceCents, priceUnit }: Pick<ServiceListingInput, 'priceCents' | 'maxPriceCents' | 'priceUnit'>) {
  const startingPrice = formatRand(priceCents);
  const amount = maxPriceCents !== null && maxPriceCents > priceCents
    ? `${startingPrice} – ${formatRand(maxPriceCents)}`
    : startingPrice;
  return `${amount} ${priceUnits[priceUnit]}`;
}
