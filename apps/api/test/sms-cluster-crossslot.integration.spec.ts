import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import IORedis, { Cluster } from 'ioredis';
import {
  VERIFY_AND_INCREMENT_LUA,
  smsOtpKey,
  smsAttemptsKey,
  smsVerifiedKey,
} from '../src/modules/sms/sms.service.js';

/**
 * [Phase 14 / SC-2 / D-10 / D-12] Cluster-mode Valkey 회귀 가드.
 *
 * Phase 10.1 의 sms-throttle.integration.spec.ts 는 standalone valkey 에서
 * 녹색이었기에 프로덕션 Memorystore Cluster 의 CROSSSLOT 을 놓쳤다.
 * 이 스펙은 single-shard cluster(CLUSTER ADDSLOTSRANGE 0 16383)로 실제
 * CROSSSLOT wire-format 을 재현하며, 신규 `{sms:${e164}}:<role>` 스킴이
 * 동일 slot 으로 매핑되는 것을 기계적으로 증명한다.
 *
 * [REVIEWS.md MEDIUM#4] natMap 은 CLUSTER SLOTS 결과를 동적 파싱해 구성한다.
 * Mac/Linux/CI runner 간 container internal IP 차이로 인한 flakiness 방어.
 *
 * 실행: pnpm --filter @grabit/api test:integration -- sms-cluster-crossslot
 * 필수: Docker 데몬 기동 (testcontainers 는 /var/run/docker.sock 사용).
 */

const PHONE = '+821012345678';

// [MEDIUM#4] Build natMap from CLUSTER SLOTS so container-internal IPs are
// remapped to the host-visible {host, mapped port}. Returns the natMap and
// logs the raw slot tuples for post-mortem when something misbehaves.
type ClusterSlotTuple = [
  number,
  number,
  [string, number, string],
  ...[string, number, string][],
];

function buildNatMap(
  slots: ClusterSlotTuple[],
  host: string,
  port: number,
): Record<string, { host: string; port: number }> {
  const seen = new Set<string>();
  const natMap: Record<string, { host: string; port: number }> = {};
  for (const slot of slots) {
    // slot = [startSlot, endSlot, [ip, port, id], ...replicas]
    for (let i = 2; i < slot.length; i++) {
      const node = slot[i] as [string, number, string];
      const key = `${node[0]}:${node[1]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      natMap[key] = { host, port };
    }
  }
  if (Object.keys(natMap).length === 0) {
    // eslint-disable-next-line no-console
    console.error(
      '[cluster-bootstrap] raw CLUSTER SLOTS reply:',
      JSON.stringify(slots),
    );
    throw new Error(
      'CLUSTER SLOTS returned no usable ip:port tuples — check --cluster-announce-ip or testcontainers host resolution.',
    );
  }
  // Always also map the literal host:6379 advertised by `--cluster-enabled`
  // default so naive replies still resolve (safe to overwrite).
  natMap[`${host}:6379`] = { host, port };
  return natMap;
}

describe('SMS OTP — Valkey Cluster mode (hash-tag regression guard)', () => {
  let container: StartedTestContainer;
  let cluster: Cluster;

  beforeAll(async () => {
    container = await new GenericContainer('valkey/valkey:8')
      .withExposedPorts(6379)
      .withCommand([
        'valkey-server',
        '--port',
        '6379',
        '--cluster-enabled',
        'yes',
        '--cluster-config-file',
        'nodes.conf',
        '--cluster-node-timeout',
        '5000',
        '--appendonly',
        'no',
        '--cluster-require-full-coverage',
        'no',
      ])
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(6379);

    // Bootstrap cluster: single master owns all 16384 slots.
    const boot = new IORedis(`redis://${host}:${port}`, {
      maxRetriesPerRequest: 3,
    });

    // [cluster bootstrap] Announce the host-reachable address BEFORE adding
    // slots. Without this the node advertises an empty IP (":6379") in
    // CLUSTER SLOTS replies because it cannot introspect its bridge IP from
    // inside the container. ioredis.Cluster would then try to dial an empty
    // hostname and the connect() hook hangs until timeout. Runtime
    // `CONFIG SET cluster-announce-ip/port` is equivalent to the CLI flag
    // (`--cluster-announce-ip`) but works here because the mapped port is
    // only known after `container.start()` returns.
    await boot.call('CONFIG', 'SET', 'cluster-announce-ip', host);
    await boot.call('CONFIG', 'SET', 'cluster-announce-port', String(port));
    await boot.call('CLUSTER', 'ADDSLOTSRANGE', '0', '16383');

    // Poll until cluster_state:ok (RESEARCH.md §Common Pitfalls #4).
    // Observed worst-case ~4.2s after announce-ip propagation — keep 6s
    // headroom (24 × 250ms) for CI variance.
    for (let i = 0; i < 24; i++) {
      const info = (await boot.call('CLUSTER', 'INFO')) as string;
      if (info.includes('cluster_state:ok')) break;
      await new Promise((r) => setTimeout(r, 250));
    }

    // [MEDIUM#4] Dynamic natMap — read CLUSTER SLOTS and remap every
    // advertised ip:port to the host-reachable {host, mapped port}.
    // With cluster-announce-ip in place, SLOTS now returns host:port directly
    // and buildNatMap maps those to themselves — but we keep the dynamic
    // build so any future container IP change still resolves cleanly.
    const slots = (await boot.call('CLUSTER', 'SLOTS')) as ClusterSlotTuple[];
    const natMap = buildNatMap(slots, host, port);
    // eslint-disable-next-line no-console
    console.log('[cluster-bootstrap] natMap:', natMap);
    await boot.quit();

    cluster = new IORedis.Cluster([{ host, port }], {
      natMap,
      lazyConnect: true,
      scaleReads: 'master',
      enableReadyCheck: true,
      redisOptions: { maxRetriesPerRequest: 3 },
    });
    await cluster.connect();
  }, 180_000);

  afterAll(async () => {
    await cluster?.quit();
    await container?.stop();
  });

  beforeEach(async () => {
    // Same-slot 3-key delete is legal by hash-tag construction.
    await cluster.del(
      smsOtpKey(PHONE),
      smsAttemptsKey(PHONE),
      smsVerifiedKey(PHONE),
    );
  });

  // --- Scenario 1: NEGATIVE GUARD — legacy scheme must CROSSSLOT ---
  describe('과거 스킴 (hash-tag 없음) 은 cluster-mode 에서 CROSSSLOT 을 던진다', () => {
    it('rejects with CROSSSLOT reply error', async () => {
      await expect(
        cluster.eval(
          VERIFY_AND_INCREMENT_LUA,
          3,
          `sms:otp:${PHONE}`,
          `sms:attempts:${PHONE}`,
          `sms:verified:${PHONE}`,
          '123456',
          '5',
          '600',
        ),
      ).rejects.toThrow(/CROSSSLOT/);
    });
  });

  // --- Scenario 2: 4-branch Lua atomic verify on NEW hash-tagged keys ---
  describe('신규 hash-tag 스킴은 4분기 모두 정상 EVAL', () => {
    it('VERIFIED: correct code → 3 keys DEL + verified flag SETEX', async () => {
      await cluster.set(smsOtpKey(PHONE), '123456', 'PX', 180_000);
      const [status, attempts] = (await cluster.eval(
        VERIFY_AND_INCREMENT_LUA,
        3,
        smsOtpKey(PHONE),
        smsAttemptsKey(PHONE),
        smsVerifiedKey(PHONE),
        '123456',
        '5',
        '600',
      )) as [string, number];
      expect(status).toBe('VERIFIED');
      expect(attempts).toBe(1);
      expect(await cluster.get(smsOtpKey(PHONE))).toBeNull();
      expect(await cluster.get(smsVerifiedKey(PHONE))).toBe('1');
    });

    it('WRONG: incorrect code → attempts INCR, remaining count returned', async () => {
      await cluster.set(smsOtpKey(PHONE), '123456', 'PX', 180_000);
      const [status, remaining] = (await cluster.eval(
        VERIFY_AND_INCREMENT_LUA,
        3,
        smsOtpKey(PHONE),
        smsAttemptsKey(PHONE),
        smsVerifiedKey(PHONE),
        '999999',
        '5',
        '600',
      )) as [string, number];
      expect(status).toBe('WRONG');
      expect(remaining).toBe(4);
    });

    it('EXPIRED: no stored otp → returns EXPIRED', async () => {
      const [status] = (await cluster.eval(
        VERIFY_AND_INCREMENT_LUA,
        3,
        smsOtpKey(PHONE),
        smsAttemptsKey(PHONE),
        smsVerifiedKey(PHONE),
        '123456',
        '5',
        '600',
      )) as [string, number];
      expect(status).toBe('EXPIRED');
    });

    it('NO_MORE_ATTEMPTS: 6th wrong attempt → DEL + NO_MORE_ATTEMPTS', async () => {
      await cluster.set(smsOtpKey(PHONE), '123456', 'PX', 180_000);
      // 5 wrong attempts consume the quota; 6th triggers exhaustion.
      for (let i = 0; i < 5; i++) {
        await cluster.eval(
          VERIFY_AND_INCREMENT_LUA,
          3,
          smsOtpKey(PHONE),
          smsAttemptsKey(PHONE),
          smsVerifiedKey(PHONE),
          '999999',
          '5',
          '600',
        );
      }
      const [status] = (await cluster.eval(
        VERIFY_AND_INCREMENT_LUA,
        3,
        smsOtpKey(PHONE),
        smsAttemptsKey(PHONE),
        smsVerifiedKey(PHONE),
        '999999',
        '5',
        '600',
      )) as [string, number];
      expect(status).toBe('NO_MORE_ATTEMPTS');
      expect(await cluster.get(smsOtpKey(PHONE))).toBeNull();
    });
  });

  // --- Scenario 3: CLUSTER KEYSLOT equality (hash-tag math proof) ---
  describe('3개 키가 동일 CLUSTER KEYSLOT 으로 매핑', () => {
    it('smsOtpKey / smsAttemptsKey / smsVerifiedKey share one slot', async () => {
      const s1 = await cluster.call('CLUSTER', 'KEYSLOT', smsOtpKey(PHONE));
      const s2 = await cluster.call(
        'CLUSTER',
        'KEYSLOT',
        smsAttemptsKey(PHONE),
      );
      const s3 = await cluster.call(
        'CLUSTER',
        'KEYSLOT',
        smsVerifiedKey(PHONE),
      );
      expect(s1).toBe(s2);
      expect(s2).toBe(s3);
    });
  });

  // --- Scenario 4: Pipeline SET + DEL (sendVerificationCode shape) ---
  describe('sendVerificationCode-style pipeline succeeds on cluster', () => {
    it('pipeline.set(otp) + del(attempts) executes without CROSSSLOT', async () => {
      const pipeline = cluster.pipeline();
      pipeline.set(smsOtpKey(PHONE), '654321', 'PX', 180_000);
      pipeline.del(smsAttemptsKey(PHONE));
      const results = await pipeline.exec();
      expect(results).not.toBeNull();
      expect(results!.every((r) => r[0] === null)).toBe(true);
      expect(await cluster.get(smsOtpKey(PHONE))).toBe('654321');
    });
  });

  // --- Scenario 5: multiple e164 formats all hold slot equality ---
  describe('다양한 e164 포맷에서도 3-key slot 동일성 유지', () => {
    it.each([['+821012345678'], ['+13125551234'], ['+8613812345678']])(
      'phone=%s',
      async (phone) => {
        const s1 = await cluster.call('CLUSTER', 'KEYSLOT', smsOtpKey(phone));
        const s2 = await cluster.call(
          'CLUSTER',
          'KEYSLOT',
          smsAttemptsKey(phone),
        );
        const s3 = await cluster.call(
          'CLUSTER',
          'KEYSLOT',
          smsVerifiedKey(phone),
        );
        expect(s1).toBe(s2);
        expect(s2).toBe(s3);
      },
    );
  });
});
