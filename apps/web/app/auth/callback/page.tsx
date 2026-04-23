'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { AuthResponse, RegisterStep2Input, RegisterStep3Input } from '@grabit/shared';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/use-auth-store';
import { StepIndicator } from '@/components/auth/step-indicator';
import { SignupStep2 } from '@/components/auth/signup-step2';
import { SignupStep3 } from '@/components/auth/signup-step3';

const SOCIAL_ERROR_MESSAGES: Record<string, { title: string; detail: string }> = {
  oauth_denied: {
    title: '로그인이 취소되었습니다.',
    detail: '다시 로그인해주세요.',
  },
  oauth_failed: {
    title: '소셜 로그인에 실패했습니다.',
    detail: '잠시 후 다시 시도해주세요.',
  },
  token_expired: {
    title: '로그인 세션이 만료되었습니다.',
    detail: '다시 로그인해주세요.',
  },
  server_error: {
    title: '일시적인 오류가 발생했습니다.',
    detail: '잠시 후 다시 시도해주세요.',
  },
  account_conflict: {
    title: '이미 다른 계정에 연결된 소셜 계정입니다.',
    detail: '기존 계정으로 로그인해주세요.',
  },
};

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [isProcessing, setIsProcessing] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [registrationToken, setRegistrationToken] = useState('');
  const [currentStep, setCurrentStep] = useState<2 | 3>(2);
  const [step2Data, setStep2Data] = useState<RegisterStep2Input | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{ code: string; provider?: string } | null>(null);

  useEffect(() => {
    const errorCode = searchParams.get('error');
    const provider = searchParams.get('provider');

    if (errorCode) {
      setErrorInfo({ code: errorCode, provider: provider ?? undefined });
      setIsProcessing(false);
      return;
    }

    const regToken = searchParams.get('registrationToken');
    const status = searchParams.get('status');

    if (status === 'authenticated') {
      // Existing user -- exchange refresh token cookie for access token
      void (async () => {
        try {
          const refreshRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/auth/refresh`,
            {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            },
          );

          if (!refreshRes.ok) {
            toast.error('로그인에 실패했습니다.');
            router.push('/auth');
            return;
          }

          const { accessToken } = (await refreshRes.json()) as { accessToken: string };

          const userRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/users/me`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              credentials: 'include',
            },
          );

          if (userRes.ok) {
            const user = await userRes.json();
            setAuth(accessToken, user);
            router.push('/');
          } else {
            toast.error('로그인에 실패했습니다.');
            router.push('/auth');
          }
        } catch {
          toast.error('네트워크 연결을 확인해주세요');
          router.push('/auth');
        }
      })();
    } else if (status === 'needs_registration' && regToken) {
      // New social user -- needs registration completion
      setRegistrationToken(regToken);
      setNeedsRegistration(true);
      setIsProcessing(false);
    } else {
      // Invalid callback
      toast.error('잘못된 접근입니다.');
      router.push('/auth');
    }
  }, [searchParams, setAuth, router]);

  function handleStep2Complete(data: RegisterStep2Input) {
    setStep2Data(data);
    setCurrentStep(3);
  }

  async function handleStep3Complete(data: RegisterStep3Input) {
    if (!step2Data) return;

    setIsSubmitting(true);
    try {
      const payload = {
        registrationToken,
        termsOfService: step2Data.termsOfService,
        privacyPolicy: step2Data.privacyPolicy,
        marketingConsent: step2Data.marketingConsent,
        name: data.name,
        gender: data.gender,
        country: data.country,
        birthDate: `${data.birthYear}-${data.birthMonth}-${data.birthDay}`,
        phone: data.phone,
        phoneVerificationCode: data.phoneVerificationCode,
      };

      const res = await apiClient.post<AuthResponse>(
        '/api/v1/auth/social/complete-registration',
        payload,
      );
      setAuth(res.accessToken, res.user);
      toast.success('회원가입이 완료되었습니다');
      router.push('/');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (errorInfo) {
    const messages = SOCIAL_ERROR_MESSAGES[errorInfo.code] ?? SOCIAL_ERROR_MESSAGES['server_error']!;
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="flex max-w-[400px] flex-col items-center gap-4 px-4">
          <AlertCircle className="h-8 w-8 text-error" />
          <div className="text-center">
            <p className="text-base font-semibold text-gray-900">
              {messages.title}
            </p>
            <p className="mt-2 text-caption text-gray-600">
              {messages.detail}
            </p>
          </div>
          <Button
            size="lg"
            className="mt-2 w-full max-w-[280px]"
            onClick={() => router.push('/auth')}
          >
            다시 로그인하기
          </Button>
        </div>
      </main>
    );
  }

  if (isProcessing) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-base text-gray-500">로그인 처리 중...</p>
        </div>
      </main>
    );
  }

  if (needsRegistration) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] space-y-6">
          <h1 className="text-center text-heading font-semibold text-gray-900">
            추가 정보 입력
          </h1>

          <StepIndicator
            currentStep={currentStep}
            labels={['소셜 로그인', '약관 동의', '추가 정보']}
          />

          <div
            className="transition-transform duration-200 ease-out"
            key={currentStep}
          >
            {currentStep === 2 && (
              <SignupStep2
                onComplete={handleStep2Complete}
                onBack={() => router.push('/auth')}
                defaultValues={step2Data}
              />
            )}
            {currentStep === 3 && (
              <SignupStep3
                onComplete={handleStep3Complete}
                onBack={() => setCurrentStep(2)}
                isSubmitting={isSubmitting}
              />
            )}
          </div>
        </div>
      </main>
    );
  }

  return null;
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
