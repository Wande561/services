import { BadRequestException } from '@nestjs/common';

export interface SupportMessageDto { message: string; conversationId?: string }

export function parseSupportMessageDto(value: unknown): SupportMessageDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('A message is required');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => key !== 'message' && key !== 'conversationId')) {
    throw new BadRequestException('Unexpected field in support request');
  }
  if (typeof body.message !== 'string' || !body.message.trim()) throw new BadRequestException('Message must be a non-empty string');
  if (body.message.length > 2000) throw new BadRequestException('Message must be 2,000 characters or fewer');
  if (body.conversationId !== undefined && (typeof body.conversationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.conversationId))) {
    throw new BadRequestException('Conversation ID is invalid');
  }
  return { message: body.message.trim(), ...(typeof body.conversationId === 'string' ? { conversationId: body.conversationId } : {}) };
}
