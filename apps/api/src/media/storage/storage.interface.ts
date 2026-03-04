import { Readable } from 'stream';

/**
 * Abstraction for object storage operations.
 * Implementations: S3StorageProvider (S3/MinIO/R2-compatible).
 */
export interface StorageProvider {
  /** Generate a presigned PUT URL for direct browser upload */
  presignedPutUrl(key: string, mimeType: string, expiresInSec: number): Promise<string>;

  /** Generate a presigned GET URL for reading an object */
  presignedGetUrl(key: string, expiresInSec: number): Promise<string>;

  /** Download an object as a readable stream */
  getObject(key: string): Promise<Readable>;

  /** Upload a buffer/stream to storage */
  putObject(key: string, body: Buffer | Readable, contentType: string): Promise<void>;

  /** List all object keys under a given prefix */
  listObjects(prefix: string): Promise<string[]>;

  /** Delete an object from storage */
  delete(key: string): Promise<void>;

  /** Check if an object exists in storage */
  exists(key: string): Promise<boolean>;

  /** Ensure the bucket exists (called on bootstrap) */
  ensureBucket(): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
