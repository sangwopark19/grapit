import { AlertTriangle } from 'lucide-react';

/**
 * LegalDraftBanner
 * Phase 9 DEBT-02: 법률 검토 완료 전 초안임을 안내하는 배너.
 * 런칭 후 법률 검토 완료 시 이 컴포넌트를 제거하거나 `IS_DRAFT` 플래그로 노출 제어.
 *
 * UI-SPEC §Color L107-125, §Accessibility L291-297 준수.
 * W5: foreground `#8B6306` on `bg-warning-surface` (#FFFBEB) WCAG AA contrast ≈ 7.47:1 (PASS).
 *     globals.css에 `text-warning-foreground` 전용 토큰이 없어 하드코딩된 dark ocher 유지.
 */
export function LegalDraftBanner() {
  return (
    <div
      role="note"
      aria-label="초안 안내"
      className="mb-6 flex items-start gap-2 rounded-md border border-warning/30 border-l-4 border-l-warning bg-warning-surface px-4 py-3"
    >
      <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
      <span className="text-caption text-[#8B6306]">
        본 약관은 런칭 전 법률 검토를 거쳐 교체될 초안입니다.
      </span>
    </div>
  );
}
