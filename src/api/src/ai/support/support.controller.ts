import { Body, Controller, Header, Post, Req, UseGuards } from '@nestjs/common';
import type { AiRequest } from '../ai-auth.guard';
import { AiRoleGuard, AiRoles, AiSessionGuard } from '../ai-auth.guard';
import { AiRateLimitGuard } from '../ai-rate-limit.guard';
import { checkFrontendOrigin } from '../../request-validation';
import { parseSupportMessageDto } from './dto/support-message.dto';
import { SupportService } from './support.service';

@Controller('ai/support')
@UseGuards(AiSessionGuard, AiRoleGuard, AiRateLimitGuard)
@AiRoles('client', 'provider')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('chat')
  @Header('Cache-Control', 'private, no-store')
  chat(@Req() req: AiRequest, @Body() body: unknown) {
    checkFrontendOrigin(req.get('origin'));
    const message = parseSupportMessageDto(body);
    return this.support.reply(req.aiPrincipal!, message);
  }
}
