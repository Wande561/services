import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { bookingOwnership } from './booking-ownership';
import { PrismaService } from './prisma.service';

export const paymentFields = {
  id: true, method: true, amountCents: true, recordedAt: true, voidedAt: true,
} satisfies Prisma.BookingPaymentSelect;

@Injectable()
export class PaymentsService {
  constructor(private readonly db: PrismaService) {}

  async record(providerId: string, bookingId: string, input?: Record<string, unknown>) {
    const method = input?.method;
    if (method !== PaymentMethod.Cash && method !== PaymentMethod.BankTransfer && method !== PaymentMethod.CardInPerson) {
      throw new BadRequestException('Choose how the client paid');
    }
    const amountCents = input?.amountCents;
    if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents < 1 || amountCents > 2_147_483_647) {
      throw new BadRequestException('Enter a positive payment amount in rand');
    }
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId, ...bookingOwnership(providerId, 'provider') },
      select: { status: true, clientId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'Completed') throw new ConflictException('Complete the booking before recording payment');

    try {
      return await this.db.$transaction(async tx => {
        const payment = await tx.bookingPayment.create({ data: { bookingId, amountCents, method }, select: paymentFields });
        await tx.notification.create({ data: { bookingId, recipientId: booking.clientId, kind: 'PaymentRecorded' } });
        return payment;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const recorded = await this.db.bookingPayment.findFirst({ where: { bookingId, voidedAt: null }, select: paymentFields });
        if (recorded && recorded.amountCents === amountCents && recorded.method === method) return recorded;
        throw new ConflictException('This booking already has a recorded payment');
      }
      throw error;
    }
  }

  async void(providerId: string, bookingId: string, paymentId: string) {
    return this.db.$transaction(async tx => {
      const payment = await tx.bookingPayment.findUnique({
        where: { id: paymentId, bookingId, booking: bookingOwnership(providerId, 'provider') },
        select: { id: true, booking: { select: { clientId: true } } },
      });
      if (!payment) throw new NotFoundException('Payment record not found');
      const changed = await tx.bookingPayment.updateMany({
        where: { id: payment.id, voidedAt: null }, data: { voidedAt: new Date() },
      });
      if (changed.count > 0) {
        await tx.notification.create({ data: { bookingId, recipientId: payment.booking.clientId, kind: 'PaymentVoided' } });
      }
      return { id: payment.id };
    });
  }
}
