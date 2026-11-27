import { Injectable, Logger } from '@nestjs/common';
import { AiProviderName } from './ai.service';

export interface AiUsageEvent {
  userId: string;
  endpoint: 'support' | 'provider';
  provider?: AiProviderName;
  success: boolean;
  tokenUsage?: number;
  timestamp?: Date;
}

@Injectable()
export class AiUsageMonitor {
  private readonly logger = new Logger(AiUsageMonitor.name);

  record(event: AiUsageEvent) {
    this.logger.log({
      userId: event.userId,
      endpoint: event.endpoint,
      timestamp: (event.timestamp ?? new Date()).toISOString(),
      ...(event.provider ? { provider: event.provider } : {}),
      success: event.success,
      ...(Number.isSafeInteger(event.tokenUsage) && event.tokenUsage! >= 0 ? { tokenUsage: event.tokenUsage } : {}),
    });
  }
}
