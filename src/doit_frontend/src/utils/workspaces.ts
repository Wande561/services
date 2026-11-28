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

export function updateWorkspace(id: string, input: { name?: string; description?: string; publicDescription?: string; location?: string; isPublished?: boolean }) {
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

export function workspaceTasks(id: string) {
  return queryOptions({
    queryKey: [...workspaceKey, id, 'tasks'],
    queryFn: ({ signal }) => apiRequest<import('../types').WorkspaceTask[]>(`/workspaces/${encodeURIComponent(id)}/tasks`, { signal }),
    enabled: Boolean(id),
    retry: false,
  });
}

export function createWorkspaceTask(id: string, input: Record<string, unknown>) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}/tasks`, { method: 'POST', data: input });
}

export function updateWorkspaceTask(id: string, taskId: string, input: Record<string, unknown>) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', data: input });
}

export function deleteWorkspaceTask(id: string, taskId: string) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE' });
}

export function workspaceNotes(id: string, bookingId: string) {
  return queryOptions({
    queryKey: [...workspaceKey, id, 'notes', bookingId],
    queryFn: ({ signal }) => apiRequest<import('../types').WorkspaceNote[]>(`/workspaces/${encodeURIComponent(id)}/bookings/${encodeURIComponent(bookingId)}/notes`, { signal }),
    enabled: Boolean(id && bookingId),
    retry: false,
  });
}

export function addWorkspaceNote(id: string, bookingId: string, body: string) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}/bookings/${encodeURIComponent(bookingId)}/notes`, { method: 'POST', data: { body } });
}

export function workspaceAnnouncements(id: string) {
  return queryOptions({
    queryKey: [...workspaceKey, id, 'announcements'],
    queryFn: ({ signal }) => apiRequest<import('../types').WorkspaceAnnouncement[]>(`/workspaces/${encodeURIComponent(id)}/announcements`, { signal }),
    enabled: Boolean(id),
    retry: false,
  });
}

export function createWorkspaceAnnouncement(id: string, input: { title: string; body: string }) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}/announcements`, { method: 'POST', data: input });
}

export function deleteWorkspaceAnnouncement(id: string, announcementId: string) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}/announcements/${encodeURIComponent(announcementId)}`, { method: 'DELETE' });
}

export function workspaceMessages(id: string, withMemberId?: string) {
  const search = withMemberId ? `?with=${encodeURIComponent(withMemberId)}` : '';
  return queryOptions({
    queryKey: [...workspaceKey, id, 'messages', withMemberId ?? 'team'],
    queryFn: ({ signal }) => apiRequest<import('../types').WorkspaceMessage[]>(`/workspaces/${encodeURIComponent(id)}/messages${search}`, { signal }),
    enabled: Boolean(id),
    retry: false,
  });
}

export function sendWorkspaceMessage(id: string, input: { body: string; toMemberId?: string }) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}/messages`, { method: 'POST', data: input });
}

export function workspaceNotifications(id: string) {
  return queryOptions({
    queryKey: [...workspaceKey, id, 'notifications'],
    queryFn: ({ signal }) => apiRequest<{ unread: number; items: import('../types').WorkspaceNotification[] }>(`/workspaces/${encodeURIComponent(id)}/notifications`, { signal }),
    enabled: Boolean(id),
    retry: false,
    refetchInterval: 15000,
  });
}

export function readWorkspaceNotification(id: string, notificationId: string) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'PATCH' });
}

export function readAllWorkspaceNotifications(id: string) {
  return apiRequest(`/workspaces/${encodeURIComponent(id)}/notifications/read-all`, { method: 'PATCH' });
}

export function workspaceFinance(id: string) {
  return queryOptions({
    queryKey: [...workspaceKey, id, 'finance'],
    queryFn: ({ signal }) => apiRequest<import('../types').WorkspaceFinance>(`/workspaces/${encodeURIComponent(id)}/finance`, { signal }),
    enabled: Boolean(id),
    retry: false,
  });
}

export function workspaceAnalytics(id: string, days: number) {
  return queryOptions({
    queryKey: [...workspaceKey, id, 'analytics', days],
    queryFn: ({ signal }) => apiRequest<import('../types').WorkspaceAnalytics>(`/workspaces/${encodeURIComponent(id)}/analytics?days=${days}`, { signal }),
    enabled: Boolean(id),
    retry: false,
  });
}

export function publicWorkspace(id: string) {
  return queryOptions({
    queryKey: [...workspaceKey, id, 'public'],
    queryFn: ({ signal }) => apiRequest<import('../types').PublicWorkspace>(`/workspaces/${encodeURIComponent(id)}/public`, { signal }),
    enabled: Boolean(id),
    retry: false,
  });
}
