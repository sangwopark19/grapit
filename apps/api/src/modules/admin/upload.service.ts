import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

@Injectable()
export class UploadService {
  private readonly s3: S3Client | null;
  private readonly bucketName: string;
  private readonly r2PublicUrl: string;
  readonly isLocalMode: boolean;
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID', '');
    this.bucketName = config.get<string>('R2_BUCKET_NAME', '') as string;
    this.r2PublicUrl = config.get<string>('R2_PUBLIC_URL', '') as string;

    this.isLocalMode = !accountId;

    if (this.isLocalMode) {
      this.s3 = null;
      this.logger.warn(
        'R2_ACCOUNT_ID not configured — running in local file storage mode',
      );
    } else {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.get<string>('R2_ACCESS_KEY_ID', '') as string,
          secretAccessKey: config.get<string>(
            'R2_SECRET_ACCESS_KEY',
            '',
          ) as string,
        },
      });
    }
  }

  async generatePresignedUrl(
    folder: string,
    contentType: string,
    extension: string,
  ): Promise<{
    uploadUrl: string;
    publicUrl: string;
    key: string;
    mode: 'local' | 'r2';
  }> {
    const key = `${folder}/${randomUUID()}.${extension}`;

    if (this.isLocalMode) {
      const apiBase = this.config.get<string>(
        'API_URL',
        'http://localhost:8080',
      );
      return {
        uploadUrl: `${apiBase}/api/v1/admin/upload/local/${key}`,
        publicUrl: `${apiBase}/api/v1/admin/upload/local/${key}`,
        key,
        mode: 'local' as const,
      };
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3!, command, { expiresIn: 600 });
    return {
      uploadUrl,
      publicUrl: `${this.r2PublicUrl}/${key}`,
      key,
      mode: 'r2' as const,
    };
  }

  async saveLocalFile(key: string, buffer: Buffer): Promise<string> {
    const uploadDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadDir, key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    const apiBase = this.config.get<string>(
      'API_URL',
      'http://localhost:8080',
    );
    return `${apiBase}/api/v1/admin/upload/local/${key}`;
  }

  async getLocalFile(
    key: string,
  ): Promise<{ buffer: Buffer; contentType: string } | null> {
    const filePath = path.join(process.cwd(), 'uploads', key);
    try {
      const buffer = await fs.readFile(filePath);
      return { buffer, contentType: this.detectContentType(buffer, key) };
    } catch {
      return null;
    }
  }

  private detectContentType(buffer: Buffer, key: string): string {
    // Detect by magic bytes (file content may not match extension)
    if (buffer.length >= 2) {
      if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg';
      if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png';
      if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif';
      if (buffer.length >= 12 && buffer[0] === 0x52 && buffer[1] === 0x49 &&
          buffer[8] === 0x57 && buffer[9] === 0x45) return 'image/webp';
    }
    // SVG is text-based, fall back to extension
    if (key.endsWith('.svg')) return 'image/svg+xml';
    return 'application/octet-stream';
  }
}
