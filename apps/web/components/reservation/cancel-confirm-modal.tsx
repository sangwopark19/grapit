'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

const CANCEL_REASONS = [
  '단순 변심',
  '일정 변경',
  '다른 좌석으로 재예매',
  '기타',
] as const;

interface CancelConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refundAmount: number;
  paymentMethod: string;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}

export function CancelConfirmModal({
  open,
  onOpenChange,
  refundAmount,
  paymentMethod,
  onConfirm,
  isLoading,
}: CancelConfirmModalProps) {
  const [reason, setReason] = useState('');

  function handleConfirm() {
    if (!reason) return;
    onConfirm(reason);
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      setReason('');
    }
    onOpenChange(value);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        role="alertdialog"
        aria-modal="true"
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-semibold">
            예매를 취소하시겠습니까?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-gray-600">
            취소 후에는 복구할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="cancel-reason"
              className="mb-2 block text-sm font-semibold text-gray-700"
            >
              취소 사유
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="cancel-reason" className="w-full">
                <SelectValue placeholder="취소 사유를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {CANCEL_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">환불 예정 금액</span>
              <span className="text-base font-semibold text-gray-900">
                {refundAmount.toLocaleString('ko-KR')}원
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-gray-600">환불 수단</span>
              <span className="text-sm text-gray-600">
                {paymentMethod}으로 환불
              </span>
            </div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost">돌아가기</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                취소 처리 중...
              </>
            ) : (
              '예매 취소'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
