import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { createR2Client } from '../src/object-storage.service';

const pageSize = 50;
const apply = process.argv.includes('--apply');
const db = new PrismaClient();

type FileRow = { id: string; mimeType: string; bytes: Uint8Array | null };

async function migrateFiles(
  namespace: string,
  count: () => Promise<number>,
  fetchBatch: () => Promise<FileRow[]>,
  saveKey: (id: string, key: string) => Promise<unknown>,
  upload: (key: string, mimeType: string, data: Uint8Array) => Promise<void>,
) {
  const pending = await count();
  if (!apply) {
    console.log(`${namespace}: ${pending} legacy file(s) need migration`);
    return;
  }
  let migrated = 0;
  for (;;) {
    const rows = await fetchBatch();
    if (!rows.length) break;
    for (const row of rows) {
      if (!row.bytes?.length) throw new Error(`${namespace}/${row.id} has no bytes to upload`);
      const key = `legacy/${namespace}/${row.id}`;
      await upload(key, row.mimeType, row.bytes);
      await saveKey(row.id, key);
      migrated += 1;
    }
  }
  console.log(`${namespace}: migrated ${migrated} of ${pending} file(s)`);
}

async function main() {
  let upload: (key: string, mimeType: string, data: Uint8Array) => Promise<void> = async () => {
    throw new Error('Unreachable upload in dry-run');
  };
  if (apply) {
    const { client, bucket } = createR2Client();
    upload = async (key, mimeType, data) => {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: mimeType, Body: data }));
    };
  } else {
    console.log('Dry run only. Add --apply to upload files and clear their database bytes after review.');
  }

  const row = <T extends { id: string; mimeType: string }>(item: T, bytes: Uint8Array | null): FileRow => ({ id: item.id, mimeType: item.mimeType, bytes });
  await migrateFiles('listing',
    () => db.listingPhoto.count({ where: { storageKey: null, image: { not: null } } }),
    async () => (await db.listingPhoto.findMany({ where: { storageKey: null, image: { not: null } }, orderBy: { id: 'asc' }, take: pageSize, select: { id: true, mimeType: true, image: true } })).map(item => row(item, item.image)),
    (id, storageKey) => db.listingPhoto.update({ where: { id }, data: { storageKey, image: null } }), upload);
  await migrateFiles('quote',
    () => db.quotePhoto.count({ where: { storageKey: null, data: { not: null } } }),
    async () => (await db.quotePhoto.findMany({ where: { storageKey: null, data: { not: null } }, orderBy: { id: 'asc' }, take: pageSize, select: { id: true, mimeType: true, data: true } })).map(item => row(item, item.data)),
    (id, storageKey) => db.quotePhoto.update({ where: { id }, data: { storageKey, data: null } }), upload);
  await migrateFiles('portfolio',
    () => db.portfolioItem.count({ where: { storageKey: null, image: { not: null } } }),
    async () => (await db.portfolioItem.findMany({ where: { storageKey: null, image: { not: null } }, orderBy: { id: 'asc' }, take: pageSize, select: { id: true, mimeType: true, image: true } })).map(item => row(item, item.image)),
    (id, storageKey) => db.portfolioItem.update({ where: { id }, data: { storageKey, image: null } }), upload);
  await migrateFiles('verification',
    () => db.verificationDocument.count({ where: { storageKey: null, data: { not: null } } }),
    async () => (await db.verificationDocument.findMany({ where: { storageKey: null, data: { not: null } }, orderBy: { id: 'asc' }, take: pageSize, select: { id: true, mimeType: true, data: true } })).map(item => row(item, item.data)),
    (id, storageKey) => db.verificationDocument.update({ where: { id }, data: { storageKey, data: null } }), upload);
}

main().catch(error => {
  console.error('Object storage migration failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});
