import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock @aws-sdk/s3-request-presigner before service import
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://r2.example.com/signed-upload-url'),
}));

// Mock @aws-sdk/client-s3
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
  PutObjectCommand: vi.fn().mockImplementation((input: Record<string, unknown>) => ({ input })),
}));

// Mock the service module -- it does not exist yet (RED state)
vi.mock('./upload.service.js', () => {
  return {
    UploadService: vi.fn().mockImplementation(function (this: Record<string, unknown>, configService: unknown) {
      this.configService = configService;
      return this;
    }),
  };
});

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type UploadServiceType = import('./upload.service.js').UploadService;

/**
 * Phase 2 Plan 00: RED-state test stubs for UploadService (ADMN-03)
 *
 * These tests describe the expected contract for UploadService:
 * - generatePresignedUrl: creates a presigned PUT URL for R2 upload
 *   Returns { uploadUrl, publicUrl, key } for a given folder and content type
 *
 * Services will be implemented in Plan 02. Tests should turn GREEN then.
 */

function createMockConfigService() {
  const config: Record<string, string> = {
    R2_ACCOUNT_ID: 'test-account-id',
    R2_BUCKET_NAME: 'grapit-uploads',
    R2_PUBLIC_URL: 'https://cdn.grapit.kr',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
  };

  return {
    get: vi.fn((key: string) => config[key]),
    getOrThrow: vi.fn((key: string) => {
      const val = config[key];
      if (val === undefined) throw new Error(`Missing config: ${key}`);
      return val;
    }),
  };
}

describe('UploadService', () => {
  let service: UploadServiceType;
  let mockConfigService: ReturnType<typeof createMockConfigService>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockConfigService = createMockConfigService();

    const { UploadService } = await import('./upload.service.js');
    service = new UploadService(mockConfigService as unknown as Parameters<typeof UploadService>[0]);
  });

  describe('generatePresignedUrl', () => {
    it('should return uploadUrl, publicUrl, and key for a given folder and content type', async () => {
      const result = await service.generatePresignedUrl('posters', 'image/jpeg', 'jpg');

      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('publicUrl');
      expect(result).toHaveProperty('key');

      // Key should start with folder name and end with extension
      expect(result.key).toMatch(/^posters\//);
      expect(result.key).toMatch(/\.jpg$/);

      // uploadUrl should be a signed URL
      expect(typeof result.uploadUrl).toBe('string');
      expect(result.uploadUrl.length).toBeGreaterThan(0);
    });

    it('should generate unique keys using UUID', async () => {
      const result1 = await service.generatePresignedUrl('posters', 'image/jpeg', 'jpg');
      const result2 = await service.generatePresignedUrl('posters', 'image/jpeg', 'jpg');

      // Keys must be unique (UUID-based)
      expect(result1.key).not.toBe(result2.key);
    });

    it('should set correct ContentType on PutObjectCommand', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');

      await service.generatePresignedUrl('seatmaps', 'image/svg+xml', 'svg');

      // When GREEN, PutObjectCommand should have been called with ContentType
      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: 'image/svg+xml',
        }),
      );
    });

    it('should construct publicUrl from R2_PUBLIC_URL config + key', async () => {
      const result = await service.generatePresignedUrl('banners', 'image/png', 'png');

      // publicUrl should be ${R2_PUBLIC_URL}/${key}
      expect(result.publicUrl).toBe(`https://cdn.grapit.kr/${result.key}`);
    });
  });
});
