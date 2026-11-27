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
      return { conversationId: conversation.id, answer: unavailable };
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
      return { conversationId: conversation.id, answer: unavailable };
    }
  }
}
