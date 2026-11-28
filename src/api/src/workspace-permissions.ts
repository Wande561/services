import { WorkspaceRole } from '@prisma/client';

export const workspacePermissions = [
  'workspace.manage',
  'team.view',
  'team.manage',
  'bookings.view',
  'bookings.view.all',
  'bookings.manage',
  'bookings.assign',
  'services.manage',
  'tasks.view',
  'tasks.view.all',
  'tasks.manage',
  'bookings.notes',
  'chat.view',
  'chat.post',
  'announcements.manage',
  'finance.view',
  'analytics.view',
] as const;

export type WorkspacePermission = typeof workspacePermissions[number];

/** Role presets. A member's stored permissions can add or remove individual keys. */
export const rolePermissions: Record<WorkspaceRole, WorkspacePermission[]> = {
  Owner: [...workspacePermissions],
  Manager: [
    'workspace.manage', 'team.view', 'team.manage',
    'bookings.view', 'bookings.view.all', 'bookings.manage', 'bookings.assign', 'bookings.notes',
    'services.manage', 'tasks.view', 'tasks.view.all', 'tasks.manage',
    'chat.view', 'chat.post', 'announcements.manage', 'analytics.view',
  ],
  Staff: ['bookings.view', 'bookings.notes', 'tasks.view', 'tasks.manage', 'chat.view', 'chat.post'],
  Receptionist: ['team.view', 'bookings.view', 'bookings.view.all', 'bookings.manage', 'bookings.assign', 'bookings.notes', 'tasks.view', 'tasks.view.all', 'tasks.manage', 'chat.view', 'chat.post'],
  Finance: ['bookings.view', 'bookings.view.all', 'finance.view', 'analytics.view'],
};

export interface WorkspaceActor {
  userId: string;
  email: string;
  role: WorkspaceRole;
  permissions: Set<WorkspacePermission>;
}

export function effectivePermissions(role: WorkspaceRole, overrides: unknown): Set<WorkspacePermission> {
  const permissions = new Set(rolePermissions[role]);
  if (overrides && typeof overrides === 'object' && !Array.isArray(overrides)) {
    for (const key of workspacePermissions) {
      const value = (overrides as Record<string, unknown>)[key];
      if (value === true) permissions.add(key);
      if (value === false) permissions.delete(key);
    }
  }
  return permissions;
}

export function hasPermission(role: WorkspaceRole, overrides: unknown, permission: WorkspacePermission) {
  return role === WorkspaceRole.Owner || effectivePermissions(role, overrides).has(permission);
}

export function parsePermissionOverrides(input: unknown): Record<string, boolean> | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Permissions must be an object');
  const out: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!workspacePermissions.includes(key as WorkspacePermission)) throw new Error(`Unknown permission: ${key}`);
    if (typeof value !== 'boolean') throw new Error(`Permission ${key} must be true or false`);
    out[key] = value;
  }
  return out;
}
