import { Module } from '@nestjs/common';
import { AuthModule } from '../auth.module';
import { AiRoleGuard, AiSessionGuard } from './ai-auth.guard';
import { AiRateLimitGuard } from './ai-rate-limit.guard';
import { AiService } from './ai.service';
import { AiUsageMonitor } from './ai-usage.monitor';
import { AiProviderClient } from './providers/ai-provider.client';

@Module({
  imports: [AuthModule],
  providers: [AiSessionGuard, AiRoleGuard, AiRateLimitGuard, AiService, AiUsageMonitor, AiProviderClient],
  exports: [AuthModule, AiSessionGuard, AiRoleGuard, AiRateLimitGuard, AiService, AiUsageMonitor, AiProviderClient],
})
export class AiCoreModule {}
