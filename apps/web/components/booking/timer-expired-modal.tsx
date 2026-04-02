'use client';

import { Clock } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

interface TimerExpiredModalProps {
  open: boolean;
  onReset: () => void;
}

export function TimerExpiredModal({ open, onReset }: TimerExpiredModalProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent size="sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <Clock className="size-12 text-gray-400" />
          <AlertDialogTitle className="text-xl font-semibold text-gray-900">
            시간이 만료되었습니다
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-gray-600">
            선택하신 좌석의 점유 시간이 만료되었습니다. 처음부터 다시 좌석을
            선택해주세요.
          </AlertDialogDescription>
        </div>
        <AlertDialogAction
          onClick={onReset}
          size="lg"
          className="w-full"
        >
          처음으로
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}
