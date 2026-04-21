/**
 * W-2: SVG의 <defs> 내부 ID와 url(#...) 참조에 접두사를 부여하여
 * 같은 페이지 내 두 SVG 인스턴스(메인 좌석맵 + MiniMap) 간 ID 충돌을 방지.
 *
 * - admin이 업로드한 SVG가 <defs>를 사용하는 경우 외부 호환성 확보
 * - DOMParser 기반 — 정규식 회피 (RESEARCH §Pitfall 8)
 * - parse 실패 시 graceful — 원본 string 반환
 *
 * ## Coverage 제한 (reviews revision 2026-04-21 LOW #6)
 *
 * **현재 커버 (MVP 범위):**
 * - `fill="url(#id)"` / `stroke="url(#id)"` — gradient/pattern 참조
 * - CSS-style url("#id") / url('#id') — 사용 빈도는 낮지만 escape-safe
 *
 * **현재 미커버 (MVP out of scope):**
 * - `<use href="#id">` — SVG 2.0 표준 href
 * - `<use xlink:href="#id">` — 레거시 xlink 네임스페이스
 * - `<textPath href="#id">`, `<mpath href="#id">` 등 path reference
 *
 * **Why MVP 수용:** 현재 `sample-seat-map.svg` 및 어드민 업로드 테스트 SVG 모두 `<use>`/`href` 참조를 사용하지 않음.
 * `<defs>` + `url(#id)` 조합만 사용되는 단순 좌석맵에는 충분하다. 향후 `<use>`를 사용하는 SVG가 도입되면
 * 이 헬퍼의 정규식을 `(url\(#id\)|href="#id"|xlink:href="#id")` 식으로 확장해야 한다.
 *
 * @param svgString - SVG outerHTML string
 * @param prefix - ID에 부여할 접두사 (e.g., 'mini-')
 * @returns prefix가 부여된 SVG outerHTML string. <defs> 없거나 ID 없으면 원본 그대로.
 *
 * @see .planning/phases/12-ux/12-REVIEWS.md §"Action Items" LOW #6
 */
export function prefixSvgDefsIds(svgString: string, prefix: string): string {
  if (!svgString.includes('<defs')) return svgString;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');
    if (doc.documentElement.tagName === 'parsererror') return svgString;
    const defs = doc.querySelector('defs');
    if (!defs) return svgString;
    const idMap = new Map<string, string>();
    Array.from(defs.querySelectorAll('[id]')).forEach((el) => {
      const oldId = el.getAttribute('id');
      if (!oldId) return;
      const newId = `${prefix}${oldId}`;
      el.setAttribute('id', newId);
      idMap.set(oldId, newId);
    });
    if (idMap.size === 0) return svgString;
    let serialized = new XMLSerializer().serializeToString(doc);
    // url(#oldId) → url(#prefix-oldId) 일괄 치환 (정규식 메타문자 escape)
    idMap.forEach((newId, oldId) => {
      const escaped = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      serialized = serialized.replace(
        new RegExp(`url\\(#${escaped}\\)`, 'g'),
        `url(#${newId})`,
      );
    });
    return serialized;
  } catch {
    return svgString;
  }
}
