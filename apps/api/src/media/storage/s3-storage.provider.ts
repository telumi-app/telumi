import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

import { StorageProvider } from './storage.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly client: S3Client;
  private readonly publicClient: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(S3StorageProvider.name);

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('STORAGE_ENDPOINT', 'http://localhost:9000');
    // STORAGE_PUBLIC_ENDPOINT permite que URLs presignadas usem o host público
    // (acessível pelo browser), separado do endpoint interno usado pela API.
    // Se não definido, usa o mesmo endpoint.
    const publicEndpoint = this.config.get<string>('STORAGE_PUBLIC_ENDPOINT', endpoint);
    const region = this.config.get<string>('STORAGE_REGION', 'us-east-1');
    const accessKeyId = this.config.get<string>('STORAGE_ACCESS_KEY', 'minioadmin');
    const secretAccessKey = this.config.get<string>('STORAGE_SECRET_KEY', 'minioadmin');

    this.bucket = this.config.get<string>('STORAGE_BUCKET', 'telumi-media');

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: true, // required for MinIO
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Client separado para gerar URLs presignadas com o host público.
    // Garante que o browser consiga fazer PUT diretamente no storage.
    this.publicClient = new S3Client({
      endpoint: publicEndpoint,
      region,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async presignedPutUrl(key: string, mimeType: string, expiresInSec: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    // Usa publicClient para que a URL gerada aponte para o endpoint público,
    // acessível pelo browser do usuário.
    return getSignedUrl(this.publicClient, command, { expiresIn: expiresInSec });
  }

  async presignedGetUrl(key: string, expiresInSec: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    // Usa publicClient para que a URL gerada aponte para o endpoint público.
    return getSignedUrl(this.publicClient, command, { expiresIn: expiresInSec });
  }

  async getObject(key: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new Error(`Object not found: ${key}`);
    }

    return response.Body as Readable;
  }

  async putObject(key: string, body: Buffer | Readable, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async listObjects(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      for (const obj of response.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }

      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket "${this.bucket}" already exists`);
    } catch (headErr: unknown) {
      // If bucket doesn't exist, try to create it
      try {
        this.logger.log(`Creating bucket "${this.bucket}"...`);
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket "${this.bucket}" created`);
      } catch (createErr: unknown) {
        // Re-throw — caller (StorageModule) handles gracefully
        throw createErr;
      }
    }

    // Configurar CORS para permitir uploads diretos do browser via presigned PUT.
    // Sem isso, os navegadores bloqueiam o PUT por política de same-origin.
    try {
      await this.client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                AllowedOrigins: ['*'],
                ExposeHeaders: ['ETag', 'Content-Length'],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        }),
      );
      this.logger.log(`CORS configured for bucket "${this.bucket}"`);
    } catch (corsErr: unknown) {
      this.logger.warn(`Could not configure CORS for bucket "${this.bucket}": ${corsErr instanceof Error ? corsErr.message : String(corsErr)}`);
    }
  }
}
