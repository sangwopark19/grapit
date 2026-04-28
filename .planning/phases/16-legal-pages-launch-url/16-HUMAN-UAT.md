---
phase: 16
slug: legal-pages-launch-url
type: human-uat
status: open
related_decisions: [D-05, D-07, D-08, D-11, D-15]
created: 2026-04-28
updated: 2026-04-28
---

# Phase 16 — HUMAN-UAT 체크리스트

> Cutover D-day 이전·이후 사용자(개발자/운영자)가 직접 수행해야 하는 검증 항목 모음.
> 자동화 가능한 항목은 `automated` 표기 + 실제 명령 인용.

---

## Cutover prereqs (prod 배포 전 모두 완료 필요)

### Legal factual sign-off (D-06, D-07, D-08)

HEAD의 legal markdown에는 placeholder가 제거되고 아래 값이 반영되어 있다. Codex는 사업자등록증, 통신판매업 신고증, Infobip 계약서/콘솔, mailbox 소유권을 외부에서 직접 검증할 수 없으므로, 사용자가 각 항목을 실제 증빙과 대조해 승인해야 prod 배포 가능하다.

| 항목 | 현재 markdown 값 | 확인 증빙 | 상태 |
|------|------------------|-----------|------|
| 사업자명 | `(주)아이콘스` | 사업자등록증 | pending operator sign-off |
| 대표자명 | `정승준` | 사업자등록증 | pending operator sign-off |
| 사업자등록번호 | `109-86-27576` | 사업자등록증 | pending operator sign-off |
| 통신판매업 신고번호 | `2025-서울마포-1494` | 통신판매업 신고증 | pending operator sign-off |
| 사업장 주소 | `서울특별시 마포구 월드컵로8길 69` | 사업자등록증/통신판매업 신고증 | pending operator sign-off |
| 고객센터 전화번호 | `02-325-179` | 운영 전화 수신 가능 여부 | pending operator sign-off |
| 개인정보 보호책임자 | `정승준` | 내부 지정/대표자 확인 | pending operator sign-off |
| 개인정보 보호책임자 직책 | `대표` | 내부 지정/대표자 확인 | pending operator sign-off |
| 개인정보 보호책임자 전화번호 | `02-325-179` | 운영 전화 수신 가능 여부 | pending operator sign-off |
| SMS 수탁자 | `Infobip Limited 및 그 계열사` | Infobip 계약/콘솔/개인정보 국외이전 고지 검토 | pending operator sign-off |
| SMS 이전 국가 | `독일 (Germany)` | Infobip 계약/콘솔/법무 검토 | pending operator sign-off |
| SMS 보유·이용 기간 | `발송일로부터 3개월` | Infobip 계약/설정/법무 검토 | pending operator sign-off |
| 시행일 | `2026-04-28` | prod cutover 일자 | pending operator sign-off |

**Automated source gates — legal markdown placeholder leak 차단:**

```bash
! rg -n '\[(시행일|사업자명|대표자명|사업자등록번호|통신판매업 신고번호|주소|전화번호|보호책임자 실명|직책|직전 시행일):' apps/web/content/legal/*.md
! rg -n '000-00-00000|0000-서울|000-0000-0000|YYYY-MM-DD|Twilio' apps/web/content/legal/*.md
pnpm --filter @grabit/web exec vitest run content/legal/__tests__/legal-content.test.ts --reporter=verbose
```

**Automated build gates — HTML 산출물 기준 placeholder leak 차단:**

```bash
rm -rf apps/web/.next
GRABIT_ENV=production pnpm --filter @grabit/web build
! rg -n '\[(시행일|사업자명|대표자명|사업자등록번호|통신판매업 신고번호|주소|전화번호|보호책임자 실명|직책|직전 시행일):' apps/web/.next/server/app/legal -g '*.html'
! rg -n '000-00-00000|0000-서울|000-0000-0000|YYYY-MM-DD|Twilio' apps/web/.next/server/app/legal -g '*.html'
```

`apps/web/.next/server/app/legal/` 전체에 generic `\[[^\]\n]+:[^\]\n]+\]` regex를 적용하지 않는다. Next 16 RSC segment 파일(`*.rsc`)은 React/Next serialization 배열과 JSON-like payload를 포함하므로 실제 placeholder가 없어도 false positive가 발생한다. Cutover gate는 source markdown과 prerendered `*.html` 산출물에 focused placeholder label regex를 적용한다.

**체크 항목:**

- [ ] **UAT-1a:** 사업자명/대표자명/사업자등록번호/통신판매업 신고번호/주소를 실제 증빙과 대조 완료
- [ ] **UAT-1b:** 고객센터 전화번호와 `support@heygrabit.com` 운영 가능 여부 확인
- [ ] **UAT-1c:** 개인정보 보호책임자 실명/직책/전화번호를 실제 운영 책임자와 대조 완료
- [ ] **UAT-1d:** Infobip 수탁자명/이전 국가/보유·이용 기간을 계약 또는 콘솔 설정과 대조 완료
- [ ] **UAT-1e:** source markdown placeholder/Twilio gate 통과
- [ ] **UAT-1f:** production build HTML placeholder/Twilio gate 통과

### 시행일 cutover 일자 확인 (D-08)

- [ ] **UAT-2a:** Phase 16 prod 배포 일자가 `2026-04-28`인지 확인. 다른 일자에 배포하면 3개 MD와 `legal-content.test.ts`의 expected date를 함께 갱신
- [ ] **UAT-2b:** `terms-of-service.md`, `privacy-policy.md`, `marketing-consent.md`의 시행일이 동일한지 확인
- [ ] **UAT-2c:** `privacy-policy.md` 개정 이력 표의 v1.1 시행일도 동일한지 확인
- [ ] **UAT-2d:** v1.0 행의 `2026년 4월 14일`이 실제 직전 시행일인지 확인. 최초 prod 배포면 v1.0 행 삭제 여부 결정

### Mailbox 수신 검증 (D-15)

`privacy@heygrabit.com` / `support@heygrabit.com` 두 alias가 실제 수신 가능해야 prod 배포 가능. DNS MX/alias 설정은 quick-task 또는 운영 작업 책임.

- [ ] **UAT-3:** mailbox 수신 검증 — 외부 메일(개인 gmail 등)에서 `support@heygrabit.com`으로 송신 → 운영자 inbox 도착 확인
- [ ] **UAT-4:** mailbox 수신 검증 — 외부 메일에서 `privacy@heygrabit.com`으로 송신 → 운영자 inbox 도착 확인

---

## Post-deploy UAT (prod 배포 후 1시간 이내 검증)

### 공개 URL 응답 (D-12)

- [ ] **UAT-5:** status: `curl -fsSI https://heygrabit.com/legal/terms | head -1` → HTTP 200 계열, body: `curl -fsS https://heygrabit.com/legal/terms | grep -F '이용약관'`
- [ ] **UAT-6:** status: `curl -fsSI https://heygrabit.com/legal/privacy | head -1` → HTTP 200 계열, body: `curl -fsS https://heygrabit.com/legal/privacy | grep -F '개인정보처리방침'`
- [ ] **UAT-7:** status: `curl -fsSI https://heygrabit.com/legal/marketing | head -1` → HTTP 200 계열, body: `curl -fsS https://heygrabit.com/legal/marketing | grep -F '마케팅 수신 동의'`
- [ ] **UAT-7b:** live placeholder gate: `! curl -fsS https://heygrabit.com/legal/terms https://heygrabit.com/legal/privacy https://heygrabit.com/legal/marketing | rg '\[(시행일|사업자명|대표자명|사업자등록번호|통신판매업 신고번호|주소|전화번호|보호책임자 실명|직책|직전 시행일):|Twilio|YYYY-MM-DD|000-00-00000|0000-서울|000-0000-0000'`

### Footer 골든 패스 (D-03)

- [ ] **UAT-8:** prod 임의 페이지에서 Footer "이용약관" 클릭 → `/legal/terms` 이동 + H1 + 본문 노출
- [ ] **UAT-9:** Footer "개인정보처리방침" 클릭 → `/legal/privacy` 이동 (font-semibold 강조 시각 확인)
- [ ] **UAT-10:** Footer "고객센터" 클릭 → OS 기본 메일 클라이언트가 `support@heygrabit.com` prefilled 새 메일 창 표시

### signup-step2 dialog 시각 회귀 (D-05, D-11)

- [ ] **UAT-11:** prod `/auth/signup` step 2 진입 → "이용약관 보기" 버튼 클릭 → dialog 본문 정상 렌더 + LegalDraftBanner 노란 배너 부재 + DialogTitle 1건만 노출 (H1 중복 0건)
- [ ] **UAT-12:** signup-step2의 동의 체크박스(3개 약관 + 전체 동의) + 이전/다음 버튼 동작 정상 — D-11 회귀 없음

### Post-launch (배포 후 1주일 이내, 선택)

- [ ] **UAT-13:** Google Search Console에서 3개 URL 색인 요청 (D-12 — 즉시 효과는 아님)

---

## Verification Sign-Off

- [ ] Legal factual sign-off UAT-1a~UAT-1d 완료
- [ ] Automated source/build gates UAT-1e~UAT-1f 통과
- [ ] Mailbox prereqs UAT-3~UAT-4 완료
- [ ] Post-deploy UAT-5~UAT-12 완료
- [ ] Phase 16 prod cutover commit/PR 머지

**Cutover Approval:** pending external legal/operator sign-off
