import type { AccountRole } from '@prisma/client';

export function bookingOwnership(accountId: string, role: AccountRole) {
  return role === 'provider' ? { slot: { providerId: accountId } } : { clientId: accountId };
}
