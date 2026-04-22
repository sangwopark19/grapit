import Link from 'next/link';

export function Footer() {
  return (
    <footer className="mt-auto min-h-[120px] bg-gray-100">
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        {/* Legal links */}
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-900">
          <Link href="#" className="hover:underline">
            이용약관
          </Link>
          <span className="text-gray-400">|</span>
          <Link href="#" className="font-semibold hover:underline">
            개인정보처리방침
          </Link>
          <span className="text-gray-400">|</span>
          <Link href="#" className="hover:underline">
            고객센터
          </Link>
        </div>

        {/* Copyright */}
        <p className="mt-4 text-sm text-gray-500">
          &copy; 2026 Grabit. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
