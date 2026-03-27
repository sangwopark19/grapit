'use client';

import * as React from 'react';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Provider = 'kakao' | 'naver' | 'google';

interface SocialLoginButtonProps {
  provider: Provider;
  onClick: () => void;
  isLoading?: boolean;
  className?: string;
}

const PROVIDER_CONFIG: Record<
  Provider,
  {
    label: string;
    bgColor: string;
    textColor: string;
    borderClass: string;
    icon: string;
  }
> = {
  kakao: {
    label: '카카오로 시작하기',
    bgColor: '#FEE500',
    textColor: '#191919',
    borderClass: '',
    icon: '/icons/kakao.svg',
  },
  naver: {
    label: '네이버로 시작하기',
    bgColor: '#03C75A',
    textColor: '#FFFFFF',
    borderClass: '',
    icon: '/icons/naver.svg',
  },
  google: {
    label: 'Google로 시작하기',
    bgColor: '#FFFFFF',
    textColor: '#1F1F1F',
    borderClass: 'border border-[#DADCE0]',
    icon: '/icons/google.svg',
  },
};

export function SocialLoginButton({
  provider,
  onClick,
  isLoading = false,
  className,
}: SocialLoginButtonProps) {
  const config = PROVIDER_CONFIG[provider];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        'relative flex h-12 w-full items-center justify-center gap-3 rounded-lg text-base font-medium transition-opacity disabled:opacity-60',
        config.borderClass,
        className
      )}
      style={{
        backgroundColor: config.bgColor,
        color: config.textColor,
      }}
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <Image
            src={config.icon}
            alt={`${provider} logo`}
            width={20}
            height={20}
            className="h-5 w-5"
          />
          <span>{config.label}</span>
        </>
      )}
    </button>
  );
}
