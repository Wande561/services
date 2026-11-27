import { ForbiddenException, Injectable } from '@nestjs/common';
import { AiPrincipal } from '../ai-auth.guard';
import { AiMessage, AiProviderClient } from '../providers/ai-provider.client';
import { AiService } from '../ai.service';
import { AiUsageMonitor } from '../ai-usage.monitor';
import { AiChatDto } from '../ai-chat.dto';
import { ProviderConversationService } from './provider-conversation.service';
import { ProviderDataService } from './provider-data.service';
import { providerSystemPrompt } from './provider.prompt';
import { providerInsightsPrompt } from './provider.prompt';
import { ProviderBusinessInsightsService, type InsightsDays } from './provider-business-insights.service';

const unavailable = "I'm having trouble loading your provider information right now. Please try again shortly.";
const configUnavailable = "The Provider Assistant isn't available right now. Please try again shortly.";

function positiveSetting(name: string, fallback: number, max: number) {
  const raw = process.env[name];
  if (raw === undefined || !raw.trim()) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 && value <= max ? value : fallback;
}

@Injectable()
export class ProviderAssistantService {
  constructor(
    private readonly ai: AiService,
    private readonly provider: AiProviderClient,
    private readonly data: ProviderDataService,
    private readonly conversations: ProviderConversationService,
    private readonly usage: AiUsageMonitor,
    private readonly businessInsights: ProviderBusinessInsightsService,
  ) {}

  async reply(principal: AiPrincipal, request: AiChatDto) {
    if (principal.role !== 'provider') throw new ForbiddenException('Provider role is required');
    const historyTurns = positiveSetting('AI_CONVERSATION_HISTORY_TURNS', 6, 10);
    const conversation = this.conversations.open(request.conversationId, principal.userId);
    const previousQuestion = [...conversation.messages].reverse().find(message => message.role === 'user')?.content ?? '';
    const currentIntent = this.data.intent(request.message);
    const intent = currentIntent === 'unsupported' && previousQuestion ? this.data.intent(previousQuestion) : currentIntent;
    if (intent === 'unsupported') return this.saveWithoutModel(conversation.id, principal.userId, conversation.messages, request.message, 'I can help with your bookings, appointments, quote requests, notifications, provider profile, and draft replies. What would you like to review? ', historyTurns);
    let context: Record<string, unknown>;
    try {
      context = await this.data.load(principal.userId, intent, request.message);
    } catch {
      this.usage.record({ userId: principal.userId, endpoint: 'provider', provider: this.ai.selectedProvider(), success: false });
      return { conversationId: conversation.id, answer: unavailable };
    }

    const emptyAnswer = this.emptyDataAnswer(intent, context);
    if (emptyAnswer) return this.saveWithoutModel(conversation.id, principal.userId, conversation.messages, request.message, emptyAnswer, historyTurns);

    let config;
    try {
      config = this.ai.getProviderConfiguration();
    } catch {
      this.usage.record({ userId: principal.userId, endpoint: 'provider', provider: this.ai.selectedProvider(), success: false });
      return { conversationId: conversation.id, answer: configUnavailable };
    }

    const system = providerSystemPrompt(JSON.stringify(context));
    const currentMessage: AiMessage = { role: 'user', content: request.message };
    const messages: AiMessage[] = [...conversation.messages, currentMessage].slice(-historyTurns * 2 - 1);
    const maxTokens = positiveSetting('AI_MAX_OUTPUT_TOKENS', 600, 1200);
    const timeoutMs = positiveSetting('AI_REQUEST_TIMEOUT_MS', 20_000, 60_000);
    try {
      const completion = await this.provider.complete(config, system, messages, maxTokens, timeoutMs);
      const answer = completion.text.trim() || 'I could not prepare a response from the information currently available.';
      this.conversations.save(conversation.id, principal.userId, [...messages, { role: 'assistant', content: answer }], historyTurns);
      this.usage.record({ userId: principal.userId, endpoint: 'provider', provider: config.provider, success: true, tokenUsage: completion.tokenUsage });
      return { conversationId: conversation.id, answer };
    } catch {
      this.usage.record({ userId: principal.userId, endpoint: 'provider', provider: config.provider, success: false });
      return { conversationId: conversation.id, answer: unavailable };
    }
  }

  async observations(principal: AiPrincipal, days: InsightsDays) {
    if (principal.role !== 'provider') throw new ForbiddenException('Provider role is required');
    let metrics;
    try {
      metrics = await this.businessInsights.get(principal.userId, days);
    } catch {
      this.usage.record({ userId: principal.userId, endpoint: 'provider', provider: this.ai.selectedProvider(), success: false });
      return { answer: 'I could not load your business metrics right now. Your dashboard metrics may still be available; please try again shortly.' };
    }
    const overview = metrics.overview;
    const activity = overview.bookingRequests + overview.quoteRequests + overview.completedBookings + overview.submittedQuotes;
    if (!activity && !overview.pendingBookingRequests && !overview.pendingQuoteRequests && !overview.confirmedBookings) {
      return { answer: `There is not enough recorded activity in the last ${days} days to identify a business trend. Your dashboard metrics show zero new booking or quote requests for this period.` };
    }
    let config;
    try {
      config = this.ai.getProviderConfiguration();
    } catch {
      this.usage.record({ userId: principal.userId, endpoint: 'provider', provider: this.ai.selectedProvider(), success: false });
      return { answer: "AI observations aren't available right now. Your verified business metrics are still shown above." };
    }
    const daysLabel = `Interpret the verified metrics for the last ${days} days. Identify up to three useful observations and one optional next step.`;
    try {
      const completion = await this.provider.complete(
        config,
        providerInsightsPrompt(JSON.stringify(metrics)),
        [{ role: 'user', content: daysLabel }],
        positiveSetting('AI_MAX_OUTPUT_TOKENS', 600, 1200),
        positiveSetting('AI_REQUEST_TIMEOUT_MS', 20_000, 60_000),
      );
      this.usage.record({ userId: principal.userId, endpoint: 'provider', provider: config.provider, success: true, tokenUsage: completion.tokenUsage });
      return { answer: completion.text.trim().slice(0, 4000) || 'There are not enough clear patterns in this period to provide an observation.' };
    } catch {
      this.usage.record({ userId: principal.userId, endpoint: 'provider', provider: config.provider, success: false });
      return { answer: "AI observations aren't available right now. Your verified business metrics are still shown above." };
    }
  }

  private saveWithoutModel(conversationId: string, providerId: string, history: AiMessage[], userText: string, answer: string, maxTurns: number) {
    this.conversations.save(conversationId, providerId, [...history, { role: 'user', content: userText }, { role: 'assistant', content: answer }], maxTurns);
    return { conversationId, answer };
  }

  private emptyDataAnswer(intent: string, context: Record<string, any>) {
    const hasCounts = (group: any) => Object.values(group?.statusCounts ?? {}).some(value => typeof value === 'number' && value > 0);
    if (intent === 'bookings' && !hasCounts(context.bookings) && !context.bookings?.appointments?.length && !context.bookings?.pendingRequests?.length) return 'I could not find booking requests or upcoming appointments in your current records.';
    if (intent === 'quotes' && !hasCounts(context.quotes) && !context.quotes?.attention?.length && !context.quotes?.recentRequests?.length) return 'I could not find quote requests in your current provider records.';
    if (intent === 'notifications' && !context.notifications?.notifications?.length && !context.notifications?.quoteAlerts?.length) return 'I could not find recent notifications or quote alerts in your current records.';
    if (intent === 'profile' && !context.providerProfile) return 'I could not load provider profile or service information for this account.';
    if (intent === 'draft' && !hasCounts(context.bookings) && !hasCounts(context.quotes) && !context.bookings?.pendingRequests?.length && !context.quotes?.recentRequests?.length) return 'I could not find a current booking or quote request to ground a draft. Open Messages or Quotes and tell me which request you want to work on.';
    if (intent === 'summary' && !hasCounts(context.bookings) && !hasCounts(context.quotes) && !context.notifications?.notifications?.length && !context.notifications?.quoteAlerts?.length) return 'Your current records show no booking requests, quote requests, or notifications to summarise.';
    return '';
  }
}
