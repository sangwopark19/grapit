'use client';

import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * TermsMarkdown
 * Phase 9 DEBT-02: 법률 MD 원문을 Dialog 안에서 prose-like 스타일로 렌더.
 * `h1` 은 null 처리 (DialogTitle이 이미 제목 역할).
 *
 * UI-SPEC §Typography L75-87 타이포 매핑 적용.
 */
const components: Components = {
  h1: () => null,
  h2: (props) => (
    <h2 className="mt-6 text-base font-semibold text-gray-900 first:mt-0" {...props} />
  ),
  h3: (props) => (
    <h3 className="mt-4 text-caption font-semibold text-gray-800" {...props} />
  ),
  p: (props) => (
    <p className="mt-2 text-caption leading-relaxed text-gray-700" {...props} />
  ),
  ul: (props) => (
    <ul className="mt-2 ml-5 list-disc text-caption leading-relaxed text-gray-700" {...props} />
  ),
  ol: (props) => (
    <ol className="mt-2 ml-5 list-decimal text-caption leading-relaxed text-gray-700" {...props} />
  ),
  li: (props) => <li className="mt-1" {...props} />,
  strong: (props) => <strong className="font-semibold text-gray-900" {...props} />,
  a: (props) => (
    <a
      className="text-primary underline hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  hr: () => <hr className="my-4 border-gray-200" />,
};

export function TermsMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
      {children}
    </ReactMarkdown>
  );
}
