import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiRole } from '../ai-auth.guard';
import { AiMessage } from '../providers/ai-provider.client';

interface StoredConversation { userId: string; role: AiRole; messages: AiMessage[]; updatedAt: number }
const lifetimeMs = 2 * 60 * 60 * 1000;
const maxConversations = 5000;

@Injectable()
export class SupportConversationService {
  private readonly conversations = new Map<string, StoredConversation>();

  open(conversationId: string | undefined, userId: string, role: AiRole) {
    const now = Date.now();
    this.removeExpired(now);
    if (conversationId) {
      const conversation = this.conversations.get(conversationId);
      if (!conversation) throw new NotFoundException('Conversation is no longer available. Start a new support chat.');
      if (conversation.userId !== userId || conversation.role !== role) throw new ForbiddenException('This conversation is not available to your account');
      conversation.updatedAt = now;
      return { id: conversationId, messages: conversation.messages.map(message => ({ ...message })) };
    }
    while (this.conversations.size >= maxConversations) {
      const oldest = [...this.conversations.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
      if (!oldest) break;
      this.conversations.delete(oldest[0]);
    }
    const id = randomUUID();
    this.conversations.set(id, { userId, role, messages: [], updatedAt: now });
    return { id, messages: [] as AiMessage[] };
  }

  save(id: string, userId: string, role: AiRole, messages: AiMessage[], maxTurns: number) {
    const conversation = this.conversations.get(id);
    if (!conversation || conversation.userId !== userId || conversation.role !== role) throw new ForbiddenException('This conversation is not available to your account');
    conversation.messages = messages.slice(-maxTurns * 2).map(message => ({ ...message }));
    conversation.updatedAt = Date.now();
  }

  count() { return this.conversations.size; }

  private removeExpired(now: number) {
    for (const [id, conversation] of this.conversations) {
      if (now - conversation.updatedAt >= lifetimeMs) this.conversations.delete(id);
    }
  }
}
