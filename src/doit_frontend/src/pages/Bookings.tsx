import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FormEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import BookingSummary from '../components/BookingSummary';
import BookingReliability, { CancelBooking } from '../components/BookingReliability';
import BookingPayment from '../components/BookingPayment';
import { useAuth } from '../contexts/AppContext';
import type { AccountRole, Booking, BookingStatus } from '../types';
import { accountHome } from '../utils/accountRoutes';
import { accountBookings, bookingKey, confirmCompletion, updateBookingStatus } from '../utils/bookings';
import { inboxKey, messagePath } from '../utils/inbox';
import { leaveReview, leaveClientReview, reviewsKey } from '../utils/reviews';

function ReviewForm({ bookingId, role }: { bookingId: string; role: AccountRole }) {
  const queryClient = useQueryClient();
  const review = useMutation({
    mutationFn: (data: { rating: number; comment: string }) => role === 'provider' ? leaveClientReview(bookingId, data) : leaveReview(bookingId, data),
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: bookingKey }),
      queryClient.invalidateQueries({ queryKey: reviewsKey }),
      queryClient.invalidateQueries({ queryKey: ['services'] }),
    ]),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    review.mutate({ rating: Number(fields.get('rating')), comment: String(fields.get('comment') ?? '') });
  }

  return (
    <details className="mt-4 border-t border-gray-700 pt-3">
      <summary className="cursor-pointer text-sm font-semibold text-orange-300">{role === 'provider' ? 'Rate the client' : 'Rate the provider'}</summary>
      <form onSubmit={submit} className="mt-3 max-w-lg space-y-3">
        <label className="block text-sm font-medium">
          Rating
          <select name="rating" required defaultValue="" className="mt-1 block rounded-lg border border-gray-600 bg-gray-900 p-2">
            <option value="" disabled>Choose a rating</option>
            {[5, 4, 3, 2, 1].map(rating => <option key={rating} value={rating}>{rating} out of 5</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {role === 'client' ? 'Public comment (optional)' : 'Comment (optional)'}
          <textarea name="comment" maxLength={1000} rows={3}
            className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 p-2" />
        </label>
        {review.isError && <p role="alert" className="text-sm text-red-300">{review.error.message}</p>}
        <button type="submit" disabled={review.isPending} className="btn-primary disabled:opacity-50">
          {review.isPending ? 'Posting…' : 'Post review'}
        </button>
      </form>
    </details>
  );
}

function bookingActions(booking: Booking, role: AccountRole) {
  const now = Date.now();
  const future = new Date(booking.startsAt).getTime() > now;
  const actions: { status: BookingStatus; label: string }[] = [];
  if (booking.status === 'Pending') {
    if (role === 'provider') {
      if (future) actions.push({ status: 'Confirmed', label: 'Accept' });
      actions.push({ status: 'Declined', label: 'Decline' });
    } else {
      actions.push({ status: 'Cancelled', label: 'Cancel booking' });
    }
  }
  if (booking.status === 'Confirmed') {
    actions.push({ status: 'Cancelled', label: future ? 'Cancel booking' : 'Cancel due to emergency' });
  }
  return actions;
}

export default function Bookings() {
  const { currentUser } = useAuth();
  const role = currentUser?.profile?.role;
  const location = useLocation();
  const [params] = useSearchParams();
  const selectedBooking = params.get('booking');
  const queryClient = useQueryClient();
  const bookings = useQuery(accountBookings(currentUser?.id ?? ''));
  const displayedBookings = bookings.data?.filter(booking => !selectedBooking || booking.id === selectedBooking);
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) => updateBookingStatus(id, status),
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: bookingKey }),
      queryClient.invalidateQueries({ queryKey: inboxKey }),
    ]),
  });

  const completion = useMutation({
    mutationFn: (id: string) => confirmCompletion(id),
    onSettled: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: bookingKey }),
      queryClient.invalidateQueries({ queryKey: inboxKey }),
    ]),
  });

  if (!role || role === 'admin') return null;
  return (
    <main className="min-h-screen bg-gray-900 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link to={accountHome(role)} className="text-sm text-orange-300 hover:underline">← Dashboard</Link>
            <p className="workspace-eyebrow">YOUR WORKSPACE / APPOINTMENTS</p><h1 className="mt-2 text-3xl font-bold">{role === 'provider' ? 'Bookings' : 'My bookings'}</h1><p className="mt-2 text-sm text-emerald-300">All your appointments, in one place.</p>
          </div>
          {selectedBooking ? <Link to="/bookings" className="btn-secondary">All bookings</Link> : role === 'provider'
            ? <Link to="/provider-dashboard/hours" className="btn-secondary">Working hours</Link>
            : <Link to="/services" className="btn-secondary">Browse services</Link>}
        </div>

        {location.state?.bookingRequested && <p role="status" className="mb-4 text-green-300">Request sent.</p>}
        {bookings.isPending && <p role="status" className="text-gray-300">Loading bookings…</p>}
        {bookings.isError && (
          <p role="alert" className="text-red-300">
            {bookings.error.message} <button type="button" className="underline" onClick={() => bookings.refetch()}>Try again</button>
          </p>
        )}
        {displayedBookings?.length === 0 && <p className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-gray-300">
          {selectedBooking ? 'Booking not found.' : 'No bookings yet.'}
        </p>}
        <div className="space-y-4">
          {displayedBookings?.map(booking => (
            <article key={booking.id} className="booking-card rounded-xl border border-gray-700 bg-gray-800 p-5">
              <BookingSummary booking={booking} role={role} />
              <p className="mt-3 break-words text-sm text-gray-300"><span className="font-medium text-white">Service address</span> {booking.address}</p>
              {booking.notes && <p className="mt-1 whitespace-pre-line break-words text-sm text-gray-300"><span className="font-medium text-white">Notes</span> {booking.notes}</p>}
              {booking.status === 'Confirmed' && <div className="mt-4 rounded-lg border border-home-line p-3 text-sm text-emerald-300">
                <p>{(role === 'client' ? booking.clientCompletedAt : booking.providerCompletedAt) ? `You confirmed completion. Waiting for the ${role === 'client' ? 'provider' : 'client'}.` : (role === 'client' ? booking.providerCompletedAt : booking.clientCompletedAt) ? `The ${role === 'client' ? 'provider' : 'client'} confirmed completion. Please confirm when the service is done.` : 'Once the service is done, both people need to confirm completion.'}</p>
                {!(role === 'client' ? booking.clientCompletedAt : booking.providerCompletedAt) && <button type="button" className="btn-primary mt-3 disabled:opacity-50" disabled={completion.isPending} onClick={() => completion.mutate(booking.id)}>{completion.isPending && completion.variables === booking.id ? 'Confirming…' : 'Confirm service completed'}</button>}
                {completion.isError && completion.variables === booking.id && <p role="alert" className="mt-2 text-red-300">{completion.error.message}</p>}
              </div>}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={messagePath(booking.id)} className="btn-secondary">{booking.status === 'Completed' ? 'View conversation' : `Message ${role === 'provider' ? 'client' : 'provider'}`}</Link>
                {bookingActions(booking, role).map(action => action.status === 'Cancelled' || action.status === 'Declined' ? <CancelBooking key={action.status} booking={booking} role={role} status={action.status} label={action.label} /> : <button key={action.status} type="button" disabled={update.isPending} className="btn-primary disabled:opacity-50" onClick={() => update.mutate({ id: booking.id, status: action.status })}>{action.label}</button>)}
              </div>
              {update.isError && update.variables?.id === booking.id &&
                <p role="alert" className="mt-2 text-sm text-red-300">{update.error.message}</p>}
              <BookingPayment booking={booking} role={role} />
              <BookingReliability booking={booking} role={role} />
              {booking.status === 'Completed' && <>
                {(booking.review || booking.clientReview) && <details className="mt-4 border-t border-gray-700 pt-3 text-sm text-gray-300"><summary className="cursor-pointer font-semibold text-emerald-300">View reviews</summary>
                  {booking.review && <div className="mt-3"><p className="font-medium text-orange-200">Client’s review of provider · {booking.review.rating} out of 5</p>{booking.review.comment && <p className="mt-1 whitespace-pre-wrap break-words">{booking.review.comment}</p>}</div>}
                  {booking.clientReview && <div className="mt-3"><p className="font-medium text-orange-200">Provider’s review of client · {booking.clientReview.rating} out of 5</p>{booking.clientReview.comment && <p className="mt-1 whitespace-pre-wrap break-words">{booking.clientReview.comment}</p>}</div>}
                </details>}
                {(role === 'client' ? !booking.review : !booking.clientReview) && <ReviewForm bookingId={booking.id} role={role} />}
              </>}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
