import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { apiRequest } from '../utils/apiRequest';
import { inboxKey } from '../utils/inbox';

interface Preferences { bookingUpdates: boolean; messages: boolean; reviews: boolean; payments: boolean; appointmentReminders: boolean; quoteReminders: boolean; emailReminders: boolean }
const options: { key: keyof Preferences; title: string; detail: string }[] = [
  { key: 'bookingUpdates', title: 'Bookings', detail: 'Requests, changes and completion' },
  { key: 'messages', title: 'Messages', detail: 'New messages from clients and providers' },
  { key: 'reviews', title: 'Reviews', detail: 'New reviews on your account' },
  { key: 'payments', title: 'Payment records', detail: 'Deposits and recorded payments' },
  { key: 'appointmentReminders', title: 'Appointment reminders', detail: 'Up to 24 hours before an appointment' },
  { key: 'quoteReminders', title: 'Quote reminders', detail: 'Up to 24 hours before expiry' },
  { key: 'emailReminders', title: 'Email reminders', detail: 'Send appointment and quote reminders to your account email' },
];
export default function NotificationPreferences({ accountId }: { accountId: string }) {
  const cache = useQueryClient();
  const preferences = useQuery({ queryKey: ['notifications', 'preferences', accountId], queryFn: ({ signal }) => apiRequest<Preferences>('/notifications/preferences', { signal }), enabled: !!accountId });
  const update = useMutation({ mutationFn: ({ key, value }: { key: keyof Preferences; value: boolean }) => apiRequest<Preferences>('/notifications/preferences', { method: 'PATCH', data: { [key]: value } }), onSuccess: data => { cache.setQueryData(['notifications', 'preferences', accountId], data); cache.invalidateQueries({ queryKey: inboxKey }); } });
  return <section id="notification-settings" className="account-card"><div className="account-card__head"><div><span className="account-section-label">YOUR PREFERENCES</span><h2>Notifications</h2><p>Choose the updates you want to see or receive.</p></div><span className="account-card__icon"><Bell aria-hidden="true" /></span></div>
    <p className="preferences-note">Quote activity and account safety updates always appear.</p>
    {preferences.isPending && <p className="preferences-note">Loading preferences…</p>}
    {preferences.isError && <p role="alert" className="account-error">{preferences.error.message}</p>}
    {preferences.data && <div className="preferences-list">{options.map(({ key, title, detail }) => <label key={key} className="preferences-row"><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" role="switch" checked={preferences.data[key]} disabled={update.isPending} onChange={event => update.mutate({ key, value: event.currentTarget.checked })} /></label>)}</div>}
    {update.isError && <p role="alert" className="account-error">{update.error.message}</p>}
  </section>;
}
