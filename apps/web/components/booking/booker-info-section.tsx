'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BookerFormData {
  name: string;
  phone: string;
}

interface BookerInfoSectionProps {
  userName: string;
  userPhone: string;
  onUpdate: (data: { name: string; phone: string }) => void;
}

export function BookerInfoSection({ userName, userPhone, onUpdate }: BookerInfoSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(userName);
  const [displayPhone, setDisplayPhone] = useState(userPhone);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BookerFormData>({
    defaultValues: {
      name: displayName,
      phone: displayPhone,
    },
  });

  function handleEdit() {
    reset({ name: displayName, phone: displayPhone });
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    reset({ name: displayName, phone: displayPhone });
  }

  function onSubmit(data: BookerFormData) {
    setDisplayName(data.name);
    setDisplayPhone(data.phone);
    onUpdate(data);
    setIsEditing(false);
  }

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">예매자 정보</h2>
          {!isEditing && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={handleEdit}>
              수정
            </Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="booker-name">이름</Label>
              <Input
                id="booker-name"
                {...register('name', {
                  required: '이름을 입력해주세요',
                  minLength: { value: 2, message: '이름은 2자 이상이어야 합니다' },
                })}
                placeholder="이름"
              />
              {errors.name && (
                <p className="text-xs text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="booker-phone">연락처</Label>
              <Input
                id="booker-phone"
                {...register('phone', {
                  required: '연락처를 입력해주세요',
                  pattern: {
                    value: /^010-\d{4}-\d{4}$/,
                    message: '올바른 전화번호 형식이 아닙니다 (010-0000-0000)',
                  },
                })}
                placeholder="010-0000-0000"
              />
              {errors.phone && (
                <p className="text-xs text-red-500">{errors.phone.message}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" size="sm">저장</Button>
              <Button type="button" variant="outline" size="sm" onClick={handleCancel}>
                취소
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-1 text-sm text-gray-700">
            <p>{displayName}</p>
            <p>{displayPhone}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
