'use client';

import { useState } from 'react';
import type { RegisterStep2Input } from '@grapit/shared';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import termsOfServiceMd from '@/content/legal/terms-of-service.md';
import privacyPolicyMd from '@/content/legal/privacy-policy.md';
import marketingConsentMd from '@/content/legal/marketing-consent.md';
import { LegalDraftBanner } from '@/components/legal/legal-draft-banner';
import { TermsMarkdown } from '@/components/legal/terms-markdown';

interface SignupStep2Props {
  onComplete: (data: RegisterStep2Input) => void;
  onBack: () => void;
  defaultValues: RegisterStep2Input | null;
}

const LEGAL_CONTENT: Record<string, { title: string; content: string }> = {
  termsOfService: { title: '이용약관', content: termsOfServiceMd },
  privacyPolicy: { title: '개인정보처리방침', content: privacyPolicyMd },
  marketingConsent: { title: '마케팅 수신 동의', content: marketingConsentMd },
};

export function SignupStep2({ onComplete, onBack, defaultValues }: SignupStep2Props) {
  const [termsOfService, setTermsOfService] = useState(
    defaultValues?.termsOfService ?? false,
  );
  const [privacyPolicy, setPrivacyPolicy] = useState(
    defaultValues?.privacyPolicy ?? false,
  );
  const [marketingConsent, setMarketingConsent] = useState(
    defaultValues?.marketingConsent ?? false,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState<string>('termsOfService');

  const allChecked = termsOfService && privacyPolicy && marketingConsent;
  const canProceed = termsOfService && privacyPolicy;

  function handleSelectAll(checked: boolean) {
    setTermsOfService(checked);
    setPrivacyPolicy(checked);
    setMarketingConsent(checked);
  }

  function handleViewTerms(key: string) {
    setDialogKey(key);
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!canProceed) return;
    onComplete({
      termsOfService: true,
      privacyPolicy: true,
      marketingConsent,
    });
  }

  return (
    <div className="space-y-6">
      {/* Select all */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="select-all"
          checked={allChecked}
          onCheckedChange={(checked) => handleSelectAll(checked === true)}
        />
        <label
          htmlFor="select-all"
          className="cursor-pointer text-base font-semibold text-gray-900"
        >
          전체 동의
        </label>
      </div>

      <Separator />

      {/* Individual terms */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="terms"
              checked={termsOfService}
              onCheckedChange={(checked) => setTermsOfService(checked === true)}
            />
            <label htmlFor="terms" className="cursor-pointer text-base text-gray-900">
              이용약관 동의 <span className="text-error">(필수)</span>
            </label>
          </div>
          <button
            type="button"
            onClick={() => handleViewTerms('termsOfService')}
            className="text-caption text-gray-500 underline hover:text-primary"
          >
            보기
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="privacy"
              checked={privacyPolicy}
              onCheckedChange={(checked) => setPrivacyPolicy(checked === true)}
            />
            <label htmlFor="privacy" className="cursor-pointer text-base text-gray-900">
              개인정보처리방침 동의 <span className="text-error">(필수)</span>
            </label>
          </div>
          <button
            type="button"
            onClick={() => handleViewTerms('privacyPolicy')}
            className="text-caption text-gray-500 underline hover:text-primary"
          >
            보기
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox
              id="marketing"
              checked={marketingConsent}
              onCheckedChange={(checked) => setMarketingConsent(checked === true)}
            />
            <label
              htmlFor="marketing"
              className="cursor-pointer text-base text-gray-900"
            >
              마케팅 수신 동의 <span className="text-gray-400">(선택)</span>
            </label>
          </div>
          <button
            type="button"
            onClick={() => handleViewTerms('marketingConsent')}
            className="text-caption text-gray-500 underline hover:text-primary"
          >
            보기
          </button>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={onBack}
        >
          이전
        </Button>
        <Button
          type="button"
          size="lg"
          className="flex-1"
          disabled={!canProceed}
          onClick={handleSubmit}
        >
          다음
        </Button>
      </div>

      {/* Terms dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{LEGAL_CONTENT[dialogKey]?.title}</DialogTitle>
            <DialogDescription className="sr-only">
              {LEGAL_CONTENT[dialogKey]?.title} 상세 내용
            </DialogDescription>
          </DialogHeader>
          <LegalDraftBanner />
          <TermsMarkdown>{LEGAL_CONTENT[dialogKey]?.content ?? ''}</TermsMarkdown>
        </DialogContent>
      </Dialog>
    </div>
  );
}
