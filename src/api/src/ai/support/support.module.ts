import { Module } from '@nestjs/common';
import { AiCoreModule } from '../ai-core.module';
import { SupportController } from './support.controller';
import { SupportConversationService } from './support-conversation.service';
import { SupportKnowledgeService } from './support-knowledge.service';
import { SupportService } from './support.service';

@Module({
  imports: [AiCoreModule],
  controllers: [SupportController],
  providers: [SupportService, SupportKnowledgeService, SupportConversationService],
  exports: [SupportService, SupportKnowledgeService],
})
export class SupportModule {}
