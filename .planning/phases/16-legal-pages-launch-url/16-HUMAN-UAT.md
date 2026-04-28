---
phase: 16
slug: legal-pages-launch-url
type: human-uat
status: open
related_decisions: [D-05, D-07, D-08, D-11, D-15]
created: 2026-04-28
---

# Phase 16 — HUMAN-UAT 체크리스트

> Cutover D-day 이전·이후 사용자(개발자/운영자)가 직접 수행해야 하는 검증 항목 모음.
> 자동화 가능한 항목은 `automated` 표기 + 실제 명령 인용.

---

## Cutover prereqs (prod 배포 전 모두 ✅ 필요)

### MD placeholder 실값 주입 (D-07)

Plan 04 가 만든 placeholder 자리(`[라벨: 임시값]`)에 사용자가 직접 실값을 채워 넣은 후, 다음 자동 게이트가 0건이어야 prod 배포 가능.

**Automated cutover gate — 빌드 산출물 placeholder leak 차단 (codex HIGH-3 generic bracket regex):**

```bash
rm -rf apps/web/.next
GRABIT_ENV=production pnpm --filter @grabit/web build
! grep -rE '\[[^]\n]+:[^]\n]+\]' apps/web/.next/server/app/legal/
```

위 generic regex 가 매치 0건일 때만 cutover 진행. 본 regex 는 `[사업자명: ...]`, `[대표자명: ...]`, `[사업자등록번호: ...]`, `[통신판매업 신고번호: ...]`, `[주소: ...]`, `[전화번호: ...]`, `[직책: ...]`, `[시행일: ...]`, `[직전 시행일: ...]`, `[보호책임자 실명: ...]` 등 모든 `[라벨: 값]` 형태 placeholder 를 catch. 매치 발생 시 해당 placeholder 가 빌드 산출물에 인라인된 상태이므로 prod 배포 금지.

**Automated focused gates — sign-off 보조 grep:**

```bash
! grep -rE '\[(시행일|사업자등록번호|통신판매업|보호책임자 실명):' apps/web/.next/
! grep -rE '\[(사업자명|대표자명|사업자등록번호|통신판매업|주소|보호책임자 실명):' apps/web/.next/
! grep -rF '[시행일:' apps/web/.next/
! grep -rF '[직전 시행일: 2026년 4월 14일]' apps/web/.next/
```

**참고 — 16-05 plan 의 generic regex gate 는 16-04 placeholder 형태에 의존:** Plan 16-04 가 `[라벨: 임시값]` 형식을 변경하면 16-05 의 generic regex 도 자동 추적 (괄호/콜론 형식 lock). 16-04 변경 시 본 plan 의 acceptance grep 도 같은 방향으로 동작.

**체크 항목:**

- [ ] **UAT-1a:** `apps/web/content/legal/terms-of-service.md` 의 `[사업자명: 000]` → 실제 사업자명 치환
- [ ] **UAT-1b:** `[대표자명: 000]` → 실제 대표자명 치환
- [ ] **UAT-1c:** `[사업자등록번호: 000-00-00000]` → 실제 사업자등록번호 치환 (사업자 등록 완료 후)
- [ ] **UAT-1d:** `[통신판매업 신고번호: 제0000-서울강남-00000호]` → 실제 신고번호 치환 (통신판매업 신고 완료 후)
- [ ] **UAT-1e:** `[주소: 서울특별시 ...]` → 실제 사업장 주소 치환
- [ ] **UAT-1f:** `[전화번호: 02-0000-0000]` → 실제 고객센터 전화번호 치환
- [ ] **UAT-1g:** `apps/web/content/legal/privacy-policy.md` 의 `[보호책임자 실명: 000]` → 실명 치환
- [ ] **UAT-1h:** `[직책: 대표]` → 실 직책 치환 (또는 그대로 유지 가능 — 1인 개발자는 보통 "대표")
- [ ] **UAT-1i:** `[전화번호: 000-0000-0000]` (privacy 내) → 보호책임자 직통 전화번호 치환
- [ ] **UAT-1j:** 자동 gate 통과: `! grep -rE '\[(사업자명|대표자명|사업자등록번호|통신판매업|주소|보호책임자 실명):' apps/web/.next/` 결과 0건

### 시행일 cutover 일자 결정 (D-08)

- [ ] **UAT-2a:** Phase 16 prod 배포 일자 확정 (예: `2026-04-29`)
- [ ] **UAT-2b:** 3개 MD 파일의 `[시행일: YYYY-MM-DD]` 를 동일 일자로 일괄 치환 (terms-of-service.md, privacy-policy.md, marketing-consent.md)
- [ ] **UAT-2c:** privacy-policy.md `### 개정 이력` 표의 v1.1 행 `[시행일: YYYY-MM-DD]` 도 동일 일자로 치환
- [ ] **UAT-2d:** privacy-policy.md `### 개정 이력` 표의 v1.0 행 `[직전 시행일: 2026년 4월 14일]` → 직전 prod 배포 일자(또는 본 cutover 가 최초이면 v1.0 행 삭제)
- [ ] **UAT-2e:** 자동 gate 통과: `! grep -rF '[시행일:' apps/web/.next/` 결과 0건

### Mailbox 수신 검증 (D-15)

`privacy@heygrabit.com` / `support@heygrabit.com` 두 alias 가 실제 수신 가능해야 prod 배포 가능. DNS MX/alias 설정은 quick-task (Phase 16 외) 책임.

- [ ] **UAT-3:** mailbox 수신 검증 — 외부 메일(개인 gmail 등)에서 `support@heygrabit.com` 으로 송신 → 운영자 inbox 도착 확인
- [ ] **UAT-4:** mailbox 수신 검증 — 외부 메일에서 `privacy@heygrabit.com` 으로 송신 → 운영자 inbox 도착 확인

---

## Post-deploy UAT (prod 배포 후 1시간 이내 검증)

### 공개 URL 응답 (D-12)

- [ ] **UAT-5:** `curl -sI https://heygrabit.com/legal/terms` → HTTP/2 200, `curl https://heygrabit.com/legal/terms | grep -c '이용약관'` ≥ 1
- [ ] **UAT-6:** `curl -sI https://heygrabit.com/legal/privacy` → HTTP/2 200, 본문에 `개인정보처리방침` 포함
- [ ] **UAT-7:** `curl -sI https://heygrabit.com/legal/marketing` → HTTP/2 200, 본문에 `마케팅 수신 동의` 포함

### Footer 골든 패스 (D-03)

- [ ] **UAT-8:** prod 임의 페이지에서 Footer "이용약관" 클릭 → `/legal/terms` 이동 + H1 + 본문 노출
- [ ] **UAT-9:** Footer "개인정보처리방침" 클릭 → `/legal/privacy` 이동 (font-semibold 강조 시각 확인)
- [ ] **UAT-10:** Footer "고객센터" 클릭 → OS 기본 메일 클라이언트가 `support@heygrabit.com` prefilled 새 메일 창 표시

### signup-step2 dialog 시각 회귀 (D-05, D-11)

- [ ] **UAT-11:** prod `/auth/signup` step 2 진입 → "이용약관 보기" 버튼 클릭 → dialog 본문 정상 렌더 + LegalDraftBanner 노란 배너 부재 + DialogTitle 1건만 노출 (H1 중복 0건)
- [ ] **UAT-12:** signup-step2 의 동의 체크박스 (3개 약관 + 전체 동의) + 이전/다음 버튼 동작 정상 — D-11 회귀 없음

### Post-launch (배포 후 1주일 이내, 선택)

- [ ] **UAT-13:** Google Search Console 에서 3개 URL 색인 요청 (D-12 — 즉시 효과는 아님)

---

## Verification Sign-Off

- [ ] All cutover prereqs UAT-1~UAT-4 완료
- [ ] Automated grep gate 4건 모두 0 매치 (placeholder leak 0건)
- [ ] Post-deploy UAT-5~UAT-12 완료
- [ ] Phase 16 prod cutover commit/PR 머지

**Cutover Approval:** pending
