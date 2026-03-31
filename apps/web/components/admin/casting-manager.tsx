'use client';

import { useCallback } from 'react';
import type {
  FieldArrayWithId,
  UseFormRegister,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormSetValue,
} from 'react-hook-form';
import { Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { CreatePerformanceFormInput } from '@grapit/shared';
import { usePresignedUpload } from '@/hooks/use-admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CastingManagerProps {
  fields: FieldArrayWithId<CreatePerformanceFormInput, 'castings', 'id'>[];
  append: UseFieldArrayAppend<CreatePerformanceFormInput, 'castings'>;
  remove: UseFieldArrayRemove;
  register: UseFormRegister<CreatePerformanceFormInput>;
  setValue: UseFormSetValue<CreatePerformanceFormInput>;
}

export function CastingManager({
  fields,
  append,
  remove,
  register,
  setValue,
}: CastingManagerProps) {
  const presignedUpload = usePresignedUpload();

  const handlePhotoUpload = useCallback(
    async (index: number, file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('사진은 5MB 이하여야 합니다.');
        return;
      }
      const ext = file.name.split('.').pop() ?? 'jpg';
      try {
        const { uploadUrl, publicUrl } =
          await presignedUpload.mutateAsync({
            folder: 'castings',
            contentType: file.type,
            extension: ext,
          });
        await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });
        setValue(`castings.${index}.photoUrl`, publicUrl, {
          shouldDirty: true,
        });
        toast.success('사진이 업로드되었습니다.');
      } catch {
        toast.error('사진 업로드에 실패했습니다.');
      }
    },
    [presignedUpload, setValue],
  );

  return (
    <div>
      {fields.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">
          등록된 캐스팅이 없습니다.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-col items-center rounded-lg border bg-white p-4"
            >
              {/* Photo */}
              <div className="relative mb-3">
                {field.photoUrl ? (
                  <img
                    src={field.photoUrl}
                    alt={field.actorName || '캐스팅 사진'}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <button
                    type="button"
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-200 transition-colors hover:bg-gray-300"
                    onClick={() =>
                      document
                        .getElementById(`casting-photo-${index}`)
                        ?.click()
                    }
                    aria-label="캐스팅 사진 업로드"
                  >
                    <Upload className="h-5 w-5 text-gray-400" />
                  </button>
                )}
                <input
                  id={`casting-photo-${index}`}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePhotoUpload(index, f);
                  }}
                />
              </div>

              {/* Name + Role */}
              <Input
                {...register(`castings.${index}.actorName`)}
                placeholder="배우 이름"
                className="mb-2 text-center text-sm"
              />
              <Input
                {...register(`castings.${index}.roleName`)}
                placeholder="역할 (선택)"
                className="mb-2 text-center text-sm"
              />

              {/* Delete */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-red-600"
                    aria-label={`${field.actorName || '캐스팅'} 삭제`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      캐스팅 정보를 삭제하시겠습니까?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      해당 배우의 캐스팅 정보가 삭제됩니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>취소</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => remove(index)}
                    >
                      삭제
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        className="mt-3"
        onClick={() =>
          append({
            actorName: '',
            roleName: null,
            photoUrl: null,
            sortOrder: fields.length,
          })
        }
      >
        <Plus className="mr-2 h-4 w-4" />
        캐스팅 추가
      </Button>
    </div>
  );
}
