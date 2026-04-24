---
status: diagnosed
trigger: "회원가입 SMS OTP: 실제 sms 까지는 옴. 그런데 맞는 인증번호를 입력해도 틀렸다고 나옴."
created: 2026-04-24T02:10:00Z
updated: 2026-04-24T02:35:00Z
---

## Current Focus

hypothesis: "`VERIFY_AND_INCREMENT_LUA` EVAL touches 3 non-hash-tagged keys (`sms:otp:{e164}`, `sms:attempts:{e164}`, `sms:verified:{e164}`) that hash to different slots in Memorystore for Valkey cluster mode → server rejects with `CROSSSLOT Keys in request don't hash to the same slot` → ioredis rejects the eval promise → catch block returns `{ verified: false, message: '인증번호 확인에 실패했습니다...' }` → frontend unconditionally shows '인증번호가 일치하지 않습니다' regardless of the server message."
test: evidence-driven: booking.service.ts hash-tagged same-shape problem on 2026-04-13 (`b382e39`); SMS Lua was authored 4 days later without applying the same pattern; production integration tests use a standalone valkey container that does not enforce CROSSSLOT.
expecting: the fix is to hash-tag all three SMS keys around a common component (e.g. `{sms:${e164}}:otp` / `{sms:${e164}}:attempts` / `{sms:${e164}}:verified`) so all three hash to the same slot. Frontend should additionally honor the server's `message` field so the UX distinguishes "wrong code" from "system error".
next_action: return ROOT CAUSE FOUND (goal: find_root_cause_only). Do not modify code.

## Reasoning Checkpoint

reasoning_checkpoint:
  hypothesis: "Verify path fails with CROSSSLOT from Valkey because VERIFY_AND_INCREMENT_LUA keys lack a common hash tag, and the frontend maps any `{verified: false}` to the WRONG-code copy."
  confirming_evidence:
    - "commit b382e39 (2026-04-13) explicitly documents Google Memorystore for Valkey single-shard CROSSSLOT behavior and fixed the identical multi-key Lua anti-pattern in booking.service.ts by wrapping with {showtimeId} hash tags"
    - "sms.service.ts:55-79 + :358-369 issues EVAL with 3 distinct keys `sms:otp:${e164}`, `sms:attempts:${e164}`, `sms:verified:${e164}` — no common hash tag; CRC16 hashes of these three strings differ, so they land in different Redis Cluster slots"
    - "SMS Phase 10.1 was authored 2026-04-17 (96ad565) — 4 days AFTER the booking CROSSSLOT fix — but the hash-tag pattern was not applied to SMS"
    - "apps/api/test/sms-throttle.integration.spec.ts starts a single-node `valkey/valkey:8` container that is NOT in cluster mode; CROSSSLOT is not enforced there, so tests pass despite the production bug"
    - "frontend phone-verification.tsx:143 hard-codes `setVerifyError('인증번호가 일치하지 않습니다')` whenever `res.verified === false`, ignoring server's `message` field — so CROSSSLOT (which returns `{verified:false, message:'인증번호 확인에 실패했습니다...'}`) surfaces to the user as the wrong-code copy, exactly matching the report `'맞는 인증번호를 입력해도 틀렸다고 나옴'`"
    - "send-code succeeds because sendVerificationCode uses pipeline().set().del() — each command touches only ONE key, so no CROSSSLOT is raised; OTP is stored, SMS is delivered, matching user's `실제 sms 까지는 옴`"
    - "GoneException is re-thrown before the generic catch, so EXPIRED/NO_MORE_ATTEMPTS paths would surface 410 to client; but the CROSSSLOT error is a plain Error (ReplyError), which falls into the generic catch and returns verified:false with a generic message — consistent with seeing the wrong-code UX"
  falsification_test: "Ask ops to tail Cloud Run logs for grabit-api during a reproduction attempt and grep for `sms.verify_failed` log entry with `err:` payload containing `CROSSSLOT Keys in request don't hash to the same slot`. Alternatively, `redis-cli -h <memorystore-ip> -p <port> EVAL <VERIFY_AND_INCREMENT_LUA> 3 sms:otp:X sms:attempts:X sms:verified:X 123456 5 600` against the production Valkey will reproduce the CROSSSLOT error deterministically. If neither shows CROSSSLOT, this hypothesis is wrong and the bug is elsewhere (e.g. two Valkey instances, stale OTP from a prior send, phone normalization mismatch)."
  fix_rationale: "Applying a common hash tag across the 3 SMS keys forces Redis to hash all three to the same slot, which removes the CROSSSLOT error. The pattern mirrors exactly what b382e39 applied to booking — the fix is internal to sms.service.ts with no schema migration (keys have TTL 180s/900s/600s, so any in-flight OTP state drains within 15 minutes of deploy). Additionally, having phone-verification.tsx surface the server-provided `message` on verified:false prevents future CROSSSLOT-shaped system errors from masquerading as a wrong-code UX failure — this is a UX-resilience improvement but not strictly required to fix the reported symptom."
  blind_spots:
    - "Not yet verified live in Cloud Run logs — falsification_test above is the direct confirmation path"
    - "Haven't confirmed that grabit-api in production is connected to the cluster-mode Valkey (vs. a non-cluster instance). But REDIS_URL is a single `redis://HOST:PORT` per provision-valkey.sh comment L26, and Memorystore for Valkey shard-count=1 still runs in cluster mode per b382e39 commit message — consistent with the hypothesis"
    - "Did not inspect whether there is any ioredis `enableOfflineQueue` / `lazyConnect` interaction that could mutate error shape — but the catch block treats any non-GoneException the same, so error shape does not change the user-visible outcome"
    - "Did not check whether Infobip could have reordered SMS delivery such that the user saw an OTP from an earlier send while the Redis stored value was overwritten by a later send — but the 30s resend cooldown + user report of single-attempt entry makes this extremely unlikely"

## Symptoms

expected: POST /api/v1/sms/verify-code with correct OTP returns `{ verified: true }`; frontend advances signup.
actual: User receives SMS and enters the exact code from the SMS, but frontend shows "인증번호가 일치하지 않습니다" — the WRONG path of VERIFY_AND_INCREMENT_LUA.
errors: Frontend "인증번호가 일치하지 않습니다" (from `res.verified === false` branch in apps/web/components/auth/phone-verification.tsx:143). Server response is HTTP 200 with `{ verified: false, message: '인증번호가 일치하지 않습니다' }`.
reproduction: https://heygrabit.com signup → 3단계 → enter phone → "인증번호 발송" → receive SMS → enter the exact 6-digit code → press "확인".
started: Phase 13 production cutover (2026-04-23/24). Phase 10.1 self-managed OTP path has been working (260420-cd7 confirmed deploy success); the grapit → grabit cutover is the first change since.

## Eliminated

- hypothesis: "INFOBIP_SENDER='Grabit' alphanumeric — container crash-loops so SMS never sends"
  evidence: User confirms SMS delivery. sms.service.ts:120-132 throws in constructor if production && non-numeric. Container is up. Therefore secret value IS numeric (KISA-registered numeric sender ID). SMS send path is healthy.
  timestamp: 2026-04-24T02:15:00Z

- hypothesis: "Phase 13 bulk rename changed OTP Redis key prefix (grapit:otp → grabit:otp)"
  evidence: `git grep sms:otp` and `git grep sms:verified` show only the `sms:` prefix everywhere; no "grapit:" / "grabit:" prefix ever existed in sms.service.ts. The prefix is literally `sms:otp:{e164}`. Phase 13 rename did NOT touch key prefixes (SMS keys were never brand-named).
  timestamp: 2026-04-24T02:16:00Z

- hypothesis: "Phase 13 rename mutated SMS text (OTP derived from text)"
  evidence: diff shows only line 203 `[Grapit]` → `[Grabit]`. The OTP value stored in Redis is `String(randomInt(100000, 1000000))` (sms.service.ts:155-157), independent of the text. Comparison uses ARGV[1] (user-submitted code) against GET sms:otp:{e164} (6-digit string). Brand string is not in the compare path.
  timestamp: 2026-04-24T02:17:00Z

## Evidence

- timestamp: 2026-04-24T02:12:00Z
  checked: apps/api/src/modules/sms/sms.service.ts sendVerificationCode + verifyCode
  found: send path stores OTP at `sms:otp:${e164}` with PX 180000 (180s) via ioredis pipeline.set; pipeline.del clears `sms:attempts:${e164}`. verify path calls Lua VERIFY_AND_INCREMENT_LUA with KEYS[`sms:otp:${e164}`, `sms:attempts:${e164}`, `sms:verified:${e164}`] and ARGV[code, '5', '600']. WRONG branch fires when `stored != ARGV[1]` — both are strings, so divergence must come from either (a) different e164 between send/verify, (b) different Valkey backends between send/verify, or (c) send path never actually stored the OTP that was in the SMS text.
  implication: The failure mode is one of three mechanisms, not a key rename.

- timestamp: 2026-04-24T02:14:00Z
  checked: auth.service.ts:71 (register) + web flow (phone-verification.tsx → signup-step3.tsx → signup-form.tsx)
  found: Frontend calls /api/v1/sms/verify-code ONCE in PhoneVerification.handleVerifyCode. The user's complaint message is a perfect match for the first verify (PhoneVerification stays on the signup screen with verifyError="인증번호가 일치하지 않습니다"). The second verify inside /auth/register is not yet reached because the user can't advance past Step 3 — signup-step3 gates `form.setValue('phoneVerificationCode', code)` on successful first verify.
  implication: Bug is in the FIRST /sms/verify-code call, not in the /auth/register path. Investigation is squarely on SmsService.verifyCode vs SmsService.sendVerificationCode agreement.

- timestamp: 2026-04-24T02:18:00Z
  checked: .github/workflows/deploy.yml:11-13 + :81-127, scripts/provision-grabit-infra.sh, scripts/cleanup-old-grapit-resources.sh
  found: Phase 13 Wave 3 created NEW Cloud Run services `grabit-api` and `grabit-web` in a NEW AR repo `grabit` while OLD services `grapit-api` / `grapit-web` remained running (7-day grace). Both old and new grabit-api services mount `REDIS_URL=redis-url:latest` from GCP Secret Manager — the underlying Valkey instance is a shared Memorystore (scripts/provision-valkey.sh: INSTANCE_NAME=grabit-valkey, POLICY_NAME=grabit-valkey-policy; note: scripts are idempotent and explicitly comment "이미 provision된 (구-브랜드) Valkey 인스턴스는 이름 immutable"). So both services should read the same Valkey backend via the same secret. No evidence of a separate new Valkey.
  implication: A simple Valkey split between grapit-api and grabit-api is NOT the root cause — they share `redis-url` secret. Need to look elsewhere.

- timestamp: 2026-04-24T02:20:00Z
  checked: deploy.yml:76-94 (Cloud Run service flags)
  found: `--session-affinity` enabled on grabit-api. `--min-instances=0`, `--max-instances=5`. Multiple instances possible under load.
  implication: Session affinity does not affect Valkey state (Valkey is external). Two instances would both hit the same Valkey. This is not the cause.

- timestamp: 2026-04-24T02:22:00Z
  checked: LB URL Map host rules (cleanup-old-grapit-resources.sh:58-120 describes the expected state: heygrabit.com → grabit-web-backend, api.heygrabit.com → grabit-api-backend)
  found: After Wave 4, apex heygrabit.com routes to grabit-web (new) and api.heygrabit.com routes to grabit-api (new). But the OLD grapit-api service is still live (grace period). It is reachable at its direct `.run.app` URL but NOT via the LB hostnames. During signup from heygrabit.com, the frontend uses `NEXT_PUBLIC_API_URL=https://api.heygrabit.com` (built into grabit-web Docker at deploy.yml:152). So the client's /sms/send-code AND /sms/verify-code both go to the same api.heygrabit.com → grabit-api pod.
  implication: Path splitting between grapit-api and grabit-api at the API edge is unlikely. Both calls hit grabit-api.

- timestamp: 2026-04-24T02:28:00Z
  checked: commit b382e39 (2026-04-13) "fix(booking): add Redis Cluster hash tags to prevent CROSSSLOT errors" + sms.service.ts VERIFY_AND_INCREMENT_LUA (L55-79) + apps/api/test/sms-throttle.integration.spec.ts Valkey container setup (L318-326)
  found: booking commit message states verbatim "Google Memorystore for Valkey runs in CLUSTER mode even with a single shard. Lua scripts that touch multiple keys fail with CROSSSLOT when keys hash to different slots." Fix was to wrap shared component in `{}` hash tags. SMS service was re-written 4 days later (96ad565 on 2026-04-17) but did NOT apply hash tagging to its 3-key Lua — keys are `sms:otp:${e164}`, `sms:attempts:${e164}`, `sms:verified:${e164}` (different CRC16 → different cluster slots). SMS integration test spins up `valkey/valkey:8` standalone container (not cluster mode, no CROSSSLOT enforcement) — production regression not caught.
  implication: The 3-key EVAL in verifyCode triggers a CROSSSLOT reply-error in production Valkey. The promise rejects → catch block at sms.service.ts:390-415 returns `{ verified: false, message: '인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.' }` (HTTP 200) + decrements the verify rate-limit counter + captures to Sentry + logs `sms.verify_failed` with the CROSSSLOT message.

- timestamp: 2026-04-24T02:30:00Z
  checked: apps/web/components/auth/phone-verification.tsx L129-158 (handleVerifyCode + mapErrorToCopy)
  found: When server returns HTTP 200 with `{ verified: false, message: '...' }`, the frontend does NOT read `res.message`. It unconditionally calls `setVerifyError('인증번호가 일치하지 않습니다')` at L143. `mapErrorToCopy` is invoked only when `apiClient.post` throws (non-2xx response). Our CROSSSLOT path returns 200 + verified:false, so the catch/mapErrorToCopy branch never fires and the generic system-error copy from the server is discarded.
  implication: CROSSSLOT-induced "system error" is invisible to the user as such — it surfaces with the exact same copy as an actual wrong-code entry, reproducing the report "맞는 인증번호를 입력해도 틀렸다고 나옴".

- timestamp: 2026-04-24T02:32:00Z
  checked: git log timeline 2026-04-13 → 2026-04-24
  found: Phase 10.1 SMS deploy (c84ff98, 2026-04-20) verified only Cloud Run startup probe success — no E2E SMS verify test was run against production Valkey. Phase 13 UAT 10 is the FIRST time a real human ran the end-to-end signup flow against cluster-mode Memorystore. The bug has been latent since 2026-04-20 and only now surfaces because UAT 10 is the first real-user verify call.
  implication: This is NOT a Phase 13 regression — the grapit→grabit rename is coincidentally exposing a latent CROSSSLOT bug that has been in production since Phase 10.1 ship. The gap is: SMS verify has never actually worked in cluster-mode Valkey.

## Resolution

root_cause: |
  `SmsService.verifyCode` executes `redis.eval(VERIFY_AND_INCREMENT_LUA, 3, 'sms:otp:${e164}', 'sms:attempts:${e164}', 'sms:verified:${e164}', code, '5', '600')` — three keys without a common hash tag. Google Memorystore for Valkey runs in cluster mode even with shard-count=1, and rejects multi-key EVAL whose keys hash to different slots with the error `CROSSSLOT Keys in request don't hash to the same slot`. ioredis propagates that as a ReplyError; the catch block in sms.service.ts:390-415 swallows it into `{ verified: false, message: '인증번호 확인에 실패했습니다...' }` (HTTP 200). The frontend at apps/web/components/auth/phone-verification.tsx:142-144 ignores the server's `message` field and hard-codes "인증번호가 일치하지 않습니다" whenever `res.verified === false`, which is why the user sees the wrong-code copy even though the real failure is a Valkey cluster-mode server error.

  The identical anti-pattern existed in booking.service.ts and was fixed on 2026-04-13 (b382e39) by wrapping keys with `{showtimeId}` hash tags. SMS Phase 10.1 was authored 4 days later but did not apply the same pattern. The SMS integration test `apps/api/test/sms-throttle.integration.spec.ts` spins up a standalone `valkey/valkey:8` container (non-cluster), which does not enforce CROSSSLOT, so the tests pass despite the production defect.
fix: |
  Primary (required): apply Redis Cluster hash-tag pattern to the three SMS keys in apps/api/src/modules/sms/sms.service.ts so all three route to the same slot. The canonical pattern used in booking.service.ts is to wrap a common phone-bound component with `{}`. Proposed key layout:
    - `{sms:${e164}}:otp`
    - `{sms:${e164}}:attempts`
    - `{sms:${e164}}:verified`
  Keys with pre-existing TTL 180s/900s/600s will naturally drain within 15 minutes of deploy, so no state migration is required — first post-deploy send-code call writes the new shape.

  Secondary (recommended): update apps/web/components/auth/phone-verification.tsx handleVerifyCode to prefer `res.message` over the hard-coded "인증번호가 일치하지 않습니다" when falsy-verify. Also consider having the server return a distinct HTTP status (e.g. 500) for genuine internal errors instead of 200 + verified:false, so `apiClient.post` surfaces the system-error copy via mapErrorToCopy.

  Tertiary (hardening): extend the SMS integration test to run against a cluster-mode Valkey (or at minimum a testcontainer with `--cluster-enabled yes`) so CROSSSLOT regressions are caught in CI.
verification: |
  Not yet verified (goal=find_root_cause_only).

  Direct falsification path for the fix agent:
  1. From a terminal authenticated to the GCP project, port-forward or IAP-tunnel to the Memorystore Valkey endpoint and run `redis-cli` against it.
  2. Execute the exact EVAL with 3 non-hash-tagged keys → expect `(error) CROSSSLOT Keys in request don't hash to the same slot`.
  3. Execute the same EVAL with hash-tagged keys `{sms:+821012345678}:otp`, `{sms:+821012345678}:attempts`, `{sms:+821012345678}:verified` → expect no CROSSSLOT.
  4. Alternatively: tail `gcloud logging read 'resource.labels.service_name=grabit-api AND jsonPayload.event=sms.verify_failed'` during a reproduction attempt — the error text should contain `CROSSSLOT`.
files_changed: []
