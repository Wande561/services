import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from '../auth.service';

export type AiRole = 'client' | 'provider';
export interface AiPrincipal { userId: string; role: AiRole }
export interface AiRequest extends Request { aiPrincipal?: AiPrincipal }

const AI_ROLES = 'ai:roles';
export const AiRoles = (...roles: AiRole[]) => SetMetadata(AI_ROLES, roles);

@Injectable()
export class AiSessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AiRequest>();
    const token = req.cookies?.session;
    if (typeof token !== 'string' || !token) throw new UnauthorizedException();
    const account = await this.auth.currentUser(token);
    const profile = account.profile;
    const role = profile?.role;
    if (role !== 'client' && role !== 'provider') throw new ForbiddenException('A client or provider profile is required');
    if (!profile) throw new ForbiddenException('A client or provider profile is required');
    if (role === 'client' && !profile.clientEnabled) throw new ForbiddenException('A client profile is required');
    if (role === 'provider' && !profile.providerEnabled) throw new ForbiddenException('A provider profile is required');
    req.aiPrincipal = { userId: account.id, role };
    return true;
  }
}

@Injectable()
export class AiRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<AiRole[]>(AI_ROLES, [context.getHandler(), context.getClass()]);
    if (!roles?.length) return true;
    const req = context.switchToHttp().getRequest<AiRequest>();
    if (!req.aiPrincipal || !roles.includes(req.aiPrincipal.role)) throw new ForbiddenException('Your account cannot access this AI endpoint');
    return true;
  }
}
