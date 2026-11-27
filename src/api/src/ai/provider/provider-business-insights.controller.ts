import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../../auth.service';
import { ProviderBusinessInsightsService } from './provider-business-insights.service';
import { parseInsightsDays } from './insights-period.dto';

@Controller('providers/me/business-insights')
export class ProviderBusinessInsightsController {
  constructor(private readonly auth: AuthService, private readonly insights: ProviderBusinessInsightsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async get(@Req() req: Request, @Query('days') days?: string) {
    const provider = await this.auth.requireProfile(req.cookies?.session, 'provider');
    return this.insights.get(provider.id, parseInsightsDays(days));
  }
}
