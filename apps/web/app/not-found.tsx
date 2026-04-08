import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-4">
      <p className="text-[48px] text-gray-400 mb-6">( ._.)</p>
      <h1 className="text-heading font-semibold text-gray-900">
        페이지를 찾을 수 없습니다
      </h1>
      <p className="text-base text-gray-500 mb-6">
        요청하신 페이지가 존재하지 않거나 이동되었습니다.
      </p>
      <Button asChild>
        <Link href="/">홈으로 돌아가기</Link>
      </Button>
    </main>
  );
}
