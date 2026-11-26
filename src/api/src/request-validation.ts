import { BadRequestException, UnauthorizedException } from '@nestjs/common';

export function checkFrontendOrigin(origin: string | undefined) {
  if (origin !== (process.env.FRONTEND_URL || 'http://localhost:3000')) {
    throw new UnauthorizedException('Invalid request origin');
  }
}

export function requiredText(value: unknown, label: string, maxLength: number) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || trimmed.length > maxLength) {
    throw new BadRequestException(`Enter ${label} (up to ${maxLength} characters)`);
  }
  return trimmed;
}
