import type { AccountRole, Booking, BookingStatus } from '../types';
import { formatSlot } from '../utils/bookings';
import PresenceStatus from './PresenceStatus';

const statusStyles: Record<BookingStatus, string> = {
  Pending: 'bg-yellow-500/15 text-yellow-200',
  Confirmed: 'bg-green-500/15 text-green-200',
  Completed: 'bg-blue-500/15 text-blue-200',
  Cancelled: 'bg-gray-600/40 text-gray-200',
  Declined: 'bg-red-500/15 text-red-200',
};

export default function BookingSummary({ booking, role }: { booking: Booking; role: AccountRole }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="break-words font-semibold text-white">{booking.serviceTitle}</h3>
        <p className="break-words text-sm text-gray-300">
          {role === 'provider' ? booking.clientName : booking.providerName}
        </p>
        <PresenceStatus userId={role === 'provider' ? booking.clientId : booking.providerId} />
        {role === 'client' && booking.providerVerificationTier && booking.providerVerificationTier !== 'Basic' && <p className="mt-1 text-xs font-semibold text-emerald-300">✓ {booking.providerVerificationTier === 'BusinessVerified' ? 'Business verified' : 'Identity verified'} provider</p>}
        {role === 'provider' && booking.clientVerificationTier === 'IdentityVerified' && <p className="mt-1 text-xs font-semibold text-emerald-300">✓ Identity verified client</p>}
        <p className="mt-1 text-sm text-gray-300">{formatSlot(booking)}</p>
      </div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[booking.status]}`}>
        {booking.status}
      </span>
    </div>
  );
}
