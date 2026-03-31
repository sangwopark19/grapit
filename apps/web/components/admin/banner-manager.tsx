'use client';

import { useState, useCallback } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePresignedUpload } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface BannerFormData {
  imageUrl: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
}

interface BannerFormProps {
  initialData?: Partial<BannerFormData>;
  onSubmit: (data: BannerFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function BannerForm({
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
}: BannerFormProps) {
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl ?? '');
  const [linkUrl, setLinkUrl] = useState(initialData?.linkUrl ?? '');
  const [sortOrder, setSortOrder] = useState(initialData?.sortOrder ?? 0);
  const presignedUpload = usePresignedUpload();

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('이미지는 5MB 이하여야 합니다.');
        return;
      }
      const ext = file.name.split('.').pop() ?? 'jpg';
      try {
        const { uploadUrl, publicUrl } =
          await presignedUpload.mutateAsync({
            folder: 'banners',
            contentType: file.type,
            extension: ext,
          });
        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        setImageUrl(publicUrl);
        toast.success('배너 이미지가 업로드되었습니다.');
      } catch {
        toast.error('이미지 업로드에 실패했습니다.');
      }
    },
    [presignedUpload],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageUrl) {
      toast.error('배너 이미지를 업로드해주세요.');
      return;
    }
    await onSubmit({
      imageUrl,
      linkUrl: linkUrl || '',
      sortOrder,
      isActive: true,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border p-4">
      {/* Image */}
      {imageUrl ? (
        <div className="relative">
          <img
            src={imageUrl}
            alt="배너 미리보기"
            className="aspect-video w-full rounded-lg object-cover"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() =>
              document.getElementById('banner-image-input')?.click()
            }
          >
            이미지 변경
          </Button>
        </div>
      ) : (
        <div
          className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-primary hover:bg-primary/5"
          onClick={() =>
            document.getElementById('banner-image-input')?.click()
          }
        >
          <Upload className="mb-2 h-8 w-8 text-gray-400" />
          <p className="text-sm text-gray-500">배너 이미지 업로드</p>
          <p className="mt-1 text-xs text-gray-400">16:9 비율 권장</p>
        </div>
      )}
      <input
        id="banner-image-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file);
        }}
      />

      {/* Link URL */}
      <div>
        <label htmlFor="banner-link" className="mb-1 block text-sm font-semibold">
          링크 URL (선택)
        </label>
        <Input
          id="banner-link"
          type="url"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

      {/* Sort Order */}
      <div>
        <label htmlFor="banner-sort" className="mb-1 block text-sm font-semibold">
          순서
        </label>
        <Input
          id="banner-sort"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(Number(e.target.value))}
          min={0}
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            '저장'
          )}
        </Button>
      </div>
    </form>
  );
}
