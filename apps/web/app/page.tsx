import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4">
      {/* Brand logo */}
      <span className="text-4xl font-bold text-primary">Grapit</span>

      {/* Heading - 24px gap from logo */}
      <h1 className="mt-6 text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-gray-900">
        곧 다양한 공연이 찾아옵니다
      </h1>

      {/* Description - 12px gap from heading */}
      <p className="mt-3 text-center text-base leading-relaxed text-gray-500">
        지금 가입하고 가장 먼저
        <br />
        새로운 공연 소식을 만나보세요
      </p>

      {/* CTA - 32px gap from description */}
      <Button asChild size="lg" className="mt-8 h-12 w-[200px]">
        <Link href="/auth">로그인 / 회원가입</Link>
      </Button>
    </main>
  );
}
