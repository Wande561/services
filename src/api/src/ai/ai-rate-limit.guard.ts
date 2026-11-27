import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import { AiRequest } from './ai-auth.guard';

interface Bucket { count: number; expiresAt: number }
const maxBuckets = 10_000;

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();
  private requestsSinceCleanup = 0;

  canActivate(context: ExecutionContext) {
    const max = this.readPositiveInteger('AI_RATE_LIMIT_MAX', 10);
    const windowMs = this.readPositiveInteger('AI_RATE_LIMIT_WINDOW_MS', 60_000);
    const req = context.switchToHttp().getRequest<AiRequest>();
    const principal = req.aiPrincipal;
    if (!principal) throw new InternalServerErrorException('AI authentication guard is not configured');
    const now = Date.now();
    if (++this.requestsSinceCleanup >= 128) {
      for (const [bucketKey, bucketValue] of this.buckets) {
        if (bucketValue.expiresAt <= now) this.buckets.delete(bucketKey);
      }
      this.requestsSinceCleanup = 0;
    }
    const key = `${principal.userId}:${req.baseUrl ?? ''}${req.route?.path ?? req.path}`;
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      if (!bucket && this.buckets.size >= maxBuckets) {
        // Bound process memory if many distinct authenticated accounts hit the route.
        // This remains a per-process limiter; production replicas need a shared store.
        let oldestKey: string | undefined;
        let oldestExpiry = Number.POSITIVE_INFINITY;
        for (const [candidateKey, candidate] of this.buckets) {
          if (candidate.expiresAt < oldestExpiry) {
            oldestExpiry = candidate.expiresAt;
            oldestKey = candidateKey;
          }
        }
        if (oldestKey) this.buckets.delete(oldestKey);
      }
      bucket = { count: 0, expiresAt: now + windowMs };
      this.buckets.set(key, bucket);
    }
    if (bucket.count >= max) throw new HttpException('AI request limit reached. Try again shortly.', HttpStatus.TOO_MANY_REQUESTS);
    bucket.count += 1;
    return true;
  }

  private readPositiveInteger(name: string, fallback: number) {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') return fallback;
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      throw new InternalServerErrorException(`AI rate limit configuration is invalid (${name})`);
    }
    return parsed;
  }
}
