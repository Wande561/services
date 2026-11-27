import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarDays, MessageSquare, Receipt, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AppContext';
import type { AppNotification } from '../types';
import { accountHome } from '../utils/accountRoutes';
import { apiRequest } from '../utils/apiRequest';
import { myReliability, reliabilityKey } from '../utils/reliability';
import { quoteAlerts, quoteKey } from '../utils/quotes';
import { bookingHistoryPath, formatInboxTime, inboxKey, inboxUnread, messagePath, quoteMessagePath, notifications, readNotifications } from '../utils/inbox';

function notificationLabel(notification: AppNotification) {
  switch (notification.kind) {
    case 'BookingRequested': return { title: 'New booking request', icon: CalendarDays };
    case 'BookingStatusChanged':
      return { title: notification.bookingStatus ? `Booking ${notification.bookingStatus.toLowerCase()}` : 'Booking updated', icon: CalendarDays };
    case 'MessageReceived': return { title: 'New message', icon: MessageSquare };
    case 'ServiceCompletionConfirmation': return { title: 'The other party confirmed service completion', icon: CalendarDays };
    case 'AppointmentReminder': return { title: 'Appointment coming up in the next 24 hours', icon: CalendarDays };
    case 'ReviewReceived': return { title: 'New review', icon: Star };
    case 'PaymentRecorded': return { title: 'Payment recorded', icon: Receipt };
    case 'PaymentVoided': return { title: 'Payment record voided', icon: Receipt };
  }
}

export default function Notifications() {
  const { currentUser } = useAuth();
  const accountId = currentUser?.id ?? '';
  const alerts = useInfiniteQuery(notifications(accountId));
  const unread = useQuery(inboxUnread(accountId));
  const quoteNotices = useQuery(quoteAlerts(accountId));
  const reliability = useQuery(myReliability(accountId));
  const queryClient = useQueryClient();
  const read = useMutation({
    mutationFn: readNotifications,
    onSettled: () => queryClient.invalidateQueries({ queryKey: [...inboxKey, accountId] }),
  });
  const reliabilityReadAll = useMutation({ mutationFn: () => apiRequest('/reliability/alerts/read-all', { method: 'PATCH' }), onSettled: () => queryClient.invalidateQueries({ queryKey: reliabilityKey }) });
  const quoteReadAll = useMutation({ mutationFn: () => apiRequest('/quotes/alerts/read-all', { method: 'PATCH' }), onSettled: () => queryClient.invalidateQueries({ queryKey: quoteKey }) });
  const quoteRead = useMutation({ mutationFn: (id: string) => apiRequest(`/quotes/alerts/${id}/read`, { method: 'PATCH' }), onSettled: () => queryClient.invalidateQueries({ queryKey: quoteKey }) });
  const items = alerts.data?.pages.flatMap(page => page.items) ?? [];

  return (
    <main className="polished-page notifications-page min-h-screen bg-gray-900 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-4xl">
        <header className="workspace-page-header mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link to={accountHome(currentUser?.profile?.role)} className="text-sm text-orange-300 hover:underline">← Dashboard</Link>
            <p className="workspace-eyebrow">YOUR WORKSPACE / UPDATES</p><h1 className="mt-2 text-3xl font-bold">Notifications</h1><p className="mt-2 text-sm text-emerald-300">Your latest activity, all in one place.</p>
          </div>
          <button type="button" className="btn-secondary disabled:opacity-50"
            disabled={read.isPending || quoteReadAll.isPending || reliabilityReadAll.isPending || !(unread.data?.notifications || items.some(alert => !alert.read) || quoteNotices.data?.some(alert => !alert.readAt) || reliability.data?.alerts.some(alert => !alert.readAt))}
            onClick={() => { read.mutate(undefined); quoteReadAll.mutate(); reliabilityReadAll.mutate(); }}>Mark all as read</button>
        </header>
        {alerts.isPending && <p role="status" className="text-gray-300">Loading notifications…</p>}
        {alerts.isError && <p role="alert" className="text-red-300">
          {alerts.error.message} <button type="button" className="underline" onClick={() => alerts.refetch()}>Try again</button>
        </p>}
        {read.isError && <p role="alert" className="mb-3 text-red-300">{read.error.message}</p>}
        {quoteReadAll.isError && <p role="alert" className="mb-3 text-red-300">{quoteReadAll.error.message}</p>}
        {reliabilityReadAll.isError && <p role="alert" className="mb-3 text-red-300">{reliabilityReadAll.error.message}</p>}
        {alerts.isSuccess && quoteNotices.isSuccess && reliability.isSuccess && items.length === 0 && quoteNotices.data.length === 0 && reliability.data.alerts.length === 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800 p-5 text-gray-300">
            <Bell aria-hidden="true" className="h-5 w-5" /> No notifications yet.
          </div>
        )}
        {quoteNotices.isError && <p role="alert" className="mb-3 text-red-300">Could not load quote notifications. <button type="button" className="underline" onClick={() => quoteNotices.refetch()}>Try again</button></p>}
        {reliability.isError && <p role="alert" className="mb-3 text-red-300">Could not load reliability updates.</p>}
        <ul className="space-y-3">
          {reliability.data?.alerts.map(alert => <li key={alert.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4"><Link to="/reliability" className="flex items-start gap-3"><Bell aria-hidden="true" className="mt-1 h-5 w-5 text-emerald-300" /><span><span className="block font-medium">{alert.message}{!alert.readAt && <span className="ml-2 text-xs text-emerald-300">Unread</span>}</span><span className="block text-xs text-gray-400">{formatInboxTime(alert.createdAt)}</span></span></Link></li>)}
          {quoteNotices.data?.map(alert => <li key={alert.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
            <Link to={`/quotes?${new URLSearchParams({ request: alert.requestId })}`} onClick={() => { if (!alert.readAt) quoteRead.mutate(alert.id); }} className="flex items-start gap-3">
              <Bell aria-hidden="true" className="mt-1 h-5 w-5 text-emerald-300" /><span><span className="block font-medium">{alert.message}{!alert.readAt && <span className="ml-2 text-xs text-emerald-300">Unread</span>}</span><span className="block text-sm text-gray-300">{alert.request.listing.title}</span><span className="block text-xs text-gray-400">{formatInboxTime(alert.createdAt)}</span></span>
            </Link>
            {!alert.readAt && <button type="button" className="text-sm text-emerald-300 underline" onClick={() => quoteRead.mutate(alert.id)}>Mark as read</button>}
          </li>)}
          {items.map(notification => {
            const { title, icon: Icon } = notificationLabel(notification);
            const destination = notification.quoteRequestId ? quoteMessagePath(notification.quoteRequestId) : notification.kind === 'MessageReceived' ? messagePath(notification.bookingId!) : bookingHistoryPath(notification.bookingId!);
            return (
              <li key={notification.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4">
                <Link to={destination} className="flex min-w-0 items-start gap-3 hover:text-orange-300"
                  onClick={() => { if (!notification.read) read.mutate(notification.id); }}>
                  <Icon aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-orange-300" />
                  <div className="min-w-0">
                    <p className="font-medium">{title}{!notification.read && <span className="ml-2 text-xs text-orange-200">Unread</span>}</p>
                    <p className="break-words text-sm text-gray-300">{notification.serviceTitle}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatInboxTime(notification.createdAt)}</p>
                  </div>
                </Link>
                {!notification.read && <button type="button" disabled={read.isPending} className="text-sm text-orange-300 hover:underline"
                  onClick={() => read.mutate(notification.id)}>Mark as read</button>}
              </li>
            );
          })}
        </ul>
        {alerts.hasNextPage && <button type="button" disabled={alerts.isFetching} className="btn-secondary mt-5"
          onClick={() => alerts.fetchNextPage()}>Load older notifications</button>}
      </div>
    </main>
  );
}
