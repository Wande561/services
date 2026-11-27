import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export type AiProviderName = 'openai' | 'anthropic';
export interface AiProviderConfiguration { provider: AiProviderName; apiKey: string; model: string }

@Injectable()
export class AiService {
  selectedProvider(): AiProviderName | undefined {
    const provider = (process.env.AI_PROVIDER?.trim() || 'openai').toLowerCase();
    return provider === 'openai' || provider === 'anthropic' ? provider : undefined;
  }

  /** Resolve credentials only when an AI operation is requested, so the marketplace can run without them. */
  getProviderConfiguration(): AiProviderConfiguration {
    const provider = this.selectedProvider();
    if (provider === 'openai') {
      return this.requireConfiguration('openai', 'OPENAI_API_KEY', 'OPENAI_MODEL');
    }
    if (provider === 'anthropic') {
      return this.requireConfiguration('anthropic', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL');
    }
    throw new ServiceUnavailableException('AI provider configuration is invalid. Set AI_PROVIDER to openai or anthropic.');
  }

  private requireConfiguration(provider: AiProviderName, keyName: string, modelName: string): AiProviderConfiguration {
    const apiKey = process.env[keyName]?.trim();
    const model = process.env[modelName]?.trim();
    if (!apiKey || !model) {
      throw new ServiceUnavailableException(`AI is not configured. Set ${keyName} and ${modelName} in the API environment.`);
    }
    return { provider, apiKey, model };
  }
}
