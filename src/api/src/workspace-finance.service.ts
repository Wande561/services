import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { WorkspacesService } from './workspaces.service';

function monthKey(value: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: '2-digit' }).format(value);
}

function monthLabel(value: Date) {
  return new Intl.DateTimeFormat('en-ZA', { timeZone: 'Africa/Johannesburg', month: 'short', year: 'numeric' }).format(value);
}

@Injectable()
export class WorkspaceFinanceService {
  constructor(private readonly db: PrismaService, private readonly workspaces: WorkspacesService) {}

  async finance(workspaceId: string, userId: string) {
    await this.workspaces.access(workspaceId, userId, 'finance.view');
    const bookings = await this.db.booking.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, serviceTitle: true, status: true, priceCents: true, createdAt: true, updatedAt: true,
        client: { select: { user: { select: { name: true } } } },
        payments: { select: { id: true, amountCents: true, method: true, recordedAt: true, voidedAt: true } },
        quoteRequest: { select: { depositCents: true, depositConfirmedAt: true } },
      },
    });

    const payments = bookings.flatMap(booking => booking.payments
      .filter(payment => !payment.voidedAt)
      .map(payment => ({ ...payment, booking })));
    const recordedCents = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const voided = bookings.flatMap(booking => booking.payments.filter(payment => payment.voidedAt).map(payment => ({ ...payment, booking })));
    const voidedCents = voided.reduce((sum, payment) => sum + payment.amountCents, 0);
    const depositsCents = bookings.reduce((sum, booking) => sum + (booking.quoteRequest?.depositConfirmedAt ? booking.quoteRequest.depositCents ?? 0 : 0), 0);

    const paidByBooking = new Map<string, number>();
    for (const payment of payments) paidByBooking.set(payment.booking.id, (paidByBooking.get(payment.booking.id) ?? 0) + payment.amountCents);

    const outstanding = bookings
      .filter(booking => booking.status === 'Completed' && booking.priceCents != null)
      .map(booking => ({ booking, paidCents: paidByBooking.get(booking.id) ?? 0, dueCents: Math.max(0, (booking.priceCents ?? 0) - (paidByBooking.get(booking.id) ?? 0)) }))
      .filter(item => item.dueCents > 0);

    const now = new Date();
    const monthly = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (11 - index), 1);
      return { month: monthKey(date), label: monthLabel(date), amountCents: 0, count: 0 };
    });
    const byMonth = new Map(monthly.map(item => [item.month, item]));
    for (const payment of payments) {
      const bucket = byMonth.get(monthKey(new Date(payment.recordedAt)));
      if (bucket) { bucket.amountCents += payment.amountCents; bucket.count += 1; }
    }

    return {
      summary: {
        recordedCents,
        recordedCount: payments.length,
        depositsCents,
        outstandingCents: outstanding.reduce((sum, item) => sum + item.dueCents, 0),
        outstandingCount: outstanding.length,
        voidedCents,
        voidedCount: voided.length,
      },
      monthly,
      history: payments.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime()).slice(0, 100).map(payment => ({
        id: payment.id, bookingId: payment.booking.id, serviceTitle: payment.booking.serviceTitle,
        clientName: payment.booking.client.user.name || 'Client', amountCents: payment.amountCents,
        method: payment.method, recordedAt: payment.recordedAt,
      })),
      outstanding: outstanding.map(item => ({
        bookingId: item.booking.id, serviceTitle: item.booking.serviceTitle, clientName: item.booking.client.user.name || 'Client',
        priceCents: item.booking.priceCents, paidCents: item.paidCents, dueCents: item.dueCents, completedAt: item.booking.updatedAt,
      })),
      voided: voided.sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime()).map(payment => ({
        id: payment.id, bookingId: payment.booking.id, serviceTitle: payment.booking.serviceTitle,
        clientName: payment.booking.client.user.name || 'Client', amountCents: payment.amountCents,
        method: payment.method, recordedAt: payment.recordedAt, voidedAt: payment.voidedAt,
      })),
      unrecorded: bookings.filter(booking => booking.status === 'Completed' && !paidByBooking.get(booking.id)).map(booking => ({
        bookingId: booking.id, serviceTitle: booking.serviceTitle, clientName: booking.client.user.name || 'Client',
        priceCents: booking.priceCents, completedAt: booking.updatedAt,
      })),
    };
  }

  async analytics(workspaceId: string, userId: string, daysRaw: unknown) {
    await this.workspaces.access(workspaceId, userId, 'analytics.view');
    const days = daysRaw === undefined ? 30 : Number(daysRaw);
    if (![7, 30, 90, 365].includes(days)) throw new BadRequestException('Choose a valid analytics period');
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [bookings, members] = await Promise.all([
      this.db.booking.findMany({
        where: { workspaceId, createdAt: { gte: start } },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, serviceTitle: true, status: true, priceCents: true, createdAt: true,
          listing: { select: { title: true, category: true } },
          review: { select: { rating: true } },
          payments: { select: { amountCents: true, voidedAt: true } },
          workspaceAssignments: { select: { memberId: true } },
        },
      }),
      this.db.workspaceMember.findMany({
        where: { workspaceId }, select: { id: true, name: true, email: true, role: true, status: true },
      }),
    ]);

    const paymentTotal = (booking: typeof bookings[number]) => booking.payments.filter(payment => !payment.voidedAt).reduce((sum, payment) => sum + payment.amountCents, 0);
    const completed = bookings.filter(booking => booking.status === 'Completed');
    const revenueCents = bookings.reduce((sum, booking) => sum + paymentTotal(booking), 0);
    const statusCounts = bookings.reduce<Record<string, number>>((counts, booking) => ({ ...counts, [booking.status]: (counts[booking.status] ?? 0) + 1 }), {});
    const serviceCounts = new Map<string, { title: string; category: string; count: number }>();
    for (const booking of bookings) {
      const key = booking.listing.title;
      const current = serviceCounts.get(key) ?? { title: booking.listing.title, category: booking.listing.category, count: 0 };
      current.count += 1;
      serviceCounts.set(key, current);
    }
    const popularServices = [...serviceCounts.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    const team = members.map(member => {
      const assigned = bookings.filter(booking => booking.workspaceAssignments.some(assignment => assignment.memberId === member.id));
      const completedAssigned = assigned.filter(booking => booking.status === 'Completed');
      const revenue = completedAssigned.reduce((sum, booking) => {
        const assignees = new Set(booking.workspaceAssignments.map(assignment => assignment.memberId)).size || 1;
        return sum + paymentTotal(booking) / assignees;
      }, 0);
      const ratings = assigned.map(booking => booking.review?.rating).filter((rating): rating is number => typeof rating === 'number');
      return {
        id: member.id, name: member.name || member.email, role: member.role, status: member.status,
        assignedBookings: assigned.length, completedBookings: completedAssigned.length,
        revenueCents: Math.round(revenue),
        averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
        completionRate: assigned.length ? Math.round((completedAssigned.length / assigned.length) * 100) : null,
      };
    });

    return {
      period: { days, from: start, to: new Date() },
      business: {
        totalBookings: bookings.length,
        completedBookings: completed.length,
        cancelledBookings: bookings.filter(booking => booking.status === 'Cancelled').length,
        revenueCents,
        averageBookingValueCents: completed.length ? Math.round(completed.reduce((sum, booking) => sum + (booking.priceCents ?? 0), 0) / completed.length) : 0,
        statusCounts,
        popularServices,
      },
      team: team.sort((a, b) => b.completedBookings - a.completedBookings || b.assignedBookings - a.assignedBookings),
      note: 'Revenue is attributed evenly across assigned team members when a booking has more than one assignee. Ratings come from reviews on assigned bookings.',
    };
  }
}
