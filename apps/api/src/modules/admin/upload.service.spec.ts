import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock @aws-sdk/s3-request-presigner before service import
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://r2.example.com/signed-upload-url'),
}));

// Mock @aws-sdk/client-s3
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({})),
  PutObjectCommand: vi.fn().mockImplementation((input: Record<string, unknown>) => ({ input })),
}));

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('fake-image-data')),
}));

import { UploadService } from './upload.service.js';

function createMockConfigService(overrides: Record<string, string> = {}) {
  const config: Record<string, string> = {
    R2_ACCOUNT_ID: 'test-account-id',
    R2_BUCKET_NAME: 'grapit-uploads',
    R2_PUBLIC_URL: 'https://cdn.grapit.kr',
    R2_ACCESS_KEY_ID: 'test-access-key',
    R2_SECRET_ACCESS_KEY: 'test-secret-key',
    API_URL: 'http://localhost:8080',
    ...overrides,
  };

  return {
    get: vi.fn((key: string, defaultValue?: string) => config[key] ?? defaultValue),
    getOrThrow: vi.fn((key: string) => {
      const val = config[key];
      if (val === undefined) throw new Error(`Missing config: ${key}`);
      return val;
    }),
  };
}

describe('UploadService', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('R2 mode (credentials configured)', () => {
    let service: UploadService;
    let mockConfigService: ReturnType<typeof createMockConfigService>;

    beforeEach(() => {
      mockConfigService = createMockConfigService();
      service = new UploadService(
        mockConfigService as unknown as ConstructorParameters<typeof UploadService>[0],
      );
    });

    it('should not be in local mode when R2_ACCOUNT_ID is set', () => {
      expect(service.isLocalMode).toBe(false);
    });

    it('should return uploadUrl, publicUrl, key, and mode for R2', async () => {
      const result = await service.generatePresignedUrl('posters', 'image/jpeg', 'jpg');

      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('publicUrl');
      expect(result).toHaveProperty('key');
      expect(result.mode).toBe('r2');

      expect(result.key).toMatch(/^posters\//);
      expect(result.key).toMatch(/\.jpg$/);

      expect(typeof result.uploadUrl).toBe('string');
      expect(result.uploadUrl.length).toBeGreaterThan(0);
    });

    it('should generate unique keys using UUID', async () => {
      const result1 = await service.generatePresignedUrl('posters', 'image/jpeg', 'jpg');
      const result2 = await service.generatePresignedUrl('posters', 'image/jpeg', 'jpg');

      expect(result1.key).not.toBe(result2.key);
    });

    it('should set correct ContentType on PutObjectCommand', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');

      await service.generatePresignedUrl('seatmaps', 'image/svg+xml', 'svg');

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: 'image/svg+xml',
        }),
      );
    });

    it('should construct publicUrl from R2_PUBLIC_URL config + key', async () => {
      const result = await service.generatePresignedUrl('banners', 'image/png', 'png');

      expect(result.publicUrl).toBe(`https://cdn.grapit.kr/${result.key}`);
    });
  });

  describe('Local mode (R2 credentials not configured)', () => {
    let service: UploadService;
    let mockConfigService: ReturnType<typeof createMockConfigService>;

    beforeEach(() => {
      mockConfigService = createMockConfigService({
        R2_ACCOUNT_ID: '',
      });
      service = new UploadService(
        mockConfigService as unknown as ConstructorParameters<typeof UploadService>[0],
      );
    });

    it('should be in local mode when R2_ACCOUNT_ID is empty', () => {
      expect(service.isLocalMode).toBe(true);
    });

    it('should return mode local with local upload URLs', async () => {
      const result = await service.generatePresignedUrl('posters', 'image/jpeg', 'jpg');

      expect(result.mode).toBe('local');
      expect(result.uploadUrl).toMatch(
        /^http:\/\/localhost:8080\/api\/v1\/admin\/upload\/local\/posters\//,
      );
      expect(result.publicUrl).toBe(result.uploadUrl);
      expect(result.key).toMatch(/^posters\//);
      expect(result.key).toMatch(/\.jpg$/);
    });

    it('should not call S3Client or getSignedUrl in local mode', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      vi.mocked(S3Client).mockClear();
      vi.mocked(getSignedUrl).mockClear();

      await service.generatePresignedUrl('posters', 'image/jpeg', 'jpg');

      // S3Client should not have been called again after construction
      expect(S3Client).not.toHaveBeenCalled();
      expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it('should save file to local filesystem', async () => {
      const { writeFile, mkdir } = await import('node:fs/promises');

      const buffer = Buffer.from('test-image-data');
      const url = await service.saveLocalFile('posters/test.jpg', buffer);

      expect(mkdir).toHaveBeenCalled();
      expect(writeFile).toHaveBeenCalled();
      expect(url).toContain('/api/v1/admin/upload/local/posters/test.jpg');
    });

    it('should read file from local filesystem', async () => {
      const result = await service.getLocalFile('posters/test.jpg');

      expect(result).not.toBeNull();
      expect(result!.contentType).toBe('image/jpeg');
      expect(Buffer.isBuffer(result!.buffer)).toBe(true);
    });

    it('should return correct content type based on extension', async () => {
      const pngResult = await service.getLocalFile('posters/test.png');
      expect(pngResult!.contentType).toBe('image/png');

      const webpResult = await service.getLocalFile('posters/test.webp');
      expect(webpResult!.contentType).toBe('image/webp');
    });

    it('should return null when file does not exist', async () => {
      const { readFile } = await import('node:fs/promises');
      vi.mocked(readFile).mockRejectedValueOnce(new Error('ENOENT'));

      const result = await service.getLocalFile('posters/nonexistent.jpg');
      expect(result).toBeNull();
    });
  });

  describe('Local mode with undefined R2_ACCOUNT_ID', () => {
    it('should be in local mode when R2_ACCOUNT_ID is undefined', () => {
      const mockConfig = {
        get: vi.fn((key: string, defaultValue?: string) => {
          const config: Record<string, string> = {
            R2_BUCKET_NAME: '',
            R2_PUBLIC_URL: '',
            R2_ACCESS_KEY_ID: '',
            R2_SECRET_ACCESS_KEY: '',
            API_URL: 'http://localhost:8080',
          };
          return config[key] ?? defaultValue;
        }),
        getOrThrow: vi.fn(),
      };

      const service = new UploadService(
        mockConfig as unknown as ConstructorParameters<typeof UploadService>[0],
      );
      expect(service.isLocalMode).toBe(true);
    });
  });
});
