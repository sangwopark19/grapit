/**
 * W-2: SVG의 <defs> 내부 ID와 url(#...) 참조에 접두사를 부여하여
 * 같은 페이지 내 두 SVG 인스턴스(메인 좌석맵 + MiniMap) 간 ID 충돌을 방지.
 *
 * - admin이 업로드한 SVG가 <defs>를 사용하는 경우 외부 호환성 확보
 * - DOMParser 기반 — 정규식 회피 (RESEARCH §Pitfall 8)
 * - parse 실패 시 graceful — 원본 string 반환
 *
 * ## Coverage 제한 (reviews revision 2026-04-21 LOW #6 + 12-REVIEW IN-04)
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
 * **Serialize + regex 치환의 알려진 한계 (12-REVIEW IN-04):**
 * 아래 구현은 DOM을 파싱한 뒤 `XMLSerializer`로 전체 문자열을 만들어 `url(#oldId)` 토큰을 regex로
 * 일괄 치환한다. 이 방식은 다음과 같은 false-positive 리스크를 수반한다:
 * - `<text>url(#grad1)</text>` 같은 **text node**의 리터럴 문자열도 치환된다.
 * - `<![CDATA[... url(#grad1) ...]]>` **CDATA 섹션** 내의 리터럴도 치환된다.
 * - `<!-- url(#grad1) -->` **주석** 안의 리터럴도 치환된다.
 * - `<use href="#id">` / `<use xlink:href="#id">` 등 href 기반 참조는 **치환되지 않음** (위 "현재 미커버"와
 *   같은 제약). 즉 `<use>`를 쓰는 SVG는 MiniMap에서 원본 `<defs>` ID를 계속 참조하게 되어 충돌 가능.
 *
 * **Why MVP 수용:** 현재 `sample-seat-map.svg` 및 어드민 업로드 테스트 SVG 모두 `<use>`/`href` 참조,
 * text/CDATA/주석 내 `url(#...)` 리터럴을 사용하지 않음. `<defs>` + `url(#id)` 조합만 사용되는 단순
 * 좌석맵에는 충분하다. 향후 admin SVG 다양성이 커질 경우(특히 `<use>` 도입 또는 text에 `url(...)` 리터럴
 * 포함), serialize+regex 방식을 **DOM 기반 치환**(`fill`/`stroke` 속성, `style` 속성의 `url(...)`, `<use>`의
 * `href`/`xlink:href` 속성을 직접 set)으로 전환할 것을 권장한다. 이 리팩터는 별도 phase에서 다룬다.
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
