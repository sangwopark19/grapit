'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/use-auth-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LoginForm } from '@/components/auth/login-form';
import { SignupForm } from '@/components/auth/signup-form';

export default function AuthPage() {
  const router = useRouter();
  const { isInitialized, accessToken } = useAuthStore();

  // Redirect if already authenticated
  useEffect(() => {
    if (isInitialized && accessToken) {
      router.push('/');
    }
  }, [isInitialized, accessToken, router]);

  if (isInitialized && accessToken) {
    return null;
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">
        <Tabs defaultValue="login" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="login">로그인</TabsTrigger>
            <TabsTrigger value="signup">회원가입</TabsTrigger>
          </TabsList>
          <TabsContent
            value="login"
            className="animate-in fade-in duration-150 ease-in-out"
          >
            <LoginForm />
          </TabsContent>
          <TabsContent
            value="signup"
            className="animate-in fade-in duration-150 ease-in-out"
          >
            <SignupForm />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
