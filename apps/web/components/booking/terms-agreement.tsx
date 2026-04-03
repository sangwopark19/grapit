'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface TermsAgreementProps {
  agreed: boolean;
  onAgreementChange: (agreed: boolean) => void;
}

export function TermsAgreement({ agreed, onAgreementChange }: TermsAgreementProps) {
  const [bookingTerms, setBookingTerms] = useState(false);
  const [privacyTerms, setPrivacyTerms] = useState(false);
  const [dialogContent, setDialogContent] = useState<{ title: string; content: string } | null>(null);

  const allChecked = bookingTerms && privacyTerms;

  useEffect(() => {
    onAgreementChange(allChecked);
  }, [allChecked, onAgreementChange]);

  const handleAllToggle = useCallback((checked: boolean | 'indeterminate') => {
    const value = checked === true;
    setBookingTerms(value);
    setPrivacyTerms(value);
  }, []);

  return (
    <Card>
      <CardContent className="space-y-3">
        <h2 className="text-base font-semibold">약관 동의</h2>

        <div role="group" aria-label="약관 동의">
          <label className="flex cursor-pointer items-center gap-3 py-2">
            <Checkbox
              checked={allChecked}
              onCheckedChange={handleAllToggle}
              aria-label="전체 동의"
            />
            <span className="text-sm font-semibold">전체 동의</span>
          </label>

          <Separator className="my-2" />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-3 py-1.5">
                <Checkbox
                  checked={bookingTerms}
                  onCheckedChange={(checked) => setBookingTerms(checked === true)}
                />
                <span className="text-sm">예매/취소 규정에 동의합니다 (필수)</span>
              </label>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-gray-500"
                onClick={() =>
                  setDialogContent({
                    title: '예매/취소 규정',
                    content:
                      '1. 예매 완료 후 취소 시 공연 시작 24시간 전까지 전액 환불 가능합니다.\n\n2. 공연 시작 24시간 이내에는 취소가 불가합니다.\n\n3. 예매 시 선택한 좌석은 결제 완료 시점에 확정됩니다.\n\n4. 결제 완료 후 좌석 변경은 취소 후 재예매로만 가능합니다.\n\n5. 공연 당일 부도 시 환불이 불가합니다.\n\n6. 천재지변 등 불가항력적 사유로 공연이 취소된 경우 전액 환불됩니다.',
                  })
                }
              >
                보기
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-3 py-1.5">
                <Checkbox
                  checked={privacyTerms}
                  onCheckedChange={(checked) => setPrivacyTerms(checked === true)}
                />
                <span className="text-sm">개인정보 제3자 제공에 동의합니다 (필수)</span>
              </label>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-gray-500"
                onClick={() =>
                  setDialogContent({
                    title: '개인정보 제3자 제공 동의',
                    content:
                      '1. 제공받는 자: 공연 주최사\n\n2. 제공 목적: 예매 확인, 입장 관리\n\n3. 제공 항목: 예매자 이름, 연락처, 예매번호\n\n4. 보유 기간: 공연 종료 후 30일\n\n5. 동의를 거부할 수 있으나, 거부 시 예매가 불가합니다.',
                  })
                }
              >
                보기
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={!!dialogContent} onOpenChange={() => setDialogContent(null)}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{dialogContent?.title}</DialogTitle>
              <DialogDescription className="sr-only">
                {dialogContent?.title} 내용
              </DialogDescription>
            </DialogHeader>
            <div className="whitespace-pre-wrap text-sm text-gray-700">
              {dialogContent?.content}
            </div>
            <DialogFooter>
              <Button onClick={() => setDialogContent(null)}>확인</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
