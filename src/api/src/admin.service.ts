import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ComplaintStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { requiredText } from './request-validation';

function pageNumber(value: unknown) {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) throw new BadRequestException('Choose a valid page');
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000) throw new BadRequestException('Choose a valid page');
  return page;
}
function pageResult<T>(items: T[], page: number) { return { items: items.slice(0, 50), page, hasMore: items.length > 50 }; }
@Injectable()
export class AdminService {
  constructor(private readonly db: PrismaService) {}
  async overview() {
    const [clients, providers, activeBookings, quotes, pendingVerification, openComplaints, suspended] = await this.db.$transaction([
      this.db.profile.count({ where: { role: 'client' } }), this.db.profile.count({ where: { role: 'provider' } }),
      this.db.booking.count({ where: { status: { in: ['Pending', 'Confirmed'] } } }), this.db.quoteRequest.count(),
      this.db.verificationSubmission.count({ where: { status: 'Pending' } }), this.db.complaint.count({ where: { status: { in: ['Open', 'InReview'] } } }),
      this.db.user.count({ where: { isSuspended: true } }),
    ]);
    return { clients, providers, activeBookings, quotes, pendingVerification, openComplaints, suspended, database: 'connected', generatedAt: new Date() };
  }
  async accounts(value: unknown) {
    const page = pageNumber(value);
    const items = await this.db.user.findMany({ select: { id: true, name: true, email: true, createdAt: true, isSuspended: true, isVerificationAdmin: true, profile: { select: { role: true, businessName: true, verificationTier: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 51 });
    return pageResult(items, page);
  }
  async bookings(value: unknown) {
    const page = pageNumber(value);
    const items = await this.db.booking.findMany({ select: { id: true, serviceTitle: true, status: true, createdAt: true, client: { select: { user: { select: { name: true } } } }, slot: { select: { startsAt: true, endsAt: true, provider: { select: { businessName: true } } } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 51 });
    return pageResult(items, page);
  }
  async quotes(value: unknown) {
    const page = pageNumber(value);
    const items = await this.db.quoteRequest.findMany({ select: { id: true, status: true, createdAt: true, listing: { select: { title: true } }, client: { select: { user: { select: { name: true } } } }, provider: { select: { businessName: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 51 });
    return pageResult(items, page);
  }
  async changeAccount(actorId: string, targetId: string, body: any) {
    if (typeof body?.suspended !== 'boolean') throw new BadRequestException('Choose an account status');
    const reason = requiredText(body?.reason, 'a reason', 500);
    if (actorId === targetId) throw new ForbiddenException('You cannot suspend your own account');
    return this.db.$transaction(async tx => {
      const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, isVerificationAdmin: true, isSuspended: true } });
      if (!target) throw new NotFoundException('Account not found');
      if (target.isVerificationAdmin) throw new ForbiddenException('Administrator accounts cannot be suspended here');
      if (target.isSuspended === body.suspended) return { success: true };
      await tx.user.update({ where: { id: targetId }, data: { isSuspended: body.suspended } });
      if (body.suspended) await tx.session.deleteMany({ where: { userId: targetId } });
      await tx.adminAction.create({ data: { actorId, targetId, action: body.suspended ? 'SuspendAccount' : 'RestoreAccount', reason } });
      return { success: true };
    });
  }
  async submitComplaint(reporterId: string, body: any) {
    const subject = requiredText(body?.subject, 'a subject', 120); const description = requiredText(body?.description, 'your complaint', 3000);
    return this.db.complaint.create({ data: { reporterId, subject, description }, select: { id: true, subject: true, status: true, createdAt: true } });
  }
  async myComplaints(reporterId: string) {
    return this.db.complaint.findMany({ where: { reporterId }, select: { id: true, subject: true, description: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  }
  async complaints(value: unknown) {
    const page = pageNumber(value);
    const items = await this.db.complaint.findMany({ select: { id: true, subject: true, description: true, status: true, adminNote: true, createdAt: true, reporter: { select: { name: true, email: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 50, take: 51 });
    return pageResult(items, page);
  }
  async updateComplaint(actorId: string, id: string, body: any) {
    if (body?.status !== 'Open' && body?.status !== 'InReview' && body?.status !== 'Resolved') throw new BadRequestException('Choose a valid complaint status');
    const status = body.status as ComplaintStatus; const note = body?.note ? requiredText(body.note, 'a note', 1000) : null;
    return this.db.$transaction(async tx => {
      const updated = await tx.complaint.updateMany({ where: { id }, data: { status, adminNote: note } });
      if (!updated.count) throw new NotFoundException('Complaint not found');
      await tx.adminAction.create({ data: { actorId, targetId: id, action: `Complaint${status}`, reason: note ?? 'Status updated' } });
      return { success: true };
    });
  }
}
