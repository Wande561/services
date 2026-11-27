import { Module } from '@nestjs/common';
import { BookingsModule } from '../../bookings.module';
import { MessagesModule } from '../../messages.module';
import { NotificationsModule } from '../../notifications.module';
import { ProvidersModule } from '../../providers.module';
import { QuotesModule } from '../../quotes.module';
import { AiCoreModule } from '../ai-core.module';
import { AuthModule } from '../../auth.module';
import { ProviderConversationService } from './provider-conversation.service';
import { ProviderDataService } from './provider-data.service';
import { ProviderAssistantService } from './provider.service';
import { ProviderBusinessInsightsController } from './provider-business-insights.controller';
import { ProviderBusinessInsightsService } from './provider-business-insights.service';

@Module({
  imports: [AiCoreModule, AuthModule, BookingsModule, QuotesModule, NotificationsModule, MessagesModule, ProvidersModule],
  controllers: [ProviderBusinessInsightsController],
  providers: [ProviderAssistantService, ProviderDataService, ProviderConversationService, ProviderBusinessInsightsService],
  exports: [ProviderAssistantService],
})
export class ProviderAssistantModule {}
