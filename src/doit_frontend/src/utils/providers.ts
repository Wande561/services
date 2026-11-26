import { queryOptions } from '@tanstack/react-query';
import { apiRequest } from './apiRequest';
import type { ServiceCategoryEnum, ServiceListing, VerificationTier } from '../types';

export type WorkingDay = { day: number; closed: boolean; open: string | null; close: string | null };
export const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const defaultHours = (): WorkingDay[] => days.map((_, day) => ({ day, closed: true, open: null, close: null }));
export type ProviderProfile = { id: string; name: string; location: string; serviceCategories: ServiceCategoryEnum[]; verificationTier: VerificationTier; workingHours: WorkingDay[] | null; listings: ServiceListing[]; averageRating: number | null; reviewCount: number };
export type ProviderInsights = { location: string; todayAppointments: number; todayRequests: number; weeklyRequests: number; weeklyBookings: number; weeklyCompleted: number; localCategories: { category: ServiceCategoryEnum; count: number; newThisWeek: number }[] };
export function providerProfile(id: string) { return queryOptions({ queryKey: ['providers', id], queryFn: ({ signal }) => apiRequest<ProviderProfile>(`/providers/${encodeURIComponent(id)}`, { signal }), enabled: !!id, retry: false }); }
export function myHours(id: string) { return queryOptions({ queryKey: ['providers', id, 'hours'], queryFn: ({ signal }) => apiRequest<{ workingHours: WorkingDay[] | null }>('/providers/me/hours', { signal }), enabled: !!id, retry: false }); }
export function providerInsights(id: string) { return queryOptions({ queryKey: ['providers', id, 'insights'], queryFn: ({ signal }) => apiRequest<ProviderInsights>('/providers/me/insights', { signal }), enabled: !!id, retry: false, refetchInterval: 30000 }); }
