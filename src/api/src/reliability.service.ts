import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountRole, Prisma, ReliabilityCaseKind } from '@prisma/client';
import { bookingOwnership } from './booking-ownership';
import { cancellationBand } from './reliability-policy';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';

type Tx = Prisma.TransactionClient;
const hour = 3600000;
function pageNumber(value: unknown) { const page = value === undefined ? 1 : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN; if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new BadRequestException('Choose a valid page'); return page; }
const caseFields = { id: true, bookingId: true, subjectId: true, reporterId: true, kind: true, status: true, reason: true, dispute: true, decisionNote: true, penaltyCredits: true, depositForfeitureCents: true, occurredAt: true, appliedAt: true, createdAt: true, booking: { select: { serviceTitle: true, slot: { select: { startsAt: true } } } } } satisfies Prisma.ReliabilityCaseSelect;

async function lockUser(tx: Tx, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
  await tx.reliabilityAccount.upsert({ where: { userId: id }, create: { userId: id }, update: {} });
}
export async function assertCanStart(db: Pick<Tx, 'reliabilityAccount'>, userId: string) {
  const account = await db.reliabilityAccount.findUnique({ where: { userId } }); const now = new Date();
  if (account?.suspendedUntil && account.suspendedUntil > now) throw new ForbiddenException('Your marketplace account is temporarily suspended. You can still view your account and dispute a decision.');
  if (account?.bookingRestrictedUntil && account.bookingRestrictedUntil > now) throw new ForbiddenException('New quote requests and quotations are temporarily restricted. You can review or dispute this in Reliability.');
}
export async function assertCanBook(db: Pick<Tx, 'reliabilityAccount'>, userIds: string[]) {
  const blocked = await db.reliabilityAccount.findFirst({ where: { userId: { in: userIds }, suspendedUntil: { gt: new Date() } }, select: { userId: true } });
  if (blocked) throw new ForbiddenException('A marketplace account on this quotation is temporarily suspended. Please contact support.');
}
async function alert(tx: Tx, recipientId: string, bookingId: string, message: string) { await tx.reliabilityAlert.create({ data: { recipientId, bookingId, message } }); }
async function recalculate(tx: Tx, userId: string, bookingId: string, caseId: string, suffix: string) {
  // The caller holds the user row lock. Recompute rather than deducting repeatedly at the cap.
  const account = await tx.reliabilityAccount.findUniqueOrThrow({ where: { userId } });
  const cases = await tx.reliabilityCase.findMany({ where: { subjectId: userId, status: 'Applied' }, select: { kind: true, penaltyCredits: true, depositForfeitureCents: true, occurredAt: true, appliedAt: true } });
  const total = cases.reduce((sum, item) => sum + (item.depositForfeitureCents > 0 ? 0 : item.penaltyCredits), 0);
  const balance = -Math.min(10, total); const now = Date.now();
  const cancellations = cases.filter(item => (item.kind === 'LateCancellation' || item.kind === 'VeryLateCancellation') && item.occurredAt.getTime() >= now - 30 * 24 * hour);
  const noShows = cases.filter(item => item.kind === 'NoShow' && item.occurredAt.getTime() >= now - 90 * 24 * hour);
  const latest = (items: typeof cases) => Math.max(...items.map(item => item.appliedAt?.getTime() ?? 0));
  const restricted = cancellations.length >= 3 ? new Date(latest(cancellations) + 24 * hour) : null;
  const suspended = noShows.length >= 2 ? new Date(latest(noShows) + 7 * 24 * hour) : null;
  const newRestriction = restricted && restricted.getTime() > now ? restricted : null;
  const newSuspension = suspended && suspended.getTime() > now ? suspended : null;
  await tx.reliabilityAccount.update({ where: { userId }, data: { creditBalance: balance, bookingRestrictedUntil: newRestriction, suspendedUntil: newSuspension } });
  if (newRestriction && (!account.bookingRestrictedUntil || account.bookingRestrictedUntil.getTime() <= now)) await alert(tx, userId, bookingId, 'Three upheld late cancellations have temporarily restricted new quote requests and quotations. See Reliability & credits for details or to dispute a penalty.');
  if (newSuspension && (!account.suspendedUntil || account.suspendedUntil.getTime() <= now)) await alert(tx, userId, bookingId, 'Two upheld no-shows have temporarily suspended marketplace activity. You can still access your account and dispute a penalty.');
  if (!newRestriction && account.bookingRestrictedUntil && account.bookingRestrictedUntil.getTime() > now) await alert(tx, userId, bookingId, 'Your cancellation-related quote restriction has been lifted after review.');
  if (!newSuspension && account.suspendedUntil && account.suspendedUntil.getTime() > now) await alert(tx, userId, bookingId, 'Your no-show-related marketplace suspension has been lifted after review.');
  const delta = balance - account.creditBalance;
  if (delta) await tx.reliabilityEntry.create({ data: { userId, bookingId, caseId, kind: `${suffix}:${caseId}`, creditsDelta: delta } });
}
async function points(tx: Tx, userId: string, bookingId: string, kind: string, delta: number, caseId?: string) {
  await lockUser(tx, userId);
  const created = await tx.reliabilityEntry.createMany({ data: [{ userId, bookingId, kind, pointsDelta: delta, ...(caseId ? { caseId } : {}) }], skipDuplicates: true });
  if (created.count) await tx.reliabilityAccount.update({ where: { userId }, data: { points: { increment: delta } } });
}
export async function awardCompletion(tx: Tx, bookingId: string, clientId: string, providerId: string) {
  for (const id of [clientId, providerId].sort()) {
    await points(tx, id, bookingId, 'Completed', 1);
    await alert(tx, id, bookingId, 'Service completed: you earned 1 reliability point.');
  }
}
export async function recordCancellation(tx: Tx, data: { bookingId: string; actorId: string; otherId: string; clientId: string; startsAt: Date; depositCents: number | null; depositConfirmedAt: Date | null; emergency: boolean; reason: string; now: Date }) {
  const band = data.emergency && data.now >= data.startsAt ? 'VeryLate' : cancellationBand(data.startsAt, data.now);
  const kind: ReliabilityCaseKind = band === 'Free' ? 'FreeCancellation' : band === 'Late' ? 'LateCancellation' : 'VeryLateCancellation';
  const severity = band === 'Free' ? 0 : band === 'Late' ? 1 : 2;
  const deposit = data.actorId === data.clientId && data.depositConfirmedAt && severity ? data.depositCents ?? 0 : 0;
  await lockUser(tx, data.actorId);
  const status = band === 'Free' ? 'Exempt' : data.emergency ? 'Pending' : 'Applied';
  const record = await tx.reliabilityCase.create({ data: { bookingId: data.bookingId, subjectId: data.actorId, reporterId: data.actorId, kind, status, reason: data.reason, penaltyCredits: severity, depositForfeitureCents: deposit, occurredAt: data.now, ...(status === 'Applied' ? { appliedAt: data.now } : {}) } });
  if (status === 'Applied') await recalculate(tx, data.actorId, data.bookingId, record.id, 'Apply');
  const detail = band === 'Free' ? 'No cancellation penalty applies.' : data.emergency ? 'Your emergency claim has been sent for administrator review; no penalty has been applied while it is pending.' : deposit ? 'The confirmed deposit has been recorded as subject to forfeiture; the platform does not move money. You can dispute this decision.' : `${severity} penalty ${severity === 1 ? 'credit was' : 'credits were'} recorded, subject to the 10-credit cap. You can dispute this decision.`;
  await alert(tx, data.actorId, data.bookingId, `Booking cancelled. ${detail}`);
  const refundNote = data.actorId !== data.clientId && data.depositConfirmedAt && data.depositCents ? ' A deposit was recorded as paid to the provider; arrange any refund directly or contact support.' : '';
  await alert(tx, data.otherId, data.bookingId, `The other party cancelled your booking. View the booking and contact support if needed.${refundNote}`);
}

@Injectable()
export class ReliabilityService {
  constructor(private readonly db: PrismaService) {}
  async mine(userId: string) {
    const [account, cases, entries, alerts] = await this.db.$transaction([
      this.db.reliabilityAccount.findUnique({ where: { userId } }),
      this.db.reliabilityCase.findMany({ where: { OR: [{ subjectId: userId }, { reporterId: userId }] }, select: caseFields, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.db.reliabilityEntry.findMany({ where: { userId }, select: { id: true, kind: true, pointsDelta: true, creditsDelta: true, createdAt: true, booking: { select: { serviceTitle: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      this.db.reliabilityAlert.findMany({ where: { recipientId: userId }, select: { id: true, bookingId: true, message: true, createdAt: true, readAt: true }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ]);
    return { points: account?.points ?? 0, creditBalance: account?.creditBalance ?? 0, bookingRestrictedUntil: account?.bookingRestrictedUntil ?? null, suspendedUntil: account?.suspendedUntil ?? null, cases, entries, alerts };
  }
  async cases(userId: string, value: unknown) {
    const page = pageNumber(value); const items = await this.db.reliabilityCase.findMany({ where: { OR: [{ subjectId: userId }, { reporterId: userId }] }, select: caseFields, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 51 });
    return { items: items.slice(0, 50), page, hasMore: items.length > 50 };
  }
  async ledger(userId: string, value: unknown) {
    const page = pageNumber(value); const items = await this.db.reliabilityEntry.findMany({ where: { userId }, select: { id: true, kind: true, pointsDelta: true, creditsDelta: true, createdAt: true, booking: { select: { serviceTitle: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 51 });
    return { items: items.slice(0, 50), page, hasMore: items.length > 50 };
  }
  async unread(userId: string) { return { count: await this.db.reliabilityAlert.count({ where: { recipientId: userId, readAt: null } }) }; }
  async markAlerts(userId: string) { await this.db.reliabilityAlert.updateMany({ where: { recipientId: userId, readAt: null }, data: { readAt: new Date() } }); return { success: true }; }
  async dispute(userId: string, id: string, body: any) {
    const reason = requiredText(body?.reason, 'the reason for your dispute', 2000);
    return this.db.$transaction(async tx => {
      const changed = await tx.reliabilityCase.updateMany({ where: { id, subjectId: userId, status: 'Applied', dispute: null }, data: { dispute: reason } });
      if (!changed.count) throw new ConflictException('This penalty cannot be disputed or already has a dispute');
      const record = await tx.reliabilityCase.findUniqueOrThrow({ where: { id }, select: caseFields });
      await alert(tx, userId, record.bookingId, 'Your reliability dispute has been submitted for administrator review.'); return record;
    });
  }
  async report(userId: string, role: AccountRole, bookingId: string, body: any) {
    if (body?.kind !== 'NoShow' && body?.kind !== 'Punctuality') throw new BadRequestException('Choose a valid report');
    const reason = requiredText(body?.reason, 'what happened', 2000);
    if (body.kind === 'NoShow' && body?.noCommunication !== true) throw new BadRequestException('Confirm that you have not received communication before reporting a no-show');
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
      const booking = await tx.booking.findFirst({ where: { id: bookingId, ...bookingOwnership(userId, role) }, select: { status: true, clientId: true, slot: { select: { startsAt: true, providerId: true } } } });
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.status !== 'Confirmed' && booking.status !== 'Completed') throw new ConflictException('Reports are available for confirmed or completed bookings');
      const now = new Date();
      if (body.kind === 'NoShow' && booking.status !== 'Confirmed') throw new ConflictException('A no-show cannot be reported for a completed booking');
      if (body.kind === 'NoShow' && now.getTime() <= booking.slot.startsAt.getTime() + 30 * 60000) throw new ConflictException('A no-show can be reported more than 30 minutes after the appointment starts');
      if (body.kind === 'Punctuality' && now < booking.slot.startsAt) throw new ConflictException('Punctuality can be submitted after the appointment starts');
      const subjectId = body.kind === 'Punctuality' ? userId : role === 'client' ? booking.slot.providerId : booking.clientId;
      try {
        const record = await tx.reliabilityCase.create({ data: { bookingId, subjectId, reporterId: userId, kind: body.kind, reason, occurredAt: now }, select: caseFields });
        await alert(tx, userId, bookingId, 'Your report was submitted for administrator review. No penalty is applied automatically.');
        if (subjectId !== userId) await alert(tx, subjectId, bookingId, 'A no-show was reported for this booking. An administrator must review it before any penalty is applied.');
        return record;
      } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('This report has already been submitted'); throw error; }
    });
  }
  async notifyLate(userId: string, role: AccountRole, bookingId: string, body: any) {
    const minutes = body?.minutes;
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new BadRequestException('Enter an estimated delay between 1 and 1440 minutes');
    const note = body?.note ? requiredText(body.note, 'a message', 1000) : '';
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
      const booking = await tx.booking.findFirst({ where: { id: bookingId, ...bookingOwnership(userId, role), status: 'Confirmed' }, select: { clientId: true, slot: { select: { providerId: true } } } });
      if (!booking) throw new NotFoundException('Confirmed booking not found');
      const other = role === 'client' ? booking.slot.providerId : booking.clientId;
      const message = `I am running late. Estimated delay: ${minutes} minutes.${note ? ` ${note}` : ''}`;
      const created = await tx.message.create({ data: { bookingId, senderId: userId, body: message } });
      await tx.notification.create({ data: { bookingId, recipientId: other, kind: 'MessageReceived', messageId: created.id } });
      await tx.reliabilityCase.upsert({ where: { bookingId_subjectId_kind: { bookingId, subjectId: userId, kind: 'LateArrival' } }, create: { bookingId, subjectId: userId, reporterId: userId, kind: 'LateArrival', status: 'Exempt', reason: message, occurredAt: new Date() }, update: { reason: message } });
      await alert(tx, other, bookingId, `The other party reported an estimated ${minutes}-minute delay. You may continue or propose a new appointment.`);
      return { success: true };
    });
  }
  async reschedules(userId: string, role: AccountRole, bookingId: string) {
    const booking = await this.db.booking.findFirst({ where: { id: bookingId, ...bookingOwnership(userId, role) }, select: { id: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    return this.db.bookingReschedule.findMany({ where: { bookingId }, orderBy: { createdAt: 'desc' }, take: 20 });
  }
  async propose(userId: string, role: AccountRole, bookingId: string, body: any) {
    if (typeof body?.proposedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(body.proposedAt)) throw new BadRequestException('Choose a valid appointment time');
    const proposedAt = new Date(body.proposedAt);
    if (!Number.isFinite(proposedAt.getTime()) || proposedAt <= new Date()) throw new BadRequestException('Choose an appointment in the future');
    return this.db.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
      const booking = await tx.booking.findFirst({ where: { id: bookingId, ...bookingOwnership(userId, role), status: 'Confirmed' }, select: { clientId: true, slot: { select: { providerId: true } } } });
      if (!booking) throw new NotFoundException('Confirmed booking not found');
      if (await tx.bookingReschedule.findFirst({ where: { bookingId, status: 'Pending' }, select: { id: true } })) throw new ConflictException('A reschedule proposal is already awaiting a response');
      const item = await tx.bookingReschedule.create({ data: { bookingId, proposerId: userId, proposedAt } });
      await alert(tx, role === 'client' ? booking.slot.providerId : booking.clientId, bookingId, 'A new appointment time was proposed. Review it on the booking.'); return item;
    });
  }
  async respondReschedule(userId: string, role: AccountRole, bookingId: string, proposalId: string, action: unknown) {
    if (action !== 'accept' && action !== 'decline') throw new BadRequestException('Choose accept or decline');
    return this.db.$transaction(async tx => {
      const owner = await tx.booking.findFirst({ where: { id: bookingId, ...bookingOwnership(userId, role) }, select: { clientId: true, slot: { select: { providerId: true } } } });
      if (!owner) throw new NotFoundException('Booking not found');
      // Match booking creation's provider-then-client locking order.
      await tx.$queryRaw`SELECT "userId" FROM "Profile" WHERE "userId" = ${owner.slot.providerId} FOR UPDATE`;
      if (owner.clientId !== owner.slot.providerId) await tx.$queryRaw`SELECT "userId" FROM "Profile" WHERE "userId" = ${owner.clientId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
      const booking = await tx.booking.findFirst({ where: { id: bookingId, ...bookingOwnership(userId, role), status: 'Confirmed' }, select: { clientId: true, slot: { select: { providerId: true, startsAt: true, endsAt: true } } } });
      const proposal = await tx.bookingReschedule.findFirst({ where: { id: proposalId, bookingId, status: 'Pending', proposerId: { not: userId } } });
      if (!booking || !proposal) throw new ConflictException('This proposal is no longer available');
      if (action === 'accept') {
        const startsAt = proposal.proposedAt;
        if (startsAt <= new Date()) throw new ConflictException('The proposed appointment has passed');
        const endsAt = new Date(startsAt.getTime() + booking.slot.endsAt.getTime() - booking.slot.startsAt.getTime());
        const conflict = await tx.booking.findFirst({ where: { id: { not: bookingId }, status: { in: ['Pending', 'Confirmed'] }, slot: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt } }, OR: [{ clientId: booking.clientId }, { slot: { providerId: booking.slot.providerId } }] }, select: { id: true } });
        if (conflict) throw new ConflictException('This time overlaps an existing booking. Propose a different time.');
        const slot = await tx.availabilitySlot.create({ data: { providerId: booking.slot.providerId, startsAt, endsAt, isOpen: false } });
        await tx.booking.update({ where: { id: bookingId }, data: { slotId: slot.id, clientCompletedAt: null, providerCompletedAt: null } });
        const pendingQuotes = await tx.quoteRequest.findMany({ where: { providerId: booking.slot.providerId, status: 'DepositPending' }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } });
        for (const pending of pendingQuotes) {
          const version = pending.versions[0];
          if (!version) continue;
          const pendingEnd = new Date(version.appointmentAt.getTime() + version.durationMinutes * 60000);
          if (version.appointmentAt < endsAt && pendingEnd > startsAt) {
            const changed = await tx.quoteRequest.updateMany({ where: { id: pending.id, status: 'DepositPending' }, data: { status: 'SlotUnavailable' } });
            if (changed.count) await tx.quoteAlert.createMany({ data: [
              { recipientId: pending.clientId, requestId: pending.id, message: 'Your appointment is no longer available because another booking was confirmed first. Please contact the provider about an alternative time or any payment made.' },
              { recipientId: pending.providerId, requestId: pending.id, message: 'A pending deposit request lost its appointment to another booking. Contact the client about an alternative or any payment made.' },
            ] });
          }
        }
      }
      await tx.bookingReschedule.update({ where: { id: proposalId }, data: { status: action === 'accept' ? 'Accepted' : 'Declined' } });
      await alert(tx, proposal.proposerId, bookingId, `Your reschedule proposal was ${action === 'accept' ? 'accepted' : 'declined'}.`);
      await alert(tx, userId, bookingId, `You ${action === 'accept' ? 'accepted' : 'declined'} the reschedule proposal.`);
      return { success: true };
    });
  }
  async continueBooking(userId: string, role: AccountRole, bookingId: string) {
    const booking = await this.db.booking.findFirst({ where: { id: bookingId, ...bookingOwnership(userId, role), status: 'Confirmed' }, select: { clientId: true, slot: { select: { providerId: true } } } });
    if (!booking) throw new NotFoundException('Confirmed booking not found');
    await this.db.reliabilityAlert.create({ data: { recipientId: role === 'client' ? booking.slot.providerId : booking.clientId, bookingId, message: 'The other party chose to continue with the appointment.' } });
    return { success: true };
  }
  async queue(filter: unknown, pageValue: unknown) {
    if (filter !== undefined && filter !== 'review' && filter !== 'applied') throw new BadRequestException('Choose a valid case filter');
    const page = pageNumber(pageValue);
    const where: Prisma.ReliabilityCaseWhereInput = filter === 'applied' ? { status: 'Applied' } : { OR: [{ status: 'Pending' }, { status: 'Applied', dispute: { not: null } }] };
    const items = await this.db.reliabilityCase.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 51, select: { ...caseFields, booking: { select: { clientId: true, serviceTitle: true, quoteRequest: { select: { depositCents: true, depositConfirmedAt: true } }, slot: { select: { startsAt: true } } } }, subject: { select: { name: true, email: true } }, reporter: { select: { name: true, email: true } } } });
    return { items: items.slice(0, 50), page, hasMore: items.length > 50 };
  }
  async reviewMessages(id: string, value: unknown) {
    const page = pageNumber(value);
    const record = await this.db.reliabilityCase.findUnique({ where: { id }, select: { bookingId: true } });
    if (!record) throw new NotFoundException('Reliability case not found');
    const items = await this.db.message.findMany({ where: { bookingId: record.bookingId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 51, select: { id: true, senderId: true, body: true, createdAt: true } });
    return { items: items.slice(0, 50), page, hasMore: items.length > 50 };
  }
  async decide(adminId: string, id: string, body: any) {
    if (!['apply', 'exempt', 'uphold', 'reverse'].includes(body?.decision)) throw new BadRequestException('Choose a valid decision');
    const note = requiredText(body?.note, 'a review note', 2000);
    return this.db.$transaction(async tx => {
      const anchor = await tx.reliabilityCase.findUnique({ where: { id }, select: { bookingId: true } });
      if (!anchor) throw new NotFoundException('Reliability case not found');
      await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${anchor.bookingId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "ReliabilityCase" WHERE "id" = ${id} FOR UPDATE`;
      const record = await tx.reliabilityCase.findUnique({ where: { id }, include: { booking: { select: { status: true, clientId: true, quoteRequest: { select: { depositCents: true, depositConfirmedAt: true } } } } } });
      if (!record) throw new NotFoundException('Reliability case not found');
      if (record.subjectId === adminId || record.reporterId === adminId) throw new ForbiddenException('You cannot review your own case');
      const initial = record.status === 'Pending'; const applied = record.status === 'Applied';
      if ((!initial && !applied) || (initial && !['apply', 'exempt'].includes(body.decision)) || (applied && !(body.decision === 'reverse' || (body.decision === 'uphold' && !!record.dispute)))) throw new ConflictException('This case is not awaiting that decision');
      const latestBooking = await tx.booking.findUniqueOrThrow({ where: { id: record.bookingId }, select: { status: true, slot: { select: { startsAt: true } } } });
      await lockUser(tx, record.subjectId);
      if (initial && body.decision === 'apply') {
        if (record.kind === 'NoShow' && latestBooking.status !== 'Confirmed') throw new ConflictException('A no-show cannot be applied after the booking is completed or cancelled. Exempt the report instead.');
        if (record.kind === 'NoShow' && record.occurredAt.getTime() <= latestBooking.slot.startsAt.getTime() + 30 * 60000) throw new ConflictException('The appointment was rescheduled after the report. Exempt the report or review the new appointment separately.');
        if (record.kind === 'Punctuality' && await tx.reliabilityCase.findFirst({ where: { bookingId: record.bookingId, subjectId: record.subjectId, kind: 'NoShow', status: 'Applied' }, select: { id: true } })) throw new ConflictException('Punctuality cannot be awarded while an upheld no-show exists for this booking');
        const penalty = record.kind === 'NoShow' ? 3 : record.penaltyCredits;
        const deposit = record.kind === 'NoShow' && record.subjectId === record.booking.clientId && record.booking.quoteRequest?.depositConfirmedAt ? record.booking.quoteRequest.depositCents ?? 0 : record.depositForfeitureCents;
        await tx.reliabilityCase.update({ where: { id }, data: { status: 'Applied', reviewedById: adminId, decisionNote: note, appliedAt: new Date(), penaltyCredits: penalty, depositForfeitureCents: deposit } });
        if (record.kind === 'Punctuality') await points(tx, record.subjectId, record.bookingId, `Punctual:${id}`, 1, id);
        await recalculate(tx, record.subjectId, record.bookingId, id, 'Apply');
        if (record.kind === 'NoShow') {
          const punctuality = await tx.reliabilityCase.findFirst({ where: { bookingId: record.bookingId, subjectId: record.subjectId, kind: 'Punctuality', status: 'Applied' } });
          if (punctuality) {
            await tx.reliabilityCase.update({ where: { id: punctuality.id }, data: { status: 'Reversed', reviewedById: adminId, decisionNote: 'Punctuality reversed after the no-show was upheld.' } });
            await points(tx, record.subjectId, record.bookingId, `ReversePunctual:${punctuality.id}`, -1, punctuality.id);
            await alert(tx, record.subjectId, record.bookingId, 'A punctuality point was reversed because a no-show was upheld for the same booking.');
          }
          await tx.booking.update({ where: { id: record.bookingId }, data: { status: 'Cancelled' } });
          await tx.bookingReschedule.updateMany({ where: { bookingId: record.bookingId, status: 'Pending' }, data: { status: 'Cancelled' } });
          if (record.subjectId !== record.booking.clientId && record.booking.quoteRequest?.depositConfirmedAt && record.booking.quoteRequest.depositCents) await alert(tx, record.booking.clientId, record.bookingId, 'The provider was found to be a no-show. A deposit was recorded as paid; arrange any refund directly or contact support.');
        }
      } else if (initial) {
        await tx.reliabilityCase.update({ where: { id }, data: { status: 'Exempt', reviewedById: adminId, decisionNote: note } });
      } else if (body.decision === 'reverse') {
        await tx.reliabilityCase.update({ where: { id }, data: { status: 'Reversed', reviewedById: adminId, decisionNote: note } });
        if (record.kind === 'Punctuality') await points(tx, record.subjectId, record.bookingId, `ReversePunctual:${id}`, -1, id);
        await recalculate(tx, record.subjectId, record.bookingId, id, 'Reverse');
      } else await tx.reliabilityCase.update({ where: { id }, data: { dispute: null, reviewedById: adminId, decisionNote: note } });
      await tx.adminAction.create({ data: { actorId: adminId, targetId: id, action: `Reliability:${body.decision}`, reason: note } });
      await alert(tx, record.subjectId, record.bookingId, `Your reliability case was reviewed: ${body.decision}. ${note}`);
      if (record.reporterId !== record.subjectId) await alert(tx, record.reporterId, record.bookingId, 'An administrator reviewed your reliability report.');
      return tx.reliabilityCase.findUniqueOrThrow({ where: { id }, select: caseFields });
    });
  }
}
