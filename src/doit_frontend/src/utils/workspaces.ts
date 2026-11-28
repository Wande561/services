import { queryOptions } from '@tanstack/react-query';
import type { WorkspaceBooking, WorkspaceMember, WorkspaceMembership, WorkspaceSummary } from '../types';
import { apiRequest } from './apiRequest';

export const workspaceKey = ['workspaces'] as const;

export function myWorkspaces() {
  return queryOptions({
    queryKey: workspaceKey,
    queryFn: ({ signal }) => apiRequest<WorkspaceMembership[]>('/workspaces', { signal }),
    retry: false,
  });
}

export function workspaceSummary(id: string) {
  return queryOptions({
    queryKey: [...workspaceKey, id, 'summary'],
    queryFn: ({ signal }) => apiRequest<WorkspaceSummary>(`/workspaces/${encodeURIComponent(id)}`, { signal }),
    enabled: Boolean(id),
    retry: false,
  });
}

export function workspaceMembers(id: string) {
  return queryOptions({
    queryKey: [...workspaceKey, id, 'members'],
    queryFn: ({ signal }) => apiRequest<WorkspaceMember[]>(`/workspaces/${encodeURIComponent(id)}/members`, { signal }),
    enabled: Boolean(id),
    retry: false,
  });
}

export function workspaceBookings(id: string, filters: Record<string, string> = {}) {
  const search = new URLSearchParams(filters).toString();
  return queryOptions({
    queryKey: [...workspaceKey, id, 'bookings', search],
    queryFn: ({ signal }) => apiRequest<WorkspaceBooking[]>(`/workspaces/${encodeURIComponent(id)}/bookings${search ? `?${search}` : ''}`, { signal }),
    enabled: Boolean(id),
    retry: false,
  });
}

export function createWorkspace(input: { name: string; description?: string; location?: string; attachExisting?: boolean }) {
  return apiRequest<WorkspaceSummary>('/workspaces', { method: 'POST', data: input });
}

export function updateWorkspace(id: string, input: { name?: string; description?: string; location?: string }) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}`, { method: 'PATCH', data: input });
}

export function inviteWorkspaceMember(id: string, input: { email: string; name?: string; role: string; permissions?: Record<string, boolean> }) {
  return apiRequest<{ member: WorkspaceMember; inviteUrl: string; emailSent: boolean }>(`/workspaces/${encodeURIComponent(id)}/invitations`, { method: 'POST', data: input });
}

export function updateWorkspaceMember(id: string, memberId: string, input: Record<string, unknown>) {
  return apiRequest<WorkspaceMember>(`/workspaces/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`, { method: 'PATCH', data: input });
}

export function deactivateWorkspaceMember(id: string, memberId: string) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}/members/${encodeURIComponent(memberId)}`, { method: 'DELETE' });
}

export function assignWorkspaceBooking(id: string, bookingId: string, memberIds: string[]) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}/bookings/${encodeURIComponent(bookingId)}/assign`, { method: 'POST', data: { memberIds } });
}

export function acceptWorkspaceInvitation(token: string) {
  return apiRequest<{ workspaceId: string; workspaceName: string }>('/workspaces/invitations/accept', { method: 'POST', data: { token } });
}
