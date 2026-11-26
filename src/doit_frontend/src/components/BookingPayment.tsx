import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { AccountRole, Booking, PaymentMethod } from '../types';
import { bookingKey } from '../utils/bookings';
import { formatInboxTime, inboxKey } from '../utils/inbox';
import { formatRand, parseRandCents } from '../utils/money';
import { activePayment, paymentMethods, recordPayment, voidPayment } from '../utils/payments';
import { formatListingPrice } from '../utils/serviceListings';

const fieldClass = 'mt-1 block w-full rounded-lg border border-gray-600 bg-gray-900 p-2';

export default function BookingPayment({ booking, role }: { booking: Booking; role: AccountRole }) {
  const queryClient = useQueryClient();
  const payment = activePayment(booking);
  const voided = booking.payments.filter(record => record.voidedAt);
  const paidDeposit = booking.quoteRequest?.depositConfirmedAt ? booking.quoteRequest.depositCents ?? 0 : 0;
  const freeRate = booking.listingPrice?.priceCents === 0 && !booking.listingPrice.maxPriceCents;
  const [validationError, setValidationError] = useState('');
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: bookingKey }),
    queryClient.invalidateQueries({ queryKey: inboxKey }),
  ]);
  const record = useMutation({
    mutationFn: (data: { amountCents: number; method: PaymentMethod }) => recordPayment(booking.id, data),
    onSettled: refresh,
  });
  const revoke = useMutation({
    mutationFn: (id: string) => voidPayment(booking.id, id),
    onSettled: refresh,
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const amountCents = parseRandCents(String(fields.get('amount') ?? '').trim());
    if (!Number.isSafeInteger(amountCents) || amountCents < 1 || amountCents > 2_147_483_647) {
      setValidationError('Enter a positive rand amount with up to two decimal places.');
      return;
    }
    setValidationError('');
    record.mutate({ amountCents, method: fields.get('method') as PaymentMethod });
  }

  if (!booking.listingPrice && booking.status !== 'Completed') return null;
  return (
    <section aria-label="Payment" className="mt-4 space-y-2 border-t border-gray-700 pt-3 text-sm text-gray-300">
      <h4 className="font-semibold text-white">Payment</h4>
      {booking.listingPrice && <p>{booking.quoteRequestId ? 'Accepted quotation' : 'Listing rate at booking'} · {formatListingPrice(booking.listingPrice)}</p>}
      {paidDeposit > 0 && <p className="text-green-200">Deposit confirmed · {formatRand(paidDeposit)} · Remaining quoted balance {formatRand(Math.max(0, (booking.listingPrice?.priceCents ?? 0) - paidDeposit))}</p>}
      {payment && (
        <p className="font-medium text-green-200">
          Payment recorded · {formatRand(payment.amountCents)} · {paymentMethods[payment.method]}
          <span className="ml-2 font-normal text-gray-400">{formatInboxTime(payment.recordedAt)}</span>
        </p>
      )}
      {!payment && freeRate && <p>Free at the listed rate.</p>}
      {!payment && !freeRate && booking.status === 'Completed' && <p>Awaiting payment record</p>}
      {!freeRate && (booking.status === 'Pending' || booking.status === 'Confirmed') && <p>{paidDeposit ? 'The remaining balance is paid directly to the provider after the service.' : 'Any payment is made directly to the provider after the service.'}</p>}
      {role === 'provider' && booking.status === 'Completed' && !payment && (
        <details>
          <summary className="cursor-pointer font-semibold text-orange-300">Record payment</summary>
          <form className="mt-3 max-w-md space-y-3" onSubmit={submit}>
            <p>Enter the amount you received from the client.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                Amount received (R)
                <input name="amount" inputMode="decimal" required maxLength={16} className={fieldClass}
                  disabled={record.isPending} />
              </label>
              <label>
                Payment method
                <select name="method" required defaultValue="" disabled={record.isPending} className={fieldClass}>
                  <option value="" disabled>Select a method</option>
                  {Object.entries(paymentMethods).map(([method, label]) => <option key={method} value={method}>{label}</option>)}
                </select>
              </label>
            </div>
            {(validationError || record.isError) && <p role="alert" className="text-red-300">{validationError || record.error?.message}</p>}
            <button type="submit" className="btn-primary disabled:opacity-50" disabled={record.isPending}>
              {record.isPending ? 'Saving…' : 'Save payment'}
            </button>
          </form>
        </details>
      )}
      {role === 'provider' && payment && (
        <details key={payment.id}>
          <summary className="cursor-pointer text-orange-300">Correct payment record</summary>
          <p className="my-2">Void the recorded amount before entering the correction.</p>
          <button type="button" className="btn-secondary disabled:opacity-50" disabled={revoke.isPending}
            onClick={() => revoke.mutate(payment.id)}>{revoke.isPending ? 'Voiding…' : 'Void record'}</button>
          {revoke.isError && <p role="alert" className="mt-2 text-red-300">{revoke.error.message}</p>}
        </details>
      )}
      {voided.length > 0 && (
        <details>
          <summary className="cursor-pointer text-gray-300">{voided.length} voided {voided.length === 1 ? 'record' : 'records'}</summary>
          <ul className="mt-2 space-y-1">
            {voided.map(record => <li key={record.id}>{formatRand(record.amountCents)} · {paymentMethods[record.method]} · Voided {formatInboxTime(record.voidedAt!)}</li>)}
          </ul>
        </details>
      )}
    </section>
  );
}
