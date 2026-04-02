'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { loginSchema, type LoginInput, type AuthResponse } from '@grapit/shared';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { useAuthStore } from '@/stores/use-auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form';
import { PasswordInput } from '@/components/auth/password-input';
import { SocialLoginButton } from '@/components/auth/social-login-button';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function LoginForm() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
    reValidateMode: 'onChange',
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);
    setLoginError(null);

    try {
      const res = await apiClient.post<AuthResponse>('/api/v1/auth/login', data);
      setAuth(res.accessToken, res.user);
      router.push('/');
    } catch (error) {
      if (error instanceof ApiClientError && error.statusCode === 401) {
        setLoginError('이메일 또는 비밀번호가 일치하지 않습니다');
      } else {
        setLoginError('일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  function handleSocialLogin(provider: 'kakao' | 'naver' | 'google') {
    setSocialLoading(provider);
    window.location.href = `${API_URL}/api/v1/auth/social/${provider}`;
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>이메일 <span className="text-error">*</span></FormLabel>
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

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>비밀번호 <span className="text-error">*</span></FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder="비밀번호를 입력해주세요"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {loginError && (
            <p className="text-caption text-error animate-in fade-in duration-150">
              {loginError}
            </p>
          )}

          <div className="pt-2">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  로그인 중...
                </>
              ) : (
                '로그인'
              )}
            </Button>
          </div>
        </form>
      </Form>

      <div className="flex justify-end">
        <Link
          href="/auth/reset-password"
          className="text-caption text-gray-500 hover:text-primary"
        >
          비밀번호 찾기
        </Link>
      </div>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-caption text-gray-400">
          또는
        </span>
      </div>

      <div className="space-y-3">
        <SocialLoginButton
          provider="kakao"
          onClick={() => handleSocialLogin('kakao')}
          isLoading={socialLoading === 'kakao'}
        />
        <SocialLoginButton
          provider="naver"
          onClick={() => handleSocialLogin('naver')}
          isLoading={socialLoading === 'naver'}
        />
        <SocialLoginButton
          provider="google"
          onClick={() => handleSocialLogin('google')}
          isLoading={socialLoading === 'google'}
        />
      </div>
    </div>
  );
}
