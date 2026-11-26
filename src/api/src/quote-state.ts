import { ConflictException } from '@nestjs/common';

export type QuoteStatus = 'Requested' | 'Offered' | 'DepositPending' | 'Accepted' | 'Declined' | 'SlotUnavailable';

export function requireQuoteOffer(status: QuoteStatus) {
  if (status !== 'Requested') throw new ConflictException('This request can no longer receive a quotation');
}

export function requireQuoteResponse(status: QuoteStatus, expiresAt: Date, now = new Date()) {
  if (status !== 'Offered') throw new ConflictException('This quotation has already been answered');
  if (expiresAt.getTime() <= now.getTime()) throw new ConflictException('This quotation has expired');
}

/** Deposit-pending quotes do not create bookings or reserve an appointment. */
export function quoteAfterAcceptance(depositCents: number, appointmentClaimed: boolean): QuoteStatus {
  if (appointmentClaimed) throw new ConflictException('This appointment is no longer available');
  return depositCents > 0 ? 'DepositPending' : 'Accepted';
}

export function quoteAfterDepositConfirmation(status: QuoteStatus, appointmentClaimed: boolean): QuoteStatus {
  if (status !== 'DepositPending') throw new ConflictException('This quotation is not awaiting a deposit');
  if (appointmentClaimed) throw new ConflictException('This appointment is no longer available');
  return 'Accepted';
}
