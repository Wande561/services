import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

export interface StoredFile {
  storageKey: string | null;
  legacyData: Buffer | null;
}

export function createR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Set R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY');
  }
  return {
    bucket,
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
  };
}

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string | null;

  constructor() {
    const configured = ['R2_ACCOUNT_ID', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
      .some(key => Boolean(process.env[key]?.trim()));
    if (configured) {
      const storage = createR2Client();
      this.client = storage.client;
      this.bucket = storage.bucket;
    } else {
      this.client = null;
      this.bucket = null;
    }
  }

  async store(namespace: 'listing' | 'quote' | 'verification' | 'portfolio', mimeType: string, data: Buffer): Promise<StoredFile> {
    if (!this.client || !this.bucket) {
      if (process.env.NODE_ENV === 'production') throw new ServiceUnavailableException('File storage is not configured');
      return { storageKey: null, legacyData: data };
    }
    const storageKey = `files/${namespace}/${randomUUID()}`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, Body: data, ContentType: mimeType }));
    return { storageKey, legacyData: null };
  }

  async putAtKey(storageKey: string, mimeType: string, data: Uint8Array) {
    if (!this.client || !this.bucket) throw new ServiceUnavailableException('File storage is not configured');
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: storageKey, Body: data, ContentType: mimeType }));
  }

  async read(storageKey: string | null, legacyData: Uint8Array | null | undefined, label = 'File'): Promise<Buffer> {
    if (storageKey) {
      if (!this.client || !this.bucket) throw new ServiceUnavailableException('File storage is not configured');
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
      if (!result.Body) throw new NotFoundException(`${label} not found`);
      return Buffer.from(await result.Body.transformToByteArray());
    }
    if (legacyData) return Buffer.from(legacyData);
    throw new NotFoundException(`${label} not found`);
  }

  async delete(storageKey: string) {
    if (!this.client || !this.bucket) return;
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }

  async deleteMany(storageKeys: Array<string | null | undefined>) {
    const keys = [...new Set(storageKeys.filter((key): key is string => Boolean(key)))];
    await Promise.all(keys.map(key => this.delete(key)));
  }
}
