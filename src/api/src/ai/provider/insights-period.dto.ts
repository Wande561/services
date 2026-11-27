import { BadRequestException } from '@nestjs/common';
import type { InsightsDays } from './provider-business-insights.service';

export function parseInsightsDays(value: unknown): InsightsDays {
  if (value === undefined || value === '30' || value === 30) return 30;
  if (value === '7' || value === 7) return 7;
  if (value === '90' || value === 90) return 90;
  throw new BadRequestException('Choose an insights period of 7, 30, or 90 days');
}

export function parseInsightsBody(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('An insights period is required');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => key !== 'days')) throw new BadRequestException('Unexpected field in insights request');
  return { days: parseInsightsDays(body.days) };
}
