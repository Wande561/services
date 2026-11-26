const test = require('node:test');
const assert = require('node:assert/strict');
const { scryptSync, createHash } = require('node:crypto');
const { AuthService } = require('../dist/auth.service.js');

function setup(role = 'provider', passwordHash = `salt:${scryptSync('old-password', 'salt', 64).toString('hex')}`) {
  const writes = [];
  const db = {
    user: {
      findUnique: async () => ({ passwordHash }),
      update: args => { writes.push(['user', args]); return Promise.resolve(args); },
    },
    profile: { findUniqueOrThrow: async () => ({ phone: '0821234567', businessName: 'Jane Services', user: { name: 'Old' } }), update: args => { writes.push(['profile', args]); return Promise.resolve(args.data); } },
    $queryRaw: async () => [],
    session: { deleteMany: args => { writes.push(['sessions', args]); return Promise.resolve(args); } },
    $transaction: operations => typeof operations === 'function' ? operations(db) : Promise.all(operations),
  };
  const service = new AuthService(db);
  service.currentUser = async () => ({ id: 'user1', email: 'a@example.com', name: 'Old', profile: { role } });
  return { service, writes };
}

test('provider profile changes validate and save account and business details', async () => {
  const { service, writes } = setup();
  await assert.rejects(service.updateProfile('token', { name: 'Jane', phone: '0821234567', location: 'Cape Town', businessName: 'Jane Services', serviceCategories: [] }), /category/);
  assert.equal(writes.length, 0);
  const updated = await service.updateProfile('token', { name: ' Jane ', phone: '0821234567', location: 'Cape Town', businessName: 'Jane Services', serviceCategories: ['Plumbing'] });
  assert.equal(updated.name, 'Jane');
  assert.equal(updated.profile.businessName, 'Jane Services');
  assert.deepEqual(writes.map(([kind]) => kind), ['profile', 'user']);
});

test('password change rejects wrong current password and revokes only other sessions on success', async () => {
  const { service, writes } = setup();
  await assert.rejects(service.changePassword('current-token', 'incorrect', 'new-password'), /incorrect/);
  assert.equal(writes.length, 0);
  await service.changePassword('current-token', 'old-password', 'new-password');
  const stored = writes.find(([kind]) => kind === 'user')[1].data.passwordHash;
  const [salt, hash] = stored.split(':');
  assert.equal(scryptSync('new-password', salt, 64).toString('hex'), hash);
  assert.equal(writes.find(([kind]) => kind === 'sessions')[1].where.tokenHash.not, createHash('sha256').update('current-token').digest('hex'));
});

test('Google-only accounts cannot set a password through password change', async () => {
  const { service, writes } = setup('client', null);
  await assert.rejects(service.changePassword('token', 'anything', 'new-password'), /Google sign-in/);
  assert.equal(writes.length, 0);
});
