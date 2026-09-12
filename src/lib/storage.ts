import { promises as fs } from 'fs';
import path from 'path';

export interface StorageDriver {
  write(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Time-limited URL — local driver fakes this via a signed API route, S3 driver would presign. */
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
}

/** Local filesystem driver for dev. Never expose LOCAL_STORAGE_DIR paths directly to clients. */
class LocalStorageDriver implements StorageDriver {
  private root = process.env.LOCAL_STORAGE_DIR ?? './.storage';

  private resolve(key: string) {
    const safeKey = key.replace(/\.\./g, ''); // defense-in-depth path traversal guard
    return path.join(this.root, safeKey);
  }

  async write(key: string, data: Buffer) {
    const filePath = this.resolve(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, data);
  }

  async read(key: string) {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }

  async getSignedUrl(key: string) {
    // Served through /api/documents/[id]/file which itself checks session ownership —
    // "signed" here means "authorization-checked", matching the local dev environment.
    return `/api/files/${encodeURIComponent(key)}`;
  }
}

/** Placeholder — wire @aws-sdk/client-s3 here. Interface is what matters for the pipeline. */
class S3StorageDriver implements StorageDriver {
  write(): Promise<void> {
    throw new Error('S3StorageDriver not implemented — set STORAGE_DRIVER=local or implement this class.');
  }
  read(): Promise<Buffer> {
    throw new Error('S3StorageDriver not implemented.');
  }
  delete(): Promise<void> {
    throw new Error('S3StorageDriver not implemented.');
  }
  getSignedUrl(): Promise<string> {
    throw new Error('S3StorageDriver not implemented.');
  }
}

let driver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (driver) return driver;
  driver = process.env.STORAGE_DRIVER === 's3' ? new S3StorageDriver() : new LocalStorageDriver();
  return driver;
}
