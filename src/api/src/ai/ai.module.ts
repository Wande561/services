import { Module } from '@nestjs/common';
import { AiCoreModule } from './ai-core.module';
import { AiController } from './ai.controller';
import { SupportModule } from './support/support.module';
import { ProviderAssistantModule } from './provider/provider.module';

@Module({
  imports: [AiCoreModule, SupportModule, ProviderAssistantModule],
  controllers: [AiController],
  exports: [AiCoreModule, SupportModule],
})
export class AiModule {}
