---
id: SEED-001
status: dormant
planted: 2026-04-17
planted_during: v1.1 milestone — Phase 10/10.1 (SMS Infobip 전환 UAT)
trigger_when: i18n 프레임워크(next-intl, react-i18next 등) 도입 시점 OR 다국어(중국어/태국어/영어 등) 지원이 milestone/phase 요구사항으로 포함될 때
scope: Medium
related_seed_of: .planning/quick/260417-ghv-ux/260417-ghv-SUMMARY.md
---

# SEED-001: PhoneInput 다국어화 — react-phone-number-input locale dynamic import + UI 문자열 i18n 외부화

## Why This Matters

2026-04-17 Quick Task `260417-ghv-ux`에서 `react-phone-number-input` + shadcn wrapper로 국제 전화번호 입력 UX를 도입했으나, 현재 구현은 **한국어 하드코딩**이다. 해외 사용자(중국·태국·미국 등)가 서비스에 접속했을 때 국가 선택 드롭다운의 국가명과 UI 안내 문자열이 전부 한국어로만 표기되어 해당 언어권 사용자는 본인 국가를 찾기 어렵고 사용 자체가 차단된다.

**MVP 기준으로는 한국 시장 우선이라 충분하지만**, Grapit가 해외 공연/전시 발권으로 확장하거나 외국인 관광객 대상 판매를 하려는 순간 **즉시 블로커**가 된다. 이때 잊지 않고 자동으로 작업 범위에 포함되어야 한다(사용자 명시 요청).

또한 i18n 프레임워크를 도입하면서 PhoneInput만 빠뜨리면 앱 전체는 다국어인데 회원가입 3단계만 한국어로 남는 **어글리한 UX 디스컨티뉴이티**가 발생한다.

## When to Surface

**Trigger:** i18n 프레임워크(next-intl, react-i18next 등) 도입 시점 OR 다국어(중국어/태국어/영어 등) 지원이 milestone/phase 요구사항으로 포함될 때

이 seed는 `/gsd-new-milestone` 실행 시 다음 조건 중 하나라도 매치되면 자동 surface되어야 한다:

- milestone 요구사항에 **i18n / 국제화 / internationalization / 다국어 / 해외 사용자** 키워드 포함
- milestone 요구사항에 **next-intl / react-i18next / i18next / formatjs / lingui** 라이브러리 언급
- milestone 요구사항에 **중국어 / 영어 / 태국어 / 일본어 지원** 등 구체 언어 확장 언급
- PROJECT.md의 target market이 **해외 / global / 아시아 확장**으로 확장될 때
- `.planning/seeds/`를 스캔하는 새 milestone의 scope description에 "language", "locale", "translation" 등 l10n/i18n 계열 용어 등장 시

## Scope Estimate

**Medium** — i18n 프레임워크 선정/도입 자체가 별도 phase 단위 작업이고, PhoneInput 교체는 그 안에서 **하나의 sub-task** (1~2시간)로 수행 가능하다. 다만 언어 감지 전략(URL prefix vs 쿠키 vs navigator.language vs user profile)은 전체 앱에 영향을 주므로 함께 논의되어야 한다.

작업 단위 분해:

1. **i18n 프레임워크 선정** (별도 decision) — next-intl(App Router 친화) vs react-i18next(범용) 비교, 선정 근거 DECISION 기록
2. **언어 감지/라우팅 전략** — URL prefix(`/en/...`, `/ko/...`) / 쿠키 / navigator.language / 사용자 프로필 중 선택
3. **locale resolver 구현** — 현재 언어를 반환하는 hook/context
4. **PhoneInput 교체 (본 seed 핵심)**:
   - `phone-input.tsx:10` 정적 import 제거: `import ko from 'react-phone-number-input/locale/ko.json'` → 동적 로더로 교체
     ```ts
     // 예시 — 실제 구현은 선택한 i18n 프레임워크에 맞춤
     const labels = await import(`react-phone-number-input/locale/${locale}.json`).then(m => m.default)
     ```
   - `phone-input.tsx:44` `labels={ko as Labels}` → `labels={labels}` (prop 또는 hook으로 주입)
   - `phone-input.tsx:116` `placeholder="국가 검색..."` → `t('phoneInput.searchPlaceholder')`
   - `phone-input.tsx:119` `"일치하는 국가가 없습니다."` → `t('phoneInput.noMatch')`
   - `phone-input.tsx:96-100` `aria-label={\`국가 선택: ${...}\`}` → `t('phoneInput.selectCountry', { name })`
   - `phone-input.tsx:99` fallback `'국가 선택'` → `t('phoneInput.selectCountry.empty')`
5. **번역 리소스 작성** — 최소 ko/en 2개, 타겟 시장에 따라 zh/th/ja 추가
6. **phone-verification.tsx 계열 다국어화** — `mapErrorToCopy`의 한국어 에러 메시지, "재발송 (Ns)", "인증번호 받기" 등도 동시 i18n화 (발견 시 scope 내 편승)
7. **테스트 업데이트** — `phone-verification.test.tsx`가 한국어 문자열 assertion(`getByPlaceholder('010-0000-0000')` 외)에 의존하면 locale switcher fixture 추가
8. **E2E** — `signup-sms.spec.ts`가 한국어 UI에 의존하면 기본 locale 명시

**라이브러리가 제공하는 locale 파일** (`react-phone-number-input/locale/*.json`, 2026-04 기준):
- `en.json`, `ko.json`, `zh.json`, `ja.json`, `th.json`, `es.json`, `de.json`, `fr.json`, `it.json`, `pt.json`, `ru.json`, `ar.json`, `vi.json`, `id.json`, `tr.json` 등 공식 제공 (30+ locale)

## Breadcrumbs

현재 코드베이스에서 이 seed와 직접 관련된 파일/결정:

- **`apps/web/components/ui/phone-input.tsx`** — 교체 대상 본체
  - L10: `import ko from 'react-phone-number-input/locale/ko.json'` (정적 import, 하드코딩)
  - L44: `labels={ko as Labels}` (고정)
  - L96–100: `aria-label={\`국가 선택: ${...}\`}` (한국어 하드코딩)
  - L99: `'국가 선택'` (한국어 하드코딩)
  - L116: `placeholder="국가 검색..."` (한국어 하드코딩)
  - L119: `<CommandEmpty>일치하는 국가가 없습니다.</CommandEmpty>` (한국어 하드코딩)
- **`apps/web/components/auth/__tests__/phone-verification.test.tsx`** — 한국어 문자열 assertion 의존 (locale 교체 시 영향 예상)
- **`apps/web/components/auth/phone-verification.tsx`** — 에러 카피 `mapErrorToCopy`, "재발송 (Ns)", "인증번호 받기", "전송 중..." 등 한국어 문자열 다수 — 본 seed의 확장 scope
- **`packages/shared/src/constants/index.ts`** — `SMS_RESEND_COOLDOWN_SECONDS=30` 같은 상수는 locale 독립이므로 영향 없음
- **`apps/web/e2e/signup-sms.spec.ts`** — `getByPlaceholder('010-0000-0000')` 선택자 — placeholder를 locale별로 바꾸면 selector 전략 재검토 필요
- **Quick Task Summary:** `.planning/quick/260417-ghv-ux/260417-ghv-SUMMARY.md` — 2026-04-17 PhoneInput 도입 경위 및 결정사항 전문 기록
- **Quick Task Research:** `.planning/quick/260417-ghv-ux/260417-ghv-RESEARCH.md` — `react-phone-number-input`이 276개국 한글명 `locale/ko.json`을 내장해서 사용했다는 근거, 다른 locale JSON 파일도 같은 방식으로 제공됨

**현재 프로젝트에 i18n 프레임워크 도입되어 있지 않음** (2026-04-17 기준 `grep i18n|next-intl|react-i18next apps/web` = 0 hits).

## Notes

- **사용자 요청 원문(2026-04-17):** "지금 그 추후 작업들 나중에 국제화 페이즈에 안까먹고 자동으로 작업할 수 있도록 기억해둬" — 즉, 다음 milestone/phase에서 이 seed가 **자동으로 surface**되어야 한다는 명시적 요청이다.
- **MVP 스코프 밖:** v1.1 안정화 milestone에서는 한국어 하드코딩 그대로 진행. 이 seed는 **해외 확장 또는 다국어 요구사항이 실제로 생길 때만** 활성화.
- **i18n 도입 시 동반 작업:** PhoneInput 외에도 `phone-verification.tsx`의 `mapErrorToCopy`, 버튼 라벨("재발송", "인증번호 받기", "전송 중..."), 만료 타이머 표기 등도 같은 scope에서 i18n화하는 것이 권장된다 — 그렇지 않으면 국가 선택기만 영어인데 에러 메시지만 한국어인 혼합 UI가 발생.
- **대안 — 미리 prop 외부화:** i18n 도입 전이라도 `PhoneInput`을 `labels` / `searchPlaceholder` / `selectCountryLabel` prop을 외부에서 받도록 리팩터링해두면, 나중에 단순 prop 주입으로 locale 전환 가능한 구조로 선행 준비 가능. 다만 사용자가 "나중에 한꺼번에"를 선호하면 seed 활성 시점으로 미룸.
