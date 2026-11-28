const test = require('node:test');
const assert = require('node:assert/strict');
const { WorkspaceRole } = require('@prisma/client');
const { effectivePermissions, hasPermission, parsePermissionOverrides, rolePermissions } = require('../dist/workspace-permissions.js');

test('owner has every workspace permission', () => {
  const permissions = effectivePermissions(WorkspaceRole.Owner, null);
  assert.ok(permissions.has('workspace.manage'));
  assert.ok(permissions.has('team.manage'));
  assert.ok(permissions.has('bookings.assign'));
  assert.ok(permissions.has('finance.view'));
  assert.ok(permissions.has('analytics.view'));
});

test('staff can only view assigned bookings by default', () => {
  const permissions = effectivePermissions(WorkspaceRole.Staff, null);
  assert.ok(permissions.has('bookings.view'));
  assert.equal(permissions.has('bookings.view.all'), false);
  assert.equal(permissions.has('bookings.assign'), false);
  assert.equal(permissions.has('team.manage'), false);
  assert.ok(permissions.has('tasks.view'));
  assert.ok(permissions.has('tasks.manage'));
  assert.ok(permissions.has('chat.post'));
  assert.equal(permissions.has('tasks.view.all'), false);
  assert.equal(permissions.has('announcements.manage'), false);
});

test('manager and finance presets are scoped', () => {
  assert.ok(rolePermissions.Manager.includes('team.manage'));
  assert.ok(rolePermissions.Manager.includes('bookings.assign'));
  assert.ok(rolePermissions.Manager.includes('tasks.view.all'));
  assert.ok(rolePermissions.Manager.includes('announcements.manage'));
  assert.equal(rolePermissions.Manager.includes('finance.view'), false);
  assert.ok(rolePermissions.Finance.includes('finance.view'));
  assert.ok(rolePermissions.Finance.includes('analytics.view'));
  assert.equal(rolePermissions.Finance.includes('team.manage'), false);
  assert.equal(rolePermissions.Finance.includes('chat.post'), false);
  assert.ok(rolePermissions.Receptionist.includes('bookings.assign'));
  assert.equal(rolePermissions.Receptionist.includes('team.manage'), false);
});

test('permission overrides can grant and revoke individual keys', () => {
  const granted = effectivePermissions(WorkspaceRole.Staff, { 'bookings.view.all': true });
  assert.ok(granted.has('bookings.view.all'));

  const revoked = effectivePermissions(WorkspaceRole.Owner, { 'finance.view': false });
  assert.equal(revoked.has('finance.view'), false);
  assert.ok(revoked.has('team.manage'));

  assert.equal(hasPermission(WorkspaceRole.Staff, null, 'bookings.view.all'), false);
  assert.equal(hasPermission(WorkspaceRole.Staff, { 'bookings.view.all': true }, 'bookings.view.all'), true);
});

test('invalid permission overrides are rejected', () => {
  assert.throws(() => parsePermissionOverrides({ 'not.a.permission': true }), /Unknown permission/);
  assert.throws(() => parsePermissionOverrides({ 'team.manage': 'yes' }), /must be true or false/);
  assert.throws(() => parsePermissionOverrides([]), /must be an object/);
  assert.deepEqual(parsePermissionOverrides({ 'team.manage': true }), { 'team.manage': true });
  assert.deepEqual(parsePermissionOverrides({ 'finance.view': true, 'tasks.view': false }), { 'finance.view': true, 'tasks.view': false });
});
