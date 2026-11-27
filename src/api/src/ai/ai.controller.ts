import { Body, Controller, Header, Post, Req, UseGuards } from '@nestjs/common';
import type { AiRequest } from './ai-auth.guard';
import { AiRoles, AiRoleGuard, AiSessionGuard } from './ai-auth.guard';
import { AiRateLimitGuard } from './ai-rate-limit.guard';
import { parseAiChatDto } from './ai-chat.dto';
import { checkFrontendOrigin } from '../request-validation';
import { ProviderAssistantService } from './provider/provider.service';
import { parseInsightsBody } from './provider/insights-period.dto';

@Controller('ai')
@UseGuards(AiSessionGuard, AiRoleGuard, AiRateLimitGuard)
export class AiController {
  constructor(private readonly providerAssistant: ProviderAssistantService) {}

  @Post('provider')
  @Header('Cache-Control', 'private, no-store')
  @AiRoles('provider')
  provider(@Req() req: AiRequest, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    return this.providerAssistant.reply(req.aiPrincipal!, parseAiChatDto(body));
  }

  @Post('provider/insights')
  @Header('Cache-Control', 'private, no-store')
  @AiRoles('provider')
  providerInsights(@Req() req: AiRequest, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    return this.providerAssistant.observations(req.aiPrincipal!, parseInsightsBody(body).days);
  }
}
