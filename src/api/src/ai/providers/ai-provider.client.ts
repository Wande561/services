import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AiProviderConfiguration } from '../ai.service';

export interface AiMessage { role: 'user' | 'assistant'; content: string }
export interface AiCompletion { text: string; tokenUsage?: number }

@Injectable()
export class AiProviderClient {
  async complete(config: AiProviderConfiguration, system: string, messages: AiMessage[], maxTokens: number, timeoutMs: number): Promise<AiCompletion> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = config.provider === 'openai'
        ? await fetch('https://api.openai.com/v1/responses', {
          method: 'POST', signal: controller.signal,
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: config.model, instructions: system, input: messages, max_output_tokens: maxTokens, store: false }),
        })
        : await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST', signal: controller.signal,
          headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
          body: JSON.stringify({ model: config.model, system, messages, max_tokens: maxTokens, temperature: 0.2 }),
        });

      if (!response.ok) throw new Error('provider request failed');
      const payload: any = await response.json();
      const text = config.provider === 'openai'
        ? Array.isArray(payload?.output) ? payload.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content : []).filter((part: any) => part?.type === 'output_text').map((part: any) => part.text).join('\n') : undefined
        : Array.isArray(payload?.content) ? payload.content.filter((part: any) => part?.type === 'text').map((part: any) => part.text).join('\n') : undefined;
      if (typeof text !== 'string' || !text.trim()) throw new Error('provider returned no answer');
      const tokenUsage = config.provider === 'openai'
        ? typeof payload?.usage?.input_tokens === 'number' && typeof payload?.usage?.output_tokens === 'number'
          ? payload.usage.input_tokens + payload.usage.output_tokens : undefined
        : typeof payload?.usage?.input_tokens === 'number' && typeof payload?.usage?.output_tokens === 'number'
          ? payload.usage.input_tokens + payload.usage.output_tokens : undefined;
      return { text: text.trim().slice(0, 4000), ...(Number.isSafeInteger(tokenUsage) && tokenUsage >= 0 ? { tokenUsage } : {}) };
    } catch {
      // Do not pass through provider response bodies, URLs, keys, or network errors.
      throw new ServiceUnavailableException('AI provider unavailable');
    } finally {
      clearTimeout(timeout);
    }
  }
}
