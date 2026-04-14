/**
 * Format a date string to `YYYY.MM.DD HH:mm` (local time).
 * Returns em dash `—` (U+2014) when input is null, undefined, or invalid.
 *
 * Phase 9 DEBT-04: nullable-safe signature introduced to remove ternary callers.
 * See .planning/phases/09-tech-debt/09-UI-SPEC.md §DEBT-04 empty state.
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (dateString === null || dateString === undefined) {
    return '—';
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}.${m}.${d} ${h}:${min}`;
}
