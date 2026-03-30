'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import {
  resetPasswordRequestSchema,
  type ResetPasswordRequestInput,
} from '@grapit/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';

export default function ResetPasswordPage() {
  const [isSent, setIsSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<ResetPasswordRequestInput>({
    resolver: zodResolver(resetPasswordRequestSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  async function onSubmit(data: ResetPasswordRequestInput) {
    setIsLoading(true);
    try {
      await apiClient.post('/api/v1/auth/password-reset/request', data);
    } catch {
      // Always show success to prevent email enumeration
    } finally {
      setSentEmail(data.email);
      setIsSent(true);
      setIsLoading(false);
    }
  }

  if (isSent) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] space-y-6">
          <div className="space-y-3">
            <h1 className="text-heading font-semibold text-gray-900">
              비밀번호 재설정 메일 발송 완료
            </h1>
            <p className="text-base text-gray-700">
              {sentEmail}로 비밀번호 재설정 링크를 발송했습니다. 메일함을 확인해주세요.
            </p>
          </div>

          <Button asChild size="lg" className="w-full">
            <Link href="/auth">로그인으로 돌아가기</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px] space-y-6">
        <div className="space-y-3">
          <h1 className="text-heading font-semibold text-gray-900">비밀번호 찾기</h1>
          <p className="text-base text-gray-700">
            가입 시 사용한 이메일을 입력하세요
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이메일</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="이메일을 입력해주세요"
                      autoComplete="email"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  발송 중...
                </>
              ) : (
                '비밀번호 재설정 링크 발송'
              )}
            </Button>
          </form>
        </Form>

        <div className="text-center">
          <Link
            href="/auth"
            className="text-caption text-gray-500 hover:text-primary"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}
