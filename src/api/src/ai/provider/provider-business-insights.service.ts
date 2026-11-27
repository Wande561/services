import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

export type InsightsDays = 7 | 30 | 90;
type MetricsRow = {
  bookingRequests: number; pendingBookingRequests: number; confirmedBookings: number; completedBookings: number;
  quoteRequests: number; submittedQuotes: number; acceptedQuotes: number; rejectedQuotes: number;
  expiredQuotes: number; pendingQuoteRequests: number; awaitingClientResponse: number; expiringQuotes: number;
  previousBookingRequests: number; previousQuoteRequests: number;
};
type TrendRow = { day: string; bookingRequests: number; confirmedRequests: number; completedBookings: number; quoteRequests: number };
type ServiceRow = { serviceId: string; service: string; quoteRequests: number; bookingRequests: number; completedBookings: number };

function dateSast(value: Date) { return new Date(value.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function startSast(day: string) { return new Date(`${day}T00:00:00+02:00`); }
const count = (value: number | bigint | null | undefined) => Number(value ?? 0);

@Injectable()
export class ProviderBusinessInsightsService {
  constructor(private readonly db: PrismaService) {}

  async get(providerId: string, days: InsightsDays, now = new Date()) {
    const today = dateSast(now);
    const to = new Date(startSast(today).getTime() + 86_400_000);
    const endDay = dateSast(to);
    const from = new Date(to.getTime() - days * 86_400_000);
    const previousFrom = new Date(from.getTime() - days * 86_400_000);
    const horizon = new Date(now.getTime() + 7 * 86_400_000);
    const fromDay = dateSast(from);
    const previousFromDay = dateSast(previousFrom);
    const status = await this.db.$queryRaw<MetricsRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "Booking" b JOIN "AvailabilitySlot" s ON s."id" = b."slotId" WHERE s."providerId" = ${providerId} AND b."createdAt" >= ${from} AND b."createdAt" < ${to})::int AS "bookingRequests",
        (SELECT COUNT(*) FROM "Booking" b JOIN "AvailabilitySlot" s ON s."id" = b."slotId" WHERE s."providerId" = ${providerId} AND b."status" = 'Pending')::int AS "pendingBookingRequests",
        (SELECT COUNT(*) FROM "Booking" b JOIN "AvailabilitySlot" s ON s."id" = b."slotId" WHERE s."providerId" = ${providerId} AND b."status" = 'Confirmed')::int AS "confirmedBookings",
        (SELECT COUNT(*) FROM "Booking" b JOIN "AvailabilitySlot" s ON s."id" = b."slotId" WHERE s."providerId" = ${providerId} AND b."status" = 'Completed' AND GREATEST(b."clientCompletedAt", b."providerCompletedAt") >= ${from} AND GREATEST(b."clientCompletedAt", b."providerCompletedAt") < ${to})::int AS "completedBookings",
        (SELECT COUNT(*) FROM "QuoteRequest" q WHERE q."providerId" = ${providerId} AND q."createdAt" >= ${from} AND q."createdAt" < ${to})::int AS "quoteRequests",
        (SELECT COUNT(*) FROM "QuoteVersion" v JOIN "QuoteRequest" q ON q."id" = v."requestId" WHERE q."providerId" = ${providerId} AND v."createdAt" >= ${from} AND v."createdAt" < ${to})::int AS "submittedQuotes",
        (SELECT COUNT(*) FROM "QuoteRequest" q WHERE q."providerId" = ${providerId} AND q."status" = 'Accepted' AND q."updatedAt" >= ${from} AND q."updatedAt" < ${to})::int AS "acceptedQuotes",
        (SELECT COUNT(*) FROM "QuoteRequest" q WHERE q."providerId" = ${providerId} AND q."status" = 'Declined' AND q."updatedAt" >= ${from} AND q."updatedAt" < ${to} AND EXISTS (SELECT 1 FROM "QuoteVersion" v WHERE v."requestId" = q."id"))::int AS "rejectedQuotes",
        (SELECT COUNT(*) FROM "QuoteRequest" q JOIN LATERAL (SELECT v."expiresAt" FROM "QuoteVersion" v WHERE v."requestId" = q."id" ORDER BY v."version" DESC LIMIT 1) latest ON true WHERE q."providerId" = ${providerId} AND q."status" = 'Quoted' AND latest."expiresAt" >= ${from} AND latest."expiresAt" < ${to} AND latest."expiresAt" <= ${now})::int AS "expiredQuotes",
        (SELECT COUNT(*) FROM "QuoteRequest" q WHERE q."providerId" = ${providerId} AND q."status" IN ('Pending', 'RevisionRequested'))::int AS "pendingQuoteRequests",
        (SELECT COUNT(*) FROM "QuoteRequest" q JOIN LATERAL (SELECT v."expiresAt" FROM "QuoteVersion" v WHERE v."requestId" = q."id" ORDER BY v."version" DESC LIMIT 1) latest ON true WHERE q."providerId" = ${providerId} AND q."status" = 'Quoted' AND latest."expiresAt" > ${now})::int AS "awaitingClientResponse",
        (SELECT COUNT(*) FROM "QuoteRequest" q JOIN LATERAL (SELECT v."expiresAt" FROM "QuoteVersion" v WHERE v."requestId" = q."id" ORDER BY v."version" DESC LIMIT 1) latest ON true WHERE q."providerId" = ${providerId} AND q."status" = 'Quoted' AND latest."expiresAt" > ${now} AND latest."expiresAt" <= ${horizon})::int AS "expiringQuotes",
        (SELECT COUNT(*) FROM "Booking" b JOIN "AvailabilitySlot" s ON s."id" = b."slotId" WHERE s."providerId" = ${providerId} AND b."createdAt" >= ${previousFrom} AND b."createdAt" < ${from})::int AS "previousBookingRequests",
        (SELECT COUNT(*) FROM "QuoteRequest" q WHERE q."providerId" = ${providerId} AND q."createdAt" >= ${previousFrom} AND q."createdAt" < ${from})::int AS "previousQuoteRequests"
    `;
    const [trendRows, serviceRows] = await Promise.all([
      this.db.$queryRaw<TrendRow[]>`
        WITH calendar AS (
          SELECT generate_series(${fromDay}::date, (${endDay}::date - 1), interval '1 day')::date AS day
        ), booking_daily AS (
          SELECT (b."createdAt" AT TIME ZONE 'Africa/Johannesburg')::date AS day,
            COUNT(*)::int AS requests,
            COUNT(*) FILTER (WHERE b."status" = 'Confirmed')::int AS confirmed
          FROM "Booking" b JOIN "AvailabilitySlot" s ON s."id" = b."slotId"
          WHERE s."providerId" = ${providerId} AND b."createdAt" >= ${from} AND b."createdAt" < ${to}
          GROUP BY 1
        ), quote_daily AS (
          SELECT (q."createdAt" AT TIME ZONE 'Africa/Johannesburg')::date AS day, COUNT(*)::int AS requests
          FROM "QuoteRequest" q WHERE q."providerId" = ${providerId} AND q."createdAt" >= ${from} AND q."createdAt" < ${to}
          GROUP BY 1
        ), completion_daily AS (
          SELECT (GREATEST(b."clientCompletedAt", b."providerCompletedAt") AT TIME ZONE 'Africa/Johannesburg')::date AS day, COUNT(*)::int AS completed
          FROM "Booking" b JOIN "AvailabilitySlot" s ON s."id" = b."slotId"
          WHERE s."providerId" = ${providerId} AND b."status" = 'Completed'
            AND GREATEST(b."clientCompletedAt", b."providerCompletedAt") >= ${from}
            AND GREATEST(b."clientCompletedAt", b."providerCompletedAt") < ${to}
          GROUP BY 1
        )
        SELECT to_char(c.day, 'YYYY-MM-DD') AS day, COALESCE(b.requests, 0)::int AS "bookingRequests",
          COALESCE(b.confirmed, 0)::int AS "confirmedRequests", COALESCE(x.completed, 0)::int AS "completedBookings",
          COALESCE(q.requests, 0)::int AS "quoteRequests"
        FROM calendar c LEFT JOIN booking_daily b ON b.day = c.day
          LEFT JOIN quote_daily q ON q.day = c.day LEFT JOIN completion_daily x ON x.day = c.day
        ORDER BY c.day
      `,
      this.db.$queryRaw<ServiceRow[]>`
        SELECT l."id" AS "serviceId", l."title" AS service,
          COUNT(DISTINCT q."id")::int AS "quoteRequests",
          COUNT(DISTINCT b."id")::int AS "bookingRequests",
          COUNT(DISTINCT b."id") FILTER (WHERE b."status" = 'Completed'
            AND GREATEST(b."clientCompletedAt", b."providerCompletedAt") >= ${from}
            AND GREATEST(b."clientCompletedAt", b."providerCompletedAt") < ${to})::int AS "completedBookings"
        FROM "ServiceListing" l
        LEFT JOIN "QuoteRequest" q ON q."listingId" = l."id" AND q."providerId" = ${providerId} AND q."createdAt" >= ${from} AND q."createdAt" < ${to}
        LEFT JOIN "Booking" b ON b."listingId" = l."id" AND b."createdAt" >= ${from} AND b."createdAt" < ${to}
          AND EXISTS (SELECT 1 FROM "AvailabilitySlot" s WHERE s."id" = b."slotId" AND s."providerId" = ${providerId})
        WHERE l."providerId" = ${providerId}
        GROUP BY l."id", l."title"
        ORDER BY COUNT(DISTINCT q."id") DESC, COUNT(DISTINCT b."id") DESC, l."title" ASC
        LIMIT 8
      `,
    ]);
    const row = status[0];
    const value = (key: keyof MetricsRow) => count(row?.[key]);
    const accepted = value('acceptedQuotes');
    const rejected = value('rejectedQuotes');
    const expired = value('expiredQuotes');
    const outcomeCount = accepted + rejected + expired;
    const acceptanceRate = outcomeCount ? Math.round((accepted / outcomeCount) * 1000) / 10 : null;
    const metrics = {
      period: { days, from: fromDay, to: endDay, timezone: 'Africa/Johannesburg' },
      overview: {
        bookingRequests: value('bookingRequests'), pendingBookingRequests: value('pendingBookingRequests'),
        confirmedBookings: value('confirmedBookings'), completedBookings: value('completedBookings'),
        quoteRequests: value('quoteRequests'), submittedQuotes: value('submittedQuotes'), acceptedQuotes: accepted,
        rejectedQuotes: rejected, expiredQuotes: expired, pendingQuoteRequests: value('pendingQuoteRequests'),
        awaitingClientResponse: value('awaitingClientResponse'), expiringQuotes: value('expiringQuotes'),
        quoteOutcomeCount: outcomeCount, quoteAcceptanceRate: acceptanceRate,
      },
      comparison: {
        previousBookingRequests: value('previousBookingRequests'), previousQuoteRequests: value('previousQuoteRequests'),
        bookingRequestChangePercent: this.percentChange(value('bookingRequests'), value('previousBookingRequests')),
        quoteRequestChangePercent: this.percentChange(value('quoteRequests'), value('previousQuoteRequests')),
      },
      trends: trendRows.map(item => ({ day: item.day, bookingRequests: count(item.bookingRequests), confirmedRequests: count(item.confirmedRequests), completedBookings: count(item.completedBookings), quoteRequests: count(item.quoteRequests) })),
      services: serviceRows.map(item => ({ serviceId: item.serviceId, service: item.service, quoteRequests: count(item.quoteRequests), bookingRequests: count(item.bookingRequests), completedBookings: count(item.completedBookings) })),
    };
    return { ...metrics, recommendations: this.recommendations(metrics.overview, metrics.comparison, serviceRows.length) };
  }

  private percentChange(current: number, previous: number) {
    if (!previous) return current ? null : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private recommendations(overview: Record<string, number | null>, comparison: Record<string, number | null>, serviceCount: number) {
    const result: Array<{ key: string; title: string; detail: string }> = [];
    if (overview.pendingBookingRequests) result.push({ key: 'pending-bookings', title: 'Review booking requests', detail: `${overview.pendingBookingRequests} booking request${overview.pendingBookingRequests === 1 ? '' : 's'} currently await a response.` });
    if (overview.pendingQuoteRequests) result.push({ key: 'pending-quotes', title: 'Review quote requests', detail: `${overview.pendingQuoteRequests} quote request${overview.pendingQuoteRequests === 1 ? '' : 's'} await a quotation or revision.` });
    if (overview.expiringQuotes) result.push({ key: 'expiring-quotes', title: 'Review expiring quotes', detail: `${overview.expiringQuotes} active quote${overview.expiringQuotes === 1 ? '' : 's'} expire within seven days.` });
    if (typeof comparison.bookingRequestChangePercent === 'number' && comparison.bookingRequestChangePercent < -20) result.push({ key: 'booking-demand', title: 'Check recent booking activity', detail: `Booking requests are down ${Math.abs(comparison.bookingRequestChangePercent)}% compared with the preceding period. This describes activity and does not identify a cause.` });
    if (!serviceCount) result.push({ key: 'no-services', title: 'Add a service listing', detail: 'There are no service listings to compare in this period.' });
    return result.slice(0, 5);
  }
}
