import { Injectable } from '@nestjs/common';
import { AiPrincipal } from '../ai-auth.guard';
import { AiProviderClient, AiMessage } from '../providers/ai-provider.client';
import { AiService } from '../ai.service';
import { AiUsageMonitor } from '../ai-usage.monitor';
import { SupportMessageDto } from './dto/support-message.dto';
import { supportSystemPrompt } from './support.prompt';
import { SupportConversationService } from './support-conversation.service';
import { SupportKnowledgeService } from './support-knowledge.service';

const fallback = "I don't have enough verified information to answer that confidently. Please contact support through Complaints & Support.";
const unavailable = "I'm having trouble responding right now. Please try again shortly or visit Complaints & Support.";

// Only match specific questions so general questions do not receive misleading advice.
function offlineGuide(role: 'client' | 'provider', message: string): string | undefined {
  const q = message.toLowerCase();
  const prefix = 'AI support is temporarily unavailable. Here is a quick guide:\n\n';
  if (/\b(quote|quotation)\b/.test(q) && /\b(request|send|get|ask|apply)\b/.test(q) && role === 'client') return prefix + '1. Open Services and choose a listing.\n2. Select Request a quote.\n3. Describe the job, choose a future date and time, enter the location, then submit.\n4. Check Quotes for the provider’s response. You can also message them after requesting.';
  if (/\b(quote|quotation)\b/.test(q) && /\b(respond|reply|offer|send|create)\b/.test(q) && role === 'provider') return prefix + 'Open Quotes on your dashboard, choose the request, and prepare your quotation. Add your costs, appointment time and the other required details, then send it to the client.';
  if (/\b(verify|verification|verified)\b/.test(q)) return prefix + 'Open Settings and find Verification. Submit the requested details and documents. An administrator will review your request.';
  if (/\b(profile|details|phone)\b/.test(q) && /\b(update|edit|change|manage)\b/.test(q)) return prefix + 'Open Settings to update your profile and account details. Some changes may require your verification to be reviewed again.';
  if (/\b(cancel|cancellation)\b/.test(q) && /\b(booking|appointment)\b/.test(q)) return prefix + 'Open Bookings and select the appointment to see the available cancellation options. The options and any reliability consequences depend on its status and timing.';
  if (/\b(contact|complaint|support)\b/.test(q)) return prefix + 'Open Complaints & Support from the menu to submit an issue and follow its status.';
  return undefined;
}

function positiveSetting(name: string, fallbackValue: number, maximum: number) {
  const raw = process.env[name];
  if (raw === undefined || !raw.trim()) return fallbackValue;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 && value <= maximum ? value : fallbackValue;
}

@Injectable()
export class SupportService {
  constructor(
    private readonly ai: AiService,
    private readonly provider: AiProviderClient,
    private readonly knowledge: SupportKnowledgeService,
    private readonly conversations: SupportConversationService,
    private readonly usage: AiUsageMonitor,
  ) {}

  async reply(principal: AiPrincipal, request: SupportMessageDto) {
    const historyTurns = positiveSetting('AI_CONVERSATION_HISTORY_TURNS', 6, 10);
    const conversation = this.conversations.open(request.conversationId, principal.userId, principal.role);
    const priorQuestion = [...conversation.messages].reverse().find(message => message.role === 'user')?.content ?? '';
    const relevant = this.knowledge.retrieve(principal.role, `${priorQuestion}\n${request.message}`);
    if (!relevant.length) {
      this.conversations.save(conversation.id, principal.userId, principal.role, [...conversation.messages, { role: 'user', content: request.message }, { role: 'assistant', content: fallback }], historyTurns);
      return { conversationId: conversation.id, answer: fallback };
    }

    let config;
    try {
      config = this.ai.getProviderConfiguration();
    } catch {
      this.usage.record({ userId: principal.userId, endpoint: 'support', provider: this.ai.selectedProvider(), success: false });
      const answer = offlineGuide(principal.role, request.message) ?? unavailable;
      this.conversations.save(conversation.id, principal.userId, principal.role, [...conversation.messages, { role: 'user', content: request.message }, { role: 'assistant', content: answer }], historyTurns);
      return { conversationId: conversation.id, answer };
    }

    const system = supportSystemPrompt(principal.role, this.knowledge.forPrompt(principal.role, relevant));
    const currentMessage: AiMessage = { role: 'user', content: request.message };
    const messages: AiMessage[] = [...conversation.messages, currentMessage].slice(-historyTurns * 2 - 1);
    const maxTokens = positiveSetting('AI_MAX_OUTPUT_TOKENS', 600, 1200);
    const timeoutMs = positiveSetting('AI_REQUEST_TIMEOUT_MS', 20_000, 60_000);
    try {
      const completion = await this.provider.complete(config, system, messages, maxTokens, timeoutMs);
      const answer = completion.text.trim() || fallback;
      this.conversations.save(conversation.id, principal.userId, principal.role, [...messages, { role: 'assistant', content: answer }], historyTurns);
      this.usage.record({ userId: principal.userId, endpoint: 'support', provider: config.provider, success: true, tokenUsage: completion.tokenUsage });
      return { conversationId: conversation.id, answer };
    } catch {
      this.usage.record({ userId: principal.userId, endpoint: 'support', provider: config.provider, success: false });
      const answer = offlineGuide(principal.role, request.message) ?? unavailable;
      this.conversations.save(conversation.id, principal.userId, principal.role, [...messages, { role: 'assistant', content: answer }], historyTurns);
      return { conversationId: conversation.id, answer };
    }
  }
}
