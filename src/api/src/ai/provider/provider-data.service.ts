import { Injectable } from '@nestjs/common';
import { BookingsService } from '../../bookings.service';
import { MessagesService } from '../../messages.service';
import { NotificationsService } from '../../notifications.service';
import { ProvidersService } from '../../providers.service';
import { QuotesService } from '../../quotes.service';
import { ProviderBusinessInsightsService, type InsightsDays } from './provider-business-insights.service';

export type ProviderIntent = 'summary' | 'bookings' | 'quotes' | 'notifications' | 'profile' | 'draft' | 'insights' | 'unsupported';

const has = (text: string, expression: RegExp) => expression.test(text);
function todaySast(now: Date) {
  return new Date(`${new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10)}T00:00:00+02:00`);
}
function scrubClientText(value: string | null | undefined) {
  return (value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email removed]')
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[phone number removed]')
    .replace(/(?:R|\$|£|€)\s*\d(?:[\d, ]*\d)?(?:\.\d{1,2})?/gi, '[amount removed]')
    .replace(/\b\d[\d,]*(?:\.\d{1,2})?\s*(?:rand|zar|cents)\b/gi, '[amount removed]')
    .slice(0, 700);
}
function relevance(message: string, item: { service: string; description: string }) {
  const words = new Set(message.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3));
  return `${item.service} ${item.description}`.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 3 && words.has(word)).length;
}

@Injectable()
export class ProviderDataService {
  constructor(
    private readonly bookings: BookingsService,
    private readonly quotes: QuotesService,
    private readonly notifications: NotificationsService,
    private readonly messages: MessagesService,
    private readonly providers: ProvidersService,
    private readonly businessInsights: ProviderBusinessInsightsService,
  ) {}

  intent(message: string): ProviderIntent {
    if (has(message, /\b(performance|perform(?:ed|ing)?|business insights?|acceptance rate|how many quotes have i won|why.*(?:declin|increas)|what should i prioritise|what should i prioritize|which\b.{0,30}\bservices?\b.{0,40}\b(?:requests?|popular)|business activity)\b/i)) return 'insights';
    if (has(message, /\b(draft|write|reply|respond|response|explain)\b|\bmessage\s+(?:the|a|my)\s+client\b|\bask\s+the\s+client\b|\brequest\s+(?:more\s+)?information\b/i)) return 'draft';
    if (has(message, /\b(notifications?|missed anything|important updates?|alerts?)\b/i)) return 'notifications';
    if (has(message, /\b(quote|quotation|expir|client request|quote request)\b/i)) return 'quotes';
    if (has(message, /\b(booking|appointment|tomorrow|schedule)\b/i)) return 'bookings';
    if (has(message, /\b(summary|summarise|summarize|attention|workload|today|daily|this week|coming up|happening|tasks?)\b/i)) return 'summary';
    if (has(message, /\b(profile|service|listing|business|working hours)\b/i)) return 'profile';
    return 'unsupported';
  }

  async load(providerId: string, intent: ProviderIntent, question: string, now = new Date()) {
    const start = todaySast(now);
    const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const week = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const asksToday = has(question, /\b(today|daily)\b/i);
    const asksTomorrow = has(question, /\btomorrow\b/i);
    const rangeFrom = asksTomorrow ? nextDay : asksToday ? start : now;
    const rangeTo = asksTomorrow ? new Date(nextDay.getTime() + 24 * 60 * 60 * 1000) : asksToday ? nextDay : week;
    const includeBookings = ['summary', 'bookings', 'draft'].includes(intent);
    const includeQuotes = ['summary', 'quotes', 'draft'].includes(intent);
    const includeNotifications = ['summary', 'notifications'].includes(intent);
    // Only include business location and working hours for an explicit profile question.
    // Quote and draft context already carries the relevant listing/request details.
    const includeProfile = intent === 'profile';
    const insightDays: InsightsDays = has(question, /\b(?:90 days|last 3 months|three months)\b/i) ? 90 : has(question, /\b(?:7 days|last week|this week)\b/i) ? 7 : 30;
    const [bookingSummary, quoteSummary, notificationSummary, profile, businessInsights] = await Promise.all([
      includeBookings ? this.bookings.assistantSummary(providerId, rangeFrom, rangeTo, now) : Promise.resolve(undefined),
      includeQuotes ? this.quotes.assistantSummary(providerId, now, week) : Promise.resolve(undefined),
      includeNotifications ? this.notifications.assistantSummary(providerId) : Promise.resolve(undefined),
      includeProfile ? this.providers.assistantProfile(providerId) : Promise.resolve(undefined),
      intent === 'insights' ? this.businessInsights.get(providerId, insightDays, now) : Promise.resolve(undefined),
    ]);

    if (bookingSummary) bookingSummary.pendingRequests = bookingSummary.pendingRequests.map(item => ({ ...item, notes: scrubClientText(item.notes) || null }));
    if (quoteSummary) {
      for (const item of [...quoteSummary.attention, ...quoteSummary.recentRequests]) {
        item.description = scrubClientText(item.description);
        item.additionalInfo = scrubClientText(item.additionalInfo) || null;
        item.changeRequest = scrubClientText(item.changeRequest) || null;
        if (item.latestQuote) {
          item.latestQuote.serviceDescription = scrubClientText(item.latestQuote.serviceDescription);
          item.latestQuote.notes = scrubClientText(item.latestQuote.notes) || null;
        }
      }
    }
    if (profile) profile.listings = profile.listings.map(item => ({ ...item, description: scrubClientText(item.description) }));

    let conversationContext: Array<{ referenceId: string; kind: 'booking' | 'quote'; messages: Array<{ speaker: string; body: string; createdAt: Date }> }> | undefined;
    if (intent === 'draft') {
      const references: Array<{ kind: 'booking' | 'quote'; id: string }> = [];
      const quoteRecords = [...(quoteSummary?.attention ?? []), ...(quoteSummary?.recentRequests ?? [])];
      const quoteById = new Map(quoteRecords.map(item => [item.id, item]));
      for (const item of quoteById.values()) {
        if (['Pending', 'Quoted', 'RevisionRequested', 'DepositPending', 'SlotUnavailable'].includes(item.status)) references.push({ kind: 'quote', id: item.id });
      }
      for (const item of bookingSummary?.pendingRequests ?? []) references.push({ kind: 'booking', id: item.id });
      const candidates = references.map(ref => {
        if (ref.kind === 'quote') {
          const item = quoteById.get(ref.id);
          if (!item) return null;
          return { ...ref, service: item.service, description: `${item.description} ${item.additionalInfo ?? ''} ${item.changeRequest ?? ''}` };
        }
        const item = bookingSummary?.pendingRequests.find(row => row.id === ref.id);
        if (!item) return null;
        return { ...ref, service: item.serviceTitle, description: item.notes ?? '' };
      }).filter((item): item is NonNullable<typeof item> => item !== null);
      candidates.sort((a, b) => relevance(question, b) - relevance(question, a));
      try {
        conversationContext = await this.messages.assistantRecentContext(providerId, candidates.slice(0, 3).map(({ kind, id }) => ({ kind, id })));
      } catch {
        conversationContext = [];
      }
      conversationContext = conversationContext.map(thread => ({
        ...thread,
        messages: thread.messages.map(item => ({ ...item, body: scrubClientText(item.body) })),
      }));
    }

    return {
      timezone: 'Africa/Johannesburg (SAST, UTC+02:00)',
      retrievedAt: now.toISOString(),
      ...(profile ? { providerProfile: profile } : {}),
      ...(bookingSummary ? { bookings: bookingSummary } : {}),
      ...(quoteSummary ? { quotes: quoteSummary } : {}),
      ...(notificationSummary ? { notifications: notificationSummary } : {}),
      ...(conversationContext ? { clientConversationContext: conversationContext } : {}),
      ...(businessInsights ? { businessInsights } : {}),
    };
  }
}
