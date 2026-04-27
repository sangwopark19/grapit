# Phase 16: Legal pages launch — 이용약관/개인정보처리방침/마케팅동의 공개 URL 구현 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 16-legal-pages-launch-url
**Areas discussed:** URL 구조 + Footer 링크, Draft 배너 + 콘텐츠 상태, 렌더링 방식 + Dialog 재사용, SEO + Mailbox 사전조건

---

## URL 구조

### Q1: 3개 법적 문서의 공개 URL 경로는 어떻게 할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| /legal/{terms,privacy,marketing} 만 | 단일 그룹으로 관리 단순·확장성. Footer 도 이 경로로 직접 링크. /terms 같은 알리아스 없음. | ✓ |
| /{terms,privacy,marketing} 짧은 별칭만 | 국내 티켓/커머스 사이트에서 흔한 짧은 경로. 단, 추후 cookies 등 추가 시 넘세가 흐러지고 그룹 layout 공유 어려움. | |
| /legal/* (canonical) + /{terms,privacy} redirect | /legal/* 을 canonical 로 삼고 짧은 /terms·/privacy 는 next.config redirects 로 308 영구 리다이렉트. 명함·광고·소셜 공유 이력 없으므로 과잉. | |

**User's choice:** /legal/{terms,privacy,marketing} 만 (Recommended)
**Notes:** 추후 /legal/cookies 등 확장 가능성을 고려한 단일 그룹 선택. 단축 별칭이나 redirect 미설정.

### Q2: Footer 의 3번째 링크 "고객센터" (현재 href="#") 는 이번 phase 에서 어떻게 처리할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| mailto:support@heygrabit.com | 약관 안의 채널과 일치성 확보. 테스트 mailbox 끝도단 세팅 필요(사전조건 영역에서 다룸). | ✓ |
| Phase 16 scope 제외 (placeholder 유지) | 고객센터는 FAQ·도움말·채팅 등 설계 필요 → 별도 phase. Phase 16 은 처음 두 링크만 교체 + 고객센터 링크는 아예 제거. | |
| /legal/contact 동일 패턴으로 정적 페이지 추가 | /legal/contact/page.tsx 에 고객센터 정보 정적 렌더링. 광의의 낙을 채우지만 'CS' 설계 없이 고객장도 렌더링만으로 고객센터 대체 착시 가능성. | |

**User's choice:** mailto:support@heygrabit.com (Recommended)
**Notes:** 일관성 우선. 고객센터 정식 페이지는 별도 phase 로 분리. mailbox 실개통은 D-15 quick-task 로 분리.

---

## Draft 배너 + 콘텐츠 상태

### Q1: LegalDraftBanner ("본 약관은 런칭 전 법률 검토를 거쳐 교체될 초안입니다") 는 공개 페이지에서 어떻게 처리할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| 공개 페이지에서 제거 | 런칭되는 법적 문서에 'draft' 배너는 신뢰도 떨어뜨리고 PG 심사 리스크. LegalDraftBanner 컴포넌트는 소멸. | ✓ |
| ENV 플래그로 조건부 노출 | NEXT_PUBLIC_LEGAL_DRAFT 일 때만 배너. prod 는 false 로 기본 숨김, staging 은 true. env 관리 리스크 추가. | |
| 유지 (법무 검토 완료 전까지 명시) | 법무 검토를 아직 받지 않은 상태에서 투명성 차원. PG 심사·단속 리스크 감수. | |

**User's choice:** 공개 페이지에서 제거 (Recommended)
**Notes:** 컴포넌트 자체를 삭제하고 dialog 사용처(signup-step2)에서도 함께 제거. 런칭 시 법무 검토 완료 가정.

### Q2: 런칭 직전 법정 필수 기재 사항 (시행일·사업자 식별정보·개정 이력) 보강은 이번 phase 에 포함할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| 이번 phase 에서 보강 | 시행일, 개인사업자 대표자명, 사업자등록번호, 통신판매업신고번호, 주소, 개인정보 보호책임자 연락처를 MD 최하단에 추가. 런칭 당일 사업자등록/통판신고 번호는 사용자가 실값을 주입해야 함 (Plan 에서 TODO 표시). | ✓ |
| URL 공개만 우선, 콘텐츠 보강은 별도 phase | Phase 16 을 'URL 공개 + Footer 링크 세팅' 만으로 좁힘 축소. 사업자등록/통판신고·시행일 근거·개정이력을 입력하는 사용자 작업은 별도 phase 16.1 로 분리. 런칭 전 PG·도메인 심사 고려시 필수 렌스 재검토. | |
| 시행일만 추가, 사업자 식별정보는 제외 | MD 하단에 '시행일: 2026-04-29' 한 줄만 추가해 KOPICO 일부 권고 충족. 사업자등록번호 등은 뒤에 처리. 절충안이지만 런칭 시점에 정통망법 필수구성 누락 리스크 잔존. | |

**User's choice:** 이번 phase 에서 보강 (Recommended)
**Notes:** placeholder 자리(예: `[사업자등록번호: 000-00-00000]`)를 만들고 사용자가 실값 주입. verification 단계에서 placeholder 매치 검사로 빈 상태 prod 배포 차단.

---

## 렌더링 방식 + Dialog 재사용

### Q1: 공개 페이지의 MD 렌더링 방식은? (TermsMarkdown 은 현재 'use client' + h1 숨김 설계 — Dialog 전용)

| Option | Description | Selected |
|--------|-------------|----------|
| TermsMarkdown 확장 | TermsMarkdown 에 showH1 prop 추가 (기본 false 로 하위 호환). 공개 페이지는 showH1=true. SSG 는 page.tsx 자체가 서버 컴포넌트로 동작하니 prerender 확보. | ✓ |
| 독립적인 server component 신규 제작 | PublicLegalDocument.tsx (server component) 를 새로 만들고 react-markdown 을 서버에서 직접 호출. TermsMarkdown(client/dialog) 은 그대로 둠. 컴포넌트 2세트 유지 비용 추가. | |
| page.tsx 를 'use client' 로 완전 클라이언트 | 구현 가장 간단 (TermsMarkdown 그대로 재사용). 단 SSR/SSG 를 포기하면 SEO 셋업 키워드/수익이 떨어지고 렌더링이 완전 클라이언트 수화 후 떨릴 수 있음 — 법적 문서의 크롤러 접근성 저하. | |

**User's choice:** TermsMarkdown 확장 (Recommended)
**Notes:** 'use client' 유지하되 showH1 prop 추가. 공개 페이지의 page.tsx 는 server component + force-static 으로 SSG.

### Q2: signup-step2 / booking confirm 다이얼로그가 현재 같은 MD 를 보여주는데, 공개 URL 이 생긴 뒤 dialog 는 어떻게 할까요?

| Option | Description | Selected |
|--------|-------------|----------|
| Dialog 그대로 유지 | 동의 UX 회귀 위험 최소화. 가입·예매 흐름에서 텍스트 전채를 모달에서 확인 가능한 UX 은 그대로. 공개 URL 은 'Footer / 다이얼로그 하단 외부 링크' 로 추가 제공. LegalDraftBanner 는 공가·dialog 양쪽 모두 제거 (B1 결정). | ✓ |
| Dialog 를 한 바퀴·링크로 단순화 | Dialog 제거 + '이용약관 전문 보기 (새 탭)' 링크로 대체. signup-step2 / booking confirm 의 동의 체크박스 소스 고친다. 단일소스 원칙 강화 장점 있으나, 동의 흐름 재검증 필요 + Phase 16 일정 증가. | |
| Dialog 내부에 '전체 페이지 보기' 보조 링크 추가 | 다이얼로그는 그대로, 하단에 'iframe 이 불편하시면 새 탭에서 전체 보기' 링크 추가. UX 타협·아틀락 가능성 있음 (대부분 사용자에게는 노이즈). | |

**User's choice:** Dialog 그대로 유지 (Recommended)
**Notes:** 회원가입 동의 UX 회귀 위험 최소화. Dialog 본문에서 LegalDraftBanner 만 제거(D-05). 공개 URL 은 Footer 로 노출.

---

## SEO + Mailbox 사전조건

### Q1: 공개 되는 3개 법적 페이지의 검색 색인(SEO) 정책은?

| Option | Description | Selected |
|--------|-------------|----------|
| Index 허용 | metadata 에 title/description 만 설정, noindex 없음. PG·도메인 verification·브랜드 검색 노출 이점. 일반 국내 서비스 관행·접근성 권고와 일치. | ✓ |
| Noindex (검색 제외) | robots meta noindex,follow. 약관·처리방침 자체가 검색 결과로 경쟁하는 것을 원치 않을 때. 타 사이트 대비 차별점 없음. | |
| Index + JSON-LD WebPage 스키마 추가 | Index 에 추가로 structured data. 시행일·명칭·속성 메타를 JSON-LD 로 제공. 구글 SERP 풍부화·클릭률에 소폭 도움. 구현 복잡도 재워짐·관리 이슈 파생. | |

**User's choice:** Index 허용 (Recommended)
**Notes:** Metadata title/description/canonical 만 설정. JSON-LD 는 본 phase 에 미포함 (deferred).

### Q2: privacy@heygrabit.com / support@heygrabit.com mailbox 실개통(수신 가능)은 Phase 16 에서 어떻게 다룰까요?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 16 hard prereq, 별도 quick task | DNS MX/alias 설정·메일 호스팅·테스트 수신은 코드 없는 운영 작업이므로 quick 태스크로 분리. Phase 16 plan 의 명시적 prerequisite 으로 기재하고, mailbox 머저 런칭 앞 완료 필수. 코드 장애·운영 장애 분리로 너장·롤백 독립성 확보. | ✓ |
| Phase 16 내 plan 으로 포함 | Phase 16 이 "코드 + DNS/메일 운영 셋업 + 수동 수신 검증" 을 한 번에 책임. 한 곳에서 트래킹하기는 편하나 phase 명시 원칙에 없는 운영 작업 포함, plan 결정·검증·커밋이 분산되고 D-day 소요 증가. | |
| Mailbox 미개통 상태 수용 | MD 에 메일 주소는 남겨두고 mailbox 개통은 후속. 개인정보처리방침은 연락처·보호책임자 연락이 수신 불가하면 법적 실서 리스크. | |

**User's choice:** Phase 16 hard prereq, 별도 quick task (Recommended)
**Notes:** Phase 16 plan 에 prerequisite 으로 명시. HUMAN-UAT 에 "mailbox 수신 검증 완료" 체크 항목으로 cutover 게이트 역할.

---

## Claude's Discretion

- 각 page.tsx 의 본문 위 breadcrumb/뒤로가기 UI 는 디자인 통일성 차원에서 Plan/UI-SPEC 단계에서 결정.
- `apps/web/app/legal/layout.tsx` 의 max-width/타이포는 globals.css 토큰 재사용. 새 토큰 도입 금지.
- "공개 URL 등록 후 LegalDraftBanner 컴포넌트·signup-step2 import 정리" 단일 commit vs 분리 — plan-phase 가 결정.
- 마케팅 수신 동의 페이지(32라인)는 별도 분리 섹션 없음 (단일 페이지로 충분).

## Deferred Ideas

- 쿠키 동의 배너 (GDPR/eprivacy) — 별도 phase
- 회원 약관 동의 이력 DB 저장 (legal_consents 테이블 + 버전관리) — 별도 phase
- 약관 변경 시 회원 재동의 알림 시스템 — 별도 phase
- /legal/contact (FAQ/CS 페이지) — 별도 phase
- JSON-LD WebPage 스키마 — SEO 개선 phase 로 이관
- 마이페이지 마케팅 수신 동의 철회 UI — 별도 phase
- TOC (목차) 자동 생성 — 콘텐츠 길어지면 별도 phase
- 이용약관 PDF 다운로드 — 별도 phase
