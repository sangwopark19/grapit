# Phase 14: SMS OTP CROSSSLOT fix — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 5 (2 MODIFY api + 1 MODIFY web + 1 MODIFY existing integration test + 2 CREATE tests — web test file already exists so it is a MODIFY, and a new cluster integration spec is CREATE)
**Analogs found:** 5 / 5 — all exact / role+flow matches live in this repo

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `apps/api/src/modules/sms/sms.service.ts` (MODIFY) | service (NestJS Injectable + Lua over IORedis) | request-response + atomic Lua EVAL over Redis Cluster | `apps/api/src/modules/booking/booking.service.ts` (commit b382e39 — identical class of bug, same fix) | **EXACT** (same role, same data flow, same root-cause class) |
| `apps/web/components/auth/phone-verification.tsx` (MODIFY) | component (React client component — async handler) | request-response (apiClient.post → state) | self — `handleSendCode` (L111-127) already reads `err.message` via `mapErrorToCopy`. Current `handleVerifyCode` (L129-158) just needs the 3-line server-message priority patch. | **SELF-MATCH** (other branch of same component is the pattern) |
| `apps/api/test/sms-throttle.integration.spec.ts` (MODIFY) | test (Vitest integration spec — testcontainers + ioredis) | batch / Lua smoke | self — already defines `keys(phone)` helper + `VERIFY_AND_INCREMENT_LUA` duplicate literal (L272-316). Replace literal+helper with `import` from `sms.service.ts`. | **SELF** (refactor this file to remove drift) |
| `apps/api/test/sms-cluster-crossslot.integration.spec.ts` (CREATE) | test (Vitest integration — cluster-mode testcontainer) | batch / Lua smoke + CROSSSLOT regression | `apps/api/test/sms-throttle.integration.spec.ts` L272-331 (`describe('VERIFY_AND_INCREMENT_LUA …')` + GenericContainer `valkey/valkey:8` bootstrap) — same testcontainers + ioredis flow. | **ROLE + FLOW MATCH** (add `--cluster-enabled yes` + `CLUSTER ADDSLOTSRANGE` + `IORedis.Cluster`) |
| `apps/web/components/auth/__tests__/phone-verification.test.tsx` (MODIFY) | test (Vitest + @testing-library/react — jsdom) | request-response mock | self — already exists with `vi.mock('@/lib/api-client')` pattern, `userEvent.setup({ advanceTimers })`, `waitFor(() => screen.getByRole('alert'))`. Add 3 new `describe('서버 message 우선 (D-07)', …)` tests using identical mocking/render pattern. | **SELF** (extend same file with D-07 specs) |

---

## Pattern Assignments

### 1. `apps/api/src/modules/sms/sms.service.ts` (service, Lua over Redis Cluster)

**Analog:** `apps/api/src/modules/booking/booking.service.ts` — git `b382e39 fix(booking): add Redis Cluster hash tags to prevent CROSSSLOT errors (#14)`.

**Why this is the exact analog:** Same NestJS service class, same `@Inject(REDIS_CLIENT) redis: IORedis`, same `redis.eval(LUA, N, ...KEYS, ...ARGV)` invocation shape, same CROSSSLOT root cause, already fixed with the `{<common>}:<role>` hash-tag convention that Phase 14 is asked to copy verbatim.

#### 1a. Lua KEYS docstring with hash tag (copy-this pattern)

**From** `apps/api/src/modules/booking/booking.service.ts` **L17-54** (LOCK_SEAT_LUA header):

```typescript
/**
 * Lua script for atomic seat locking.
 * Cleans stale user-seats entries, checks count, SET NX, SADD + EXPIRE.
 *
 * KEYS[1] = {showtimeId}:user-seats:{userId}
 * KEYS[2] = {showtimeId}:seat:{seatId}
 * KEYS[3] = {showtimeId}:locked-seats
 * ARGV[1] = userId
 * ARGV[2] = LOCK_TTL (600)
 * ARGV[3] = MAX_SEATS (4)
 * ARGV[4] = seatId
 * ARGV[5] = key prefix "{showtimeId}:seat:"
 *
 * Hash tag {showtimeId} ensures all keys hash to the same Redis Cluster slot.
 */
const LOCK_SEAT_LUA = `…`;
```

**Apply to** `apps/api/src/modules/sms/sms.service.ts` **L39-79** (`VERIFY_AND_INCREMENT_LUA` docstring):

- Current docstring (L42-49) says `KEYS[1] sms:otp:{e164}` etc — rewrite to `KEYS[1] {sms:${e164}}:otp` (hash-tag outside role suffix).
- Add the closing sentence verbatim: "Hash tag `{sms:${e164}}` ensures all keys hash to the same Redis Cluster slot."
- **D-05:** Lua body itself (L55-79, lines starting `local stored = …` through `return {'WRONG', …}`) stays byte-identical.

#### 1b. Hash-tag key builder functions (export from module top-level)

**From** `apps/api/src/modules/booking/booking.service.ts` **L127-130** (`lockSeat` method body) — the hash-tag literal `{${showtimeId}}:<role>:<id>` is embedded inline in booking; for SMS we promote to module-level exports per D-13 (single source of truth for tests).

```typescript
// Inline literal pattern from booking.service.ts L127-130 (reference only):
const userSeatsKey   = `{${showtimeId}}:user-seats:${userId}`;
const lockKey        = `{${showtimeId}}:seat:${seatId}`;
const lockedSeatsKey = `{${showtimeId}}:locked-seats`;
const keyPrefix      = `{${showtimeId}}:seat:`;
```

**Apply to** `apps/api/src/modules/sms/sms.service.ts` — add top-level exports (above the `SendResult`/`VerifyResult` interfaces around current L81, or grouped next to the Lua constant):

```typescript
// NEW — above class declaration.
// [VERIFIED: booking.service.ts L127-130 equivalent hash-tag pattern]
export const smsOtpKey      = (e164: string): string => `{sms:${e164}}:otp`;
export const smsAttemptsKey = (e164: string): string => `{sms:${e164}}:attempts`;
export const smsVerifiedKey = (e164: string): string => `{sms:${e164}}:verified`;
```

Also **promote** `VERIFY_AND_INCREMENT_LUA` (currently `const` at L55) to `export const` so tests import the same Lua body (D-13 SoT).

#### 1c. Call-site updates (`sendVerificationCode` pipeline + `verifyCode` eval)

**From** `apps/api/src/modules/booking/booking.service.ts` **L132-143** (eval with builder-named locals):

```typescript
const result = (await this.redis.eval(
  LOCK_SEAT_LUA,
  3,
  userSeatsKey,   // {showtimeId}:user-seats:{userId}
  lockKey,        // {showtimeId}:seat:{seatId}
  lockedSeatsKey, // {showtimeId}:locked-seats
  userId,
  String(LOCK_TTL),
  String(MAX_SEATS),
  seatId,
  keyPrefix,
)) as [number, string, string?];
```

**Apply to** `apps/api/src/modules/sms/sms.service.ts`:

- **L220-222 (`sendVerificationCode` pipeline):**
  ```typescript
  // BEFORE
  pipeline.set(`sms:otp:${e164}`, otp, 'PX', OTP_TTL_MS);
  pipeline.del(`sms:attempts:${e164}`);
  // AFTER
  pipeline.set(smsOtpKey(e164), otp, 'PX', OTP_TTL_MS);
  pipeline.del(smsAttemptsKey(e164));
  ```
- **L360-369 (`verifyCode` eval):**
  ```typescript
  // BEFORE (3 KEYS inline literals)
  const result = (await this.redis.eval(
    VERIFY_AND_INCREMENT_LUA,
    3,
    `sms:otp:${e164}`,
    `sms:attempts:${e164}`,
    `sms:verified:${e164}`,
    code,
    String(OTP_MAX_ATTEMPTS),
    String(VERIFIED_FLAG_TTL_SEC),
  )) as [string, number];
  // AFTER
  const result = (await this.redis.eval(
    VERIFY_AND_INCREMENT_LUA,
    3,
    smsOtpKey(e164),
    smsAttemptsKey(e164),
    smsVerifiedKey(e164),
    code,
    String(OTP_MAX_ATTEMPTS),
    String(VERIFIED_FLAG_TTL_SEC),
  )) as [string, number];
  ```

#### 1d. Unchanged surfaces (do NOT touch — D-04/D-06/D-14/D-15)

- **L31-37** `ATOMIC_INCR_LUA` — single-key, no CROSSSLOT risk, D-06.
- **L176** `sms:resend:${e164}` (cooldown SET NX), **L189** `sms:phone:send:${e164}`, **L259** `sms:phone:send:${e164}` rollback, **L326** `sms:phone:verify:${e164}`, **L398** `sms:phone:verify:${e164}` rollback — all single-key, D-04.
- **L390-415** generic catch in `verifyCode` — D-14.

---

### 2. `apps/web/components/auth/phone-verification.tsx` (component, request-response)

**Analog:** same file, **L122-123** inside `handleSendCode` — already demonstrates "use server-derived copy, fall back to hardcode" via `mapErrorToCopy(err)`. The verify branch (L142-143) is the outlier that hardcodes.

#### 2a. Server-message priority with empty-string defence (D-07 + D-08)

**From** `apps/web/components/auth/phone-verification.tsx` **L111-127** (`handleSendCode` error mapping that already exists — conceptual analog):

```typescript
try {
  await apiClient.post('/api/v1/sms/send-code', { phone });
  // …
} catch (err) {
  setVerifyError(mapErrorToCopy(err));  // ← 서버/에러 파생 카피를 우선 사용하는 기존 습관
}
```

**Apply to** `apps/web/components/auth/phone-verification.tsx` **L129-158** (`handleVerifyCode`) — specifically replace **L139-144**:

```typescript
// BEFORE (L139-144)
if (res.verified) {
  clearTimer();
  onVerified(code);
} else {
  setVerifyError('인증번호가 일치하지 않습니다');
}

// AFTER (per CONTEXT.md §specifics patch + RESEARCH.md §Code Examples 2)
if (res.verified) {
  clearTimer();
  onVerified(code);
} else {
  const fallback = '인증번호가 일치하지 않습니다';
  const serverMessage =
    typeof res.message === 'string' && res.message.length > 0
      ? res.message
      : null;
  setVerifyError(serverMessage ?? fallback);
}
```

**Do not change:**
- L10 `apiClient` import + L135 generic type — response shape `{ verified: boolean; message: string }` already carries `message`. (RESEARCH §2 "계약 — API side" confirms `VerifyResult.message` is already optional on the server side; frontend generic may keep `message: string` or narrow to `message?: string`. If TypeScript complains, narrow to `message?: string` — but that is still inside the same L135 line.)
- L145-157 catch block — `mapErrorToCopy` + 410/422 EXPIRED forcing is D-09 unchanged.

---

### 3. `apps/api/test/sms-throttle.integration.spec.ts` (test, integration / batch Lua smoke)

**Analog:** **self** — replace its own inline Lua + key-literal duplicates with the exports added in §1.

#### 3a. Replace Lua literal and key helper with service-side imports

**From** `apps/api/test/sms-throttle.integration.spec.ts` **L272-316** (current drift-risk pattern):

```typescript
describe('VERIFY_AND_INCREMENT_LUA atomic script (Valkey EVAL)', () => {
  let container: StartedTestContainer;
  let redis: IORedis;

  // Must match sms.service.ts VERIFY_AND_INCREMENT_LUA exactly  ← drift vector
  const VERIFY_AND_INCREMENT_LUA = `
local stored = redis.call('GET', KEYS[1])
… (L286-310 full Lua body, duplicated) …
`;

  const keys = (phone: string) => [          // L312-316 — duplicates sms:otp:/attempts:/verified: literal scheme
    `sms:otp:${phone}`,
    `sms:attempts:${phone}`,
    `sms:verified:${phone}`,
  ];
```

**After (Plan-side action):**

```typescript
// NEW top-of-file import
import {
  VERIFY_AND_INCREMENT_LUA,
  smsOtpKey,
  smsAttemptsKey,
  smsVerifiedKey,
} from '../src/modules/sms/sms.service.js';

describe('VERIFY_AND_INCREMENT_LUA atomic script (Valkey EVAL)', () => {
  let container: StartedTestContainer;
  let redis: IORedis;

  // REMOVED: local const VERIFY_AND_INCREMENT_LUA = `…` (was L286-310)

  const keys = (phone: string) => [
    smsOtpKey(phone),
    smsAttemptsKey(phone),
    smsVerifiedKey(phone),
  ];
```

#### 3b. Update scenario assertions that read back keys directly

**From** same file **L337-426** — each `it(…)` block calls `redis.get(`sms:otp:${phone}`)`, `redis.set(`sms:otp:${phone}`, …)`, `redis.ttl(`sms:attempts:${phone}`)`, etc.

**Apply:** replace every literal `` `sms:otp:${phone}` `` / `` `sms:attempts:${phone}` `` / `` `sms:verified:${phone}` `` with the builder call:

```typescript
// BEFORE (L339, L346, L347, L348, L353, L360, L361, L376, L398, L399, L404, L410, L417, L423 — ~12 occurrences)
await redis.set(`sms:otp:${phone}`, '123456', 'PX', 180_000);
expect(await redis.get(`sms:otp:${phone}`)).toBeNull();

// AFTER
await redis.set(smsOtpKey(phone), '123456', 'PX', 180_000);
expect(await redis.get(smsOtpKey(phone))).toBeNull();
```

**beforeEach** at L333-335 must also switch: `await redis.del(...keys('+821099990001'));` already dereferences the helper — just confirm the helper now builds hash-tagged keys (automatic via §3a).

**Rate-limit describe blocks (L56-270)** are untouched — those are `@nestjs/throttler` tests, D-04 unchanged.

---

### 4. `apps/api/test/sms-cluster-crossslot.integration.spec.ts` (CREATE — cluster-mode testcontainer)

**Analog:** `apps/api/test/sms-throttle.integration.spec.ts` **L273-331** (`describe('VERIFY_AND_INCREMENT_LUA … (Valkey EVAL)')` container lifecycle) plus **Pattern 2** from RESEARCH.md §Architecture Patterns. Secondary analog: `apps/api/test/admin-dashboard.integration.spec.ts` **L33-83** for the `beforeAll/afterAll` + `StartedTestContainer` skeleton.

#### 4a. Existing GenericContainer('valkey/valkey:8') bootstrap (standalone — copy + extend)

**From** `apps/api/test/sms-throttle.integration.spec.ts` **L318-331**:

```typescript
beforeAll(async () => {
  container = await new GenericContainer('valkey/valkey:8')
    .withExposedPorts(6379)
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);
  redis = new IORedis(`redis://${host}:${port}`, { maxRetriesPerRequest: 3 });
}, 120_000);

afterAll(async () => {
  await redis?.quit();
  await container?.stop();
});
```

**From** `apps/api/test/admin-dashboard.integration.spec.ts` **L41-83** (fuller lifecycle shape — two containers, beforeEach flushall, typed locals):

```typescript
let redisContainer: StartedTestContainer;
let redis: IORedis;

beforeAll(async () => {
  redisContainer = await new GenericContainer('valkey/valkey:8')
    .withExposedPorts(6379)
    .start();

  redis = new IORedis({
    host: redisContainer.getHost(),
    port: redisContainer.getMappedPort(6379),
    maxRetriesPerRequest: 3,
  });
  // …
}, 180_000);

afterAll(async () => {
  await redis?.quit();
  await redisContainer?.stop();
});

beforeEach(async () => {
  // …
  await redis.flushall();
});
```

#### 4b. Extend to cluster-mode (RESEARCH.md Pattern 2 — proposed skeleton for new file)

**Apply:** create `apps/api/test/sms-cluster-crossslot.integration.spec.ts` with the following structure, copying the above analog frame and swapping:

1. `.withCommand([...])` flags to enable cluster mode,
2. `CLUSTER ADDSLOTSRANGE 0 16383` + poll `CLUSTER INFO` for `cluster_state:ok`,
3. `new IORedis.Cluster(…)` with `natMap` instead of plain `new IORedis(url)`.

Skeleton (from RESEARCH.md §Architecture Patterns `Pattern 2`):

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import IORedis, { Cluster } from 'ioredis';
import {
  VERIFY_AND_INCREMENT_LUA,
  smsOtpKey, smsAttemptsKey, smsVerifiedKey,
} from '../src/modules/sms/sms.service.js';

let container: StartedTestContainer;
let cluster: Cluster;

beforeAll(async () => {
  container = await new GenericContainer('valkey/valkey:8')
    .withExposedPorts(6379)
    .withCommand([
      'valkey-server',
      '--port', '6379',
      '--cluster-enabled', 'yes',
      '--cluster-config-file', 'nodes.conf',
      '--cluster-node-timeout', '5000',
      '--appendonly', 'no',
      '--cluster-require-full-coverage', 'no',
    ])
    .start();

  const host = container.getHost();
  const port = container.getMappedPort(6379);

  // Bootstrap cluster: assign all 16384 slots to this single master.
  const boot = new IORedis(`redis://${host}:${port}`, { maxRetriesPerRequest: 3 });
  await boot.call('CLUSTER', 'ADDSLOTSRANGE', '0', '16383');
  // Poll until cluster_state:ok (Pitfall 4 — RESEARCH.md §Common Pitfalls)
  for (let i = 0; i < 20; i++) {
    const info = (await boot.call('CLUSTER', 'INFO')) as string;
    if (info.includes('cluster_state:ok')) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  await boot.quit();

  // Cluster-aware client (Pitfall 5 — RESEARCH.md §6 minimal options)
  cluster = new IORedis.Cluster(
    [{ host, port }],
    {
      natMap: { [`${host}:6379`]: { host, port } },
      lazyConnect: true,
      scaleReads: 'master',
      enableReadyCheck: true,
      redisOptions: { maxRetriesPerRequest: 3 },
    },
  );
  await cluster.connect();
}, 180_000);

afterAll(async () => {
  await cluster?.quit();
  await container?.stop();
});
```

#### 4c. Five mandatory scenarios (RESEARCH.md §9)

Test-case bodies reuse the **exact same Lua eval shape** as `sms-throttle.integration.spec.ts` L341-344 (`cluster.eval(VERIFY_AND_INCREMENT_LUA, 3, …keys(phone), '123456', '5', '600')`). Required `it(…)` blocks:

1. **[GUARD]** `'과거 스킴은 cluster-mode 에서 CROSSSLOT 을 던진다'` — eval with the **literal** legacy keys (hash-tag removed) and assert `.rejects.toThrow(/CROSSSLOT/)`:
   ```typescript
   await expect(
     cluster.eval(
       VERIFY_AND_INCREMENT_LUA, 3,
       `sms:otp:${phone}`, `sms:attempts:${phone}`, `sms:verified:${phone}`,
       '123456', '5', '600',
     ),
   ).rejects.toThrow(/CROSSSLOT/);
   ```
   **D-10 negative guard** — must stay in test even though those literals don't appear in src (Pitfall 2 warning sign #2).
2. **[PASS]** VERIFIED / WRONG / EXPIRED / NO_MORE_ATTEMPTS via new hash-tagged keys — mirror `sms-throttle.integration.spec.ts` L337-400 scenarios 1:1 but using `cluster.eval(…)` and `smsOtpKey(phone)/…`.
3. **[HASH]** `CLUSTER KEYSLOT` 3-key equality:
   ```typescript
   const s1 = await cluster.call('CLUSTER', 'KEYSLOT', smsOtpKey(phone));
   const s2 = await cluster.call('CLUSTER', 'KEYSLOT', smsAttemptsKey(phone));
   const s3 = await cluster.call('CLUSTER', 'KEYSLOT', smsVerifiedKey(phone));
   expect(s1).toBe(s2);
   expect(s2).toBe(s3);
   ```
4. **[PIPELINE]** `sendVerificationCode`-style pipeline SET+DEL succeeds on new keys (forward guard against future contributors adding verified-key to the pipeline).
5. **[NEGATIVE]** Multiple e164 formats (`+821012345678`, `+8210…`, `+1234567890`) all yield 3-key slot equality.

`beforeEach` uses `await cluster.del(smsOtpKey(phone), smsAttemptsKey(phone), smsVerifiedKey(phone));` — legal because all 3 keys hash to the same slot by construction.

---

### 5. `apps/web/components/auth/__tests__/phone-verification.test.tsx` (MODIFY — file already exists)

**Analog:** **self** — already defines the full mocking + render + userEvent pattern. Phase 14 just adds one new `describe('서버 message 우선 (D-07)', …)` with 3 tests alongside the existing blocks.

#### 5a. apiClient mock (existing pattern at L7-20) — reuse verbatim

**From** `apps/web/components/auth/__tests__/phone-verification.test.tsx` **L7-20**:

```typescript
// API client mock
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'ApiClientError';
      this.statusCode = statusCode;
    }
  },
}));
```

**Apply:** no change — the new tests reuse the same module-level mock.

#### 5b. `defaultProps` + fake timers (existing pattern L25-42)

**From** same file **L25-42**:

```typescript
const defaultProps = {
  phone: '+821012345678',
  onPhoneChange: vi.fn(),
  onVerified: vi.fn(),
  isVerified: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => { vi.useRealTimers(); });
```

**Apply:** reuse. New D-07 tests fit under the same top-level `describe('PhoneVerification', …)`.

#### 5c. Send-then-verify flow (existing pattern — L161-187 is the closest analog block)

**From** same file **L161-187** (the existing "400 에러 시 … 일치하지 않습니다" test — flow exactly matches what D-07 tests need: first mock resolves the send, second mock resolves the verify):

```typescript
it('400 에러 시 "인증번호가 일치하지 않습니다"', async () => {
  const { apiClient } = await import('@/lib/api-client');
  (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: true });

  render(<PhoneVerification {...defaultProps} />);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  await user.click(screen.getByRole('button', { name: /인증번호 발송/ }));

  // verify에서 400
  (apiClient.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    verified: false,
    message: '인증번호가 일치하지 않습니다',
  });

  await waitFor(() => {
    const input = screen.getByPlaceholderText(/인증번호 6자리/);
    expect(input).toBeInTheDocument();
  });

  const codeInput = screen.getByPlaceholderText(/인증번호 6자리/);
  await user.type(codeInput, '999999');
  await user.click(screen.getByRole('button', { name: /확인/ }));

  await waitFor(() => {
    expect(screen.getByText(/인증번호가 일치하지 않습니다/)).toBeInTheDocument();
  });
});
```

**Apply:** clone this shape three times into a new `describe('서버 message 우선 (D-07)', …)` block with the following three `it(…)` bodies (SC-4a / SC-4b / SC-4c):

1. **SC-4a — server message takes precedence (시스템 에러 분기):**
   ```typescript
   (apiClient.post as ReturnType<typeof vi.fn>)
     .mockResolvedValueOnce({ success: true })            // send
     .mockResolvedValueOnce({                              // verify
       verified: false,
       message: '인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.',
     });
   // … type '123456' → click 확인 →
   await waitFor(() => {
     expect(screen.getByRole('alert')).toHaveTextContent(
       '인증번호 확인에 실패했습니다. 잠시 후 다시 시도해주세요.',
     );
   });
   ```
2. **SC-4b — undefined / empty-string message falls back to hardcode:**
   ```typescript
   (apiClient.post as ReturnType<typeof vi.fn>)
     .mockResolvedValueOnce({ success: true })
     .mockResolvedValueOnce({ verified: false });         // message undefined
   // …
   await waitFor(() => {
     expect(screen.getByRole('alert')).toHaveTextContent('인증번호가 일치하지 않습니다');
   });
   ```
   (Second case with `{ verified: false, message: '' }` — D-08 empty-string defence — as a separate `it` per RESEARCH.md §Code Examples 3.)
3. **SC-4c — verified:true triggers onVerified + clearTimer (regression guard):**
   ```typescript
   const onVerified = vi.fn();
   (apiClient.post as ReturnType<typeof vi.fn>)
     .mockResolvedValueOnce({ success: true })
     .mockResolvedValueOnce({ verified: true });
   render(<PhoneVerification {...defaultProps} onVerified={onVerified} />);
   // … type '123456' → click 확인 →
   await waitFor(() => {
     expect(onVerified).toHaveBeenCalledWith('123456');
   });
   ```

**Assertion selector note:** existing tests use `screen.getByText(/…/)`, but RESEARCH.md §Code Examples 3 recommends `screen.getByRole('alert')` because the component renders `role="alert"` at L264-270 of `phone-verification.tsx`. Both work; `getByRole('alert')` is stronger (A11y). Existing test L262-265 (아래 "에러 메시지에 role='alert' 존재") already proves this selector works — reuse.

---

## Shared Patterns

### SP-1: Hash-Tag scheme `{<common>}:<role>`

**Source:** `apps/api/src/modules/booking/booking.service.ts` L127-130 (inline) + L17-54 (Lua docstring header).
**Apply to:** `sms.service.ts` (§1 above). All 3 SMS OTP keys must use the `{sms:${e164}}:<role>` form; all Lua EVAL call sites pass these hash-tagged names as KEYS[1..3]; Lua body itself is unchanged (receives opaque KEYS[], agnostic to the wrapping).

**Rule:** never emit `sms:otp:` / `sms:attempts:` / `sms:verified:` literal prefixes anywhere in `apps/api/src/**`. Post-edit verification command (from RESEARCH.md §Pitfalls 1):

```bash
rg "sms:otp:|sms:attempts:|sms:verified:" apps/api/src
# must be empty after the refactor
```

### SP-2: Single source of truth for Lua + keys (test/service import)

**Source:** RESEARCH.md §Pattern 1 + D-13 locked decision.
**Apply to:** `sms.service.ts` exports (§1b); `sms-throttle.integration.spec.ts` imports (§3a); `sms-cluster-crossslot.integration.spec.ts` imports (§4b).
**Rule:** tests never re-declare `VERIFY_AND_INCREMENT_LUA` or key literals. Anti-pattern to block (currently present at `sms-throttle.integration.spec.ts` L286-316) must be removed in this phase.

### SP-3: testcontainers `GenericContainer('valkey/valkey:8')` + ioredis lifecycle

**Source:** `apps/api/test/sms-throttle.integration.spec.ts` L318-331; `apps/api/test/admin-dashboard.integration.spec.ts` L41-83.
**Apply to:** new `sms-cluster-crossslot.integration.spec.ts` (§4).
**Rule:**
- `beforeAll` with `180_000` timeout (180s) — matches admin-dashboard's value; `sms-throttle` uses `120_000` but cluster ADDSLOTS + ready-check adds ~1-2s so 180s is the safer default.
- `afterAll` order: `await client?.quit(); await container?.stop();`.
- `beforeEach` uses `flushall()` (standalone) or targeted `del(smsOtpKey, smsAttemptsKey, smsVerifiedKey)` (cluster, since flushall across all slots is supported but targeted del is safer — same-slot by hash-tag construction).

### SP-4: Vitest + @testing-library/react + api-client mock (web)

**Source:** `apps/web/components/auth/__tests__/phone-verification.test.tsx` L1-42 (current file — mock block + fake timers + defaultProps). Secondary: `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx` L31-39 (apiClient mock with full method stub).
**Apply to:** new D-07 tests appended to the same `phone-verification.test.tsx` file.
**Rule:**
- `vi.mock('@/lib/api-client', …)` at module top.
- `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` inside each `it`.
- `vi.useFakeTimers({ shouldAdvanceTime: true })` in `beforeEach`, `vi.useRealTimers()` in `afterEach` — already present.
- Chain mocks with `.mockResolvedValueOnce()` in send-then-verify order.

### SP-5: CROSSSLOT wire-format assertion

**Source:** RESEARCH.md §5 + `ioredis` ReplyError contract.
**Apply to:** new cluster spec §4c scenario 1 only.
**Rule:** `await expect(cluster.eval(…legacy keys…)).rejects.toThrow(/CROSSSLOT/)`. Regex is case-sensitive and matches the server-emitted string `CROSSSLOT Keys in request don't hash to the same slot`.

---

## No Analog Found

**None.** All 5 files in this phase have in-repo analogs; no need to fall back to RESEARCH.md synthetic examples (though RESEARCH.md §Code Examples 1-3 provide reference bodies that coincide with the in-repo analogs).

---

## Metadata

**Analog search scope:**
- `apps/api/src/modules/sms/**`, `apps/api/src/modules/booking/**` (service analogs)
- `apps/api/test/*.integration.spec.ts` (integration-test harness analogs)
- `apps/web/components/auth/**`, `apps/web/components/**/__tests__/**`, `apps/web/app/**/__tests__/**` (React client-component + test analogs)
- git `b382e39` (identical-class-bug fix reference — confirmed via `git log b382e39`)

**Files scanned:** 5 source files (sms.service.ts, booking.service.ts, phone-verification.tsx, sms-throttle.integration.spec.ts, admin-dashboard.integration.spec.ts) + 2 web test analogs (phone-verification.test.tsx, reset-password.test.tsx).

**Pattern extraction date:** 2026-04-24

**Sources cited inline:**
- `apps/api/src/modules/booking/booking.service.ts` (Phase 14's literal template — commit b382e39)
- `apps/api/test/sms-throttle.integration.spec.ts` (container + Lua-smoke template)
- `apps/api/test/admin-dashboard.integration.spec.ts` (dual-container lifecycle template)
- `apps/web/components/auth/__tests__/phone-verification.test.tsx` (vitest + testing-library template)
- `apps/web/app/auth/reset-password/__tests__/reset-password.test.tsx` (apiClient mock alternate shape)
- RESEARCH.md §Pattern 1, §Pattern 2, §5, §6, §9, §Code Examples 1-3 (cross-references into this map)
