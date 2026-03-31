import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class UploadService {
  private readonly s3: S3Client;
  private readonly bucketName: string;
  private readonly publicUrl: string;

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID', '');
    this.bucketName = config.get<string>('R2_BUCKET_NAME', '') as string;
    this.publicUrl = config.get<string>('R2_PUBLIC_URL', '') as string;

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.get<string>('R2_ACCESS_KEY_ID', '') as string,
        secretAccessKey: config.get<string>('R2_SECRET_ACCESS_KEY', '') as string,
      },
    });
  }

  async generatePresignedUrl(
    folder: string,
    contentType: string,
    extension: string,
  ): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
    const key = `${folder}/${randomUUID()}.${extension}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 600 });
    return {
      uploadUrl,
      publicUrl: `${this.publicUrl}/${key}`,
      key,
    };
  }
}
