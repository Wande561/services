import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ServiceListingCard from '../components/ServiceListingCard';
import { availableSlots, bookingKey, bookingListing, formatSlot, requestBooking } from '../utils/bookings';

const fieldClass = 'mt-1 w-full rounded-lg border border-gray-600 bg-gray-900 p-3 text-white';

function BookingForm({ listingId }: { listingId: string }) {
  const listing = useQuery(bookingListing(listingId));
  const slots = useQuery(availableSlots(listingId));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [slotId, setSlotId] = useState('');
  const book = useMutation({
    mutationFn: requestBooking,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bookingKey });
      navigate('/bookings', { replace: true, state: { bookingRequested: true } });
    },
    onError: () => { void slots.refetch(); },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!slots.data?.some(slot => slot.id === slotId)) return;
    const form = new FormData(event.currentTarget);
    book.mutate({
      listingId,
      slotId,
      address: String(form.get('address') ?? ''),
      notes: String(form.get('notes') ?? ''),
    });
  }

  if (listing.isPending) return <p role="status" className="text-gray-300">Loading service…</p>;
  if (listing.isError) return <p role="alert" className="text-red-300">{listing.error.message}</p>;

  return (
    <div className="grid items-start gap-6 md:grid-cols-[1fr_1.5fr]">
      <ServiceListingCard listing={listing.data} />
      <form onSubmit={submit} className="rounded-xl border border-gray-700 bg-gray-800 p-5 sm:p-6">
        <fieldset disabled={book.isPending} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">
              Available time (SAST)
              <select name="slot" className={fieldClass} required
                disabled={slots.isPending || slots.isError || !slots.data?.length}
                value={slots.data?.some(slot => slot.id === slotId) ? slotId : ''}
                onChange={event => setSlotId(event.target.value)}>
                <option value="">Choose a time</option>
                {slots.data?.map(slot => <option key={slot.id} value={slot.id}>{formatSlot(slot)}</option>)}
              </select>
            </label>
            {slots.isPending && <p role="status" className="mt-2 text-sm text-gray-300">Loading available times…</p>}
            {slots.isError && (
              <p role="alert" className="mt-2 text-sm text-red-300">
                {slots.error.message} <button type="button" className="underline" onClick={() => slots.refetch()}>Try again</button>
              </p>
            )}
            {slots.data?.length === 0 && <div role="status" className="mt-3 rounded-lg border border-home-control bg-home-canvas p-4 text-sm text-emerald-300">
              <p>There are no available times for this service yet. The provider needs to add availability before you can request a booking.</p>
              <button type="button" onClick={() => slots.refetch()} className="mt-2 font-semibold underline underline-offset-4">Check again</button>
            </div>}
          </div>
          <label className="block text-sm font-medium">
            Service address
            <input name="address" className={fieldClass} required maxLength={300} autoComplete="street-address" />
          </label>
          <label className="block text-sm font-medium">
            Notes (optional)
            <textarea name="notes" className={fieldClass} maxLength={1000} rows={3} />
          </label>
          <p className="text-sm text-gray-300">The provider must accept your request to confirm the booking.</p>
          <p className="text-sm text-gray-300">Any payment is made directly to the provider after the service.</p>
          {book.isError && <p role="alert" className="text-sm text-red-300">{book.error.message}</p>}
          <button type="submit" className="btn-primary disabled:opacity-50"
            disabled={book.isPending || !slots.data?.some(slot => slot.id === slotId)}>
            {book.isPending ? 'Sending…' : 'Send booking request'}
          </button>
        </fieldset>
      </form>
    </div>
  );
}

export default function BookNow() {
  const [params] = useSearchParams();
  const listingId = params.get('service');

  return (
    <main className="min-h-screen bg-gray-900 px-4 py-12 text-white sm:px-6">
      <div className="mx-auto max-w-5xl">
        <Link to="/services" className="text-sm text-orange-300 hover:underline">← Browse services</Link>
        <h1 className="mb-6 mt-2 text-3xl font-bold">Request a booking</h1>
        {listingId ? <BookingForm key={listingId} listingId={listingId} /> : (
          <p className="text-gray-300">Choose a listing from the <Link className="text-orange-300 underline" to="/services">service catalog</Link> to see available times.</p>
        )}
      </div>
    </main>
  );
}
