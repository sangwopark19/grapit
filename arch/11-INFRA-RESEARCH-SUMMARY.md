# 인프라 플랫폼 조사 종합 보고서

> **프로젝트**: Grapit 티켓 예매 플랫폼
> **기술 스택**: Next.js 16 + NestJS 11 + PostgreSQL + Redis
> **대상 사용자**: 한국 (서울 기반)
> **조사 기간**: 2026-03-25 ~ 2026-03-26
> **관련 문서**: 06~10번 문서에 각 플랫폼별 상세 조사 수록

---

## 1. 조사 배경

현재 아키텍처(03-ARCHITECTURE.md)는 **Railway** 기반으로 설계되었으나, Railway의 아시아 리전이 **싱가포르 단일**임이 확인되었다. 한국 사용자 대상 티켓 예매 플랫폼에서 서버 위치가 미치는 영향을 분석하고, 최적의 인프라 플랫폼을 선정하기 위해 종합 조사를 진행하였다.

### 조사 범위

| 단계 | 조사 내용 | 상세 문서 |
|:----:|----------|:---------:|
| 1단계 | Railway 싱가포르 리전의 실제 영향 분석 | 이 문서 2장 |
| 2단계 | 서울 리전 지원 PaaS 대안 조사 (Coolify, Dokploy 등) | 이 문서 3장 |
| 3단계 | 서버리스/엣지 플랫폼 심층 분석 (5개 플랫폼) | 06~08번 문서 |
| 4단계 | Cloud Run vs Railway 최종 비교 | 09번 문서 |
| 5단계 | 개발 도구 생태계 조사 (Skills, CLI, MCP) | 이 문서 6장 |

---

## 2. Railway 싱가포르 리전 — 실제 영향 분석

### 2.1 레이턴시 수치

| 서버 위치 | 한국까지 RTT | 첫 API 호출 | 후속 API 호출 |  
|:---------:|:-----------:|:-----------:|:------------:|
| **서울** | 2~5ms | ~35ms | ~24ms |
| **싱가포르** | 67~80ms | ~360ms | ~154ms |
| **차이** | +65~75ms | +325ms | +130ms |

### 2.2 기능별 영향도

| 기능 | 영향도 | 설명 |
|------|:------:|------|
| 일반 탐색/검색 | 낮음 | 0.1~0.2초 추가, 체감 어려움 |
| **좌석 선택 경쟁** | **높음** | 동일 좌석 클릭 시 130ms 핸디캡, 경쟁에서 체계적 불리 |
| 실시간 WebSocket | 중~높음 | 좌석 상태가 항상 ~80ms 뒤처져 보임 |
| 대기열 | 중간 | 순번 업데이트 지연, 입장 전환 시 80ms 불이익 |
| 결제 | 낮음 | 원래 2~5초 걸리는 과정, +160ms 체감 미미 |

### 2.3 CDN으로 해소 가능한가?

**불가능하다.** Cloudflare가 정적 자원(JS, CSS, 이미지)은 서울 엣지에서 제공하지만, 좌석 선택/잠금, 결제, 대기열, WebSocket 등 **모든 API 호출은 반드시 오리진 서버를 거친다.** 티켓 예매의 레이턴시에 민감한 작업 90%가 CDN 캐싱 불가능한 API 호출이다.

### 2.4 결론

- MVP 초기(소규모 트래픽)에서는 허용 가능
- **인기 공연 티켓 오픈이 시작되면 반드시 서울 리전으로 이전 필요**
- 경쟁사(인터파크 등)는 국내 서버 사용 → 체감 반응 속도에서 열위

---

## 3. 서울 리전 지원 PaaS 대안 조사

Railway를 대체할 수 있는 서울 리전 지원 플랫폼을 조사하였다.

### 3.1 종합 비교표

| 플랫폼 | 서울 | 월 비용 | DX | 관리형 DB | 자동배포 |
|--------|:----:|--------:|:--:|:---------:|:-------:|
| **Coolify + Vultr 서울** | O | $24~48 | 8/10 | 셀프(원클릭) | O |
| **Dokploy + Vultr 서울** | O | $24~48 | 8.5/10 | 셀프(원클릭) | O |
| **GCP Cloud Run 서울** | O | $40~65 | 7/10 | O | O |
| Fly.io 도쿄 | X | $50~55 | 8/10 | O | O |
| Render 싱가포르 | X | $31~43 | 9/10 | O | O |
| AWS Lightsail 서울 | O | $35~50 | 5/10 | 부분 | O |
| Supabase + Fly.io | 부분 | $33~40 | 7/10 | 부분 | O |
| Vercel + 백엔드 분리 | Edge만 | $40~60+ | 7/10 | X | O |
| Naver Cloud 서울 | O | $80~120 | 4/10 | O | 수동 |

### 3.2 탈락 사유

| 플랫폼 | 탈락 사유 |
|--------|----------|
| Fly.io | 서울 리전 없음 (도쿄만), Managed Postgres $38/mo |
| Render | 싱가포르만 — Railway와 동일 문제 |
| DigitalOcean | 서울 리전 없음 |
| Naver Cloud | 엔터프라이즈 요금($80~120/mo), 1인 개발에 과도 |
| AWS App Runner | 서울 리전 미지원 |

### 3.3 유력 후보

1. **Coolify/Dokploy + Vultr 서울** — 최저가, Railway 유사 DX, 서버 관리 필요
2. **GCP Cloud Run 서울** — 완전 관리형, 자동 확장, 높은 학습곡선

---

## 4. 서버리스/엣지 플랫폼 심층 분석

5개 플랫폼을 NestJS 11 + Next.js 16 + PostgreSQL + Redis 스택 기준으로 심층 분석하였다.

### 4.1 종합 비교표

| | Cloudflare Workers | Vercel | AWS Lambda | GCP Cloud Functions | GCP Cloud Run |
|---|:---:|:---:|:---:|:---:|:---:|
| **서울 리전** | O (ICN 엣지) | O (icn1) | O (ap-northeast-2) | O (asia-northeast3) | O (asia-northeast3) |
| **NestJS 호환** | X | △ | △ | △ | **O (네이티브)** |
| **WebSocket** | O (Durable Objects) | X | △ (API GW 별도) | X | **O (네이티브)** |
| **Cold Start** | ~0ms | 200ms~3s | 700~1500ms | = Cloud Run | 1.5~5s |
| **MVP 월 비용** | ~$5~30 | ~$20~40 | ~$107~137 | = Cloud Run | ~$40~65 |
| **1인 개발 DX** | 중상 | 최상(FE한정) | 하 | 중 | 중상 |

### 4.2 플랫폼별 핵심 판단

#### Cloudflare Workers
- **최강점**: Cold start 제로(99.99% warm rate), 이그레스 무료, 서울 엣지 1~5ms
- **치명적 제약**: NestJS 11 실행 불가 (128MB 메모리, 1초 startup, DI 컨테이너 불가)
- **D1(SQLite)**: PostgreSQL 대체 불가 (10GB 한도, 트랜잭션 미지원)
- **결론**: 프론트엔드(Next.js) + 엣지 로직에만 사용 가능, 백엔드는 별도 필요
- 상세: `@opennextjs/cloudflare`로 Next.js 16 배포 가능, Durable Objects로 Redis 대체 가능

#### Vercel
- **최강점**: Next.js 16 최적 환경 (PPR, Turbopack, Streaming SSR 네이티브)
- **치명적 제약**: WebSocket 미지원, DB(Neon/Upstash)에 서울 리전 없음
- **비용 리스크**: 100K DAU 시 ~$1,500/월, 플래시 세일 시 $5,000~10,000+
- **결론**: Next.js 프론트엔드 전용으로만 적합, 백엔드 + DB는 별도 인프라 필수

#### AWS Lambda
- **최강점**: 서울 리전 완벽 지원, 풍부한 AWS 생태계
- **치명적 제약**: 숨겨진 고정비 $54~67/월 (NAT Gateway + RDS Proxy), NestJS cold start 700~1500ms
- **pgboss 불가**: Lambda는 long-running process가 아니므로 SQS로 교체 필요
- **WebSocket 재설계**: NestJS Gateway 사용 불가, API Gateway WebSocket으로 전면 변경
- **결론**: 총 비용 $107~137/월 + 과도한 운영 복잡도, 1인 개발에 비추천

#### GCP Cloud Functions (2nd gen)
- 2024년 8월 "Cloud Run functions"로 개명, **내부적으로 Cloud Run과 동일**
- NestJS 풀 프레임워크에는 Cloud Run Services 직접 사용이 적합
- **별도 분석 불필요, Cloud Run으로 통합**

#### GCP Cloud Run
- **최강점**: NestJS 네이티브 실행(Docker 그대로), WebSocket 네이티브, 서울 리전, 자동 확장
- **주요 제약**: 초기 GCP 학습곡선(서비스 10~12개), NestJS cold start 1.5~5초, Cloud SQL 비용
- **비용**: MVP $40~65/월, 프로덕션 $130~200/월
- **결론**: 코드 수정 최소, 가장 높은 종합 적합도

### 4.3 프로젝트 적합성 점수 (5점 만점)

| 요구사항 | CF Workers | Vercel | Lambda | Cloud Run |
|----------|:---------:|:------:|:------:|:---------:|
| NestJS 11 호환 | 1 | 2 | 2 | **5** |
| 실시간 좌석 (WebSocket) | 4 | 1 | 2 | **4** |
| PostgreSQL 연동 | 3 | 2 | 4 | **4** |
| Redis 연동 | 4 | 2 | 4 | **4** |
| 티켓 오픈 버스트 | **5** | 3 | 3 | 3 |
| 서울 레이턴시 | **5** | 4 | **5** | **5** |
| 1인 개발 운영 부담 | 2 | 4 | 1 | **4** |
| MVP 비용 | **5** | 3 | 1 | **4** |
| 코드 수정 최소화 | 1 | 2 | 2 | **5** |
| **총점 (/45)** | 30 | 23 | 24 | **38** |

---

## 5. Cloud Run vs Railway — 최종 비교

유력 후보 2개를 모든 차원에서 심층 비교하였다.

### 5.1 핵심 수치 비교

| 항목 | Cloud Run (서울) | Railway (싱가포르) |
|------|:---:|:---:|
| 한국 레이턴시 | **2~5ms** | 67~80ms |
| 예매 전체 플로우 | **~300ms** | ~860ms (+560ms) |
| WebSocket 동시 연결 | **100,000+** | 10,000 (하드 리밋) |
| 자동 수평 확장 | **O (100+ 인스턴스)** | X (수동, 42 레플리카) |
| SLA | **99.95% (재정 보상)** | 없음 |
| 초기 설정 시간 | 1~2시간 | **~10분** |
| 학습해야 할 서비스 수 | 10~12개 | **0개** |
| 카나리/트래픽 분할 | **O** | X |
| DB 자동 백업 | **O (시점 복구 7일)** | 수동 (템플릿) |

### 5.2 비용 시나리오

| 단계 | Railway | Cloud Run |
|:----:|--------:|----------:|
| MVP (1K DAU) | **$24/월** | $26~87/월 |
| 성장기 (10K DAU) | **$71/월** | $160/월 |
| 50K 동시접속 버스트 (추가) | $5~10 | $70~90 |
| 50K WebSocket 처리 | **불가능** | 가능 |

> Cloud SQL이 비용 차이의 주 원인 ($12~56/월 vs Railway 통합 PostgreSQL $6~23/월)

### 5.3 좌석 경쟁 시나리오

두 사용자가 같은 좌석을 동시에 클릭할 때:

```
Cloud Run 사용자의 잠금 요청 도착: ~24ms
Railway 사용자의 잠금 요청 도착:   ~154ms
→ Cloud Run 사용자가 130ms 먼저 좌석 확보
→ 모든 사용자가 한국에 있다면, 서울 서버가 전원에게 최적
```

### 5.4 안정성

| | Cloud Run | Railway |
|--|-----------|---------|
| SLA | 99.95% (위반 시 10~50% 크레딧) | 없음 |
| 2025년 DB 장애 | GCP 전체 1건 | **PgBouncer 장애 3건** (9월, 10월, 12월) |
| 데이터센터 이중화 | 서울 3개 가용영역 | 리전당 단일 존 |

### 5.5 가중 점수

| 항목 (가중치) | Cloud Run | Railway |
|---|:-:|:-:|
| 한국 레이턴시 (25%) | **10** | 3 |
| 개발자 경험 (15%) | 6 | **10** |
| WebSocket/실시간 (15%) | **9** | 5 |
| 버스트 트래픽 (15%) | **9** | 6 |
| MVP 비용 (5%) | 7 | **9** |
| 프로덕션 비용 (5%) | 6 | **8** |
| 안정성/SLA (10%) | **10** | 5 |
| 운영 간편성 (5%) | 4 | **10** |
| 확장 한계 (5%) | **10** | 7 |
| **가중 합계** | **8.3/10** | **5.8/10** |

---

## 6. 개발 도구 생태계 비교 (Skills, CLI, MCP)

### 6.1 Claude Code 연동

| | Railway | Cloud Run |
|--|---------|-----------|
| **공식 Claude Code Skill** | **O** (`/railway:use-railway`) | **X** (없음) |
| **공식 MCP 서버** | O (171 stars) | **O** (571 stars, Google 공식) |
| **MCP 배포 기능** | `deploy` | `deploy-file-contents`, `deploy-local-folder` |
| **MCP 로그 조회** | `get-logs` | `get-service-log` |
| **MCP 환경변수 관리** | **O** (`set-variables`) | X |
| **MCP DB 관리** | X | X |
| **커뮤니티 Skill** | — | SKILL.md 수준 2~3개 (프롬프트 가이드) |

> Railway의 Skill은 SKILL.md + 셸 스크립트 + auto-approve hook이 포함된 **풀 플러그인**이지만, Cloud Run 커뮤니티 Skill은 프롬프트 가이드 문서 수준이다.

### 6.2 CLI 비교

| Railway CLI | 기능 | Cloud Run 대응 | 격차 |
|-------------|------|----------------|:----:|
| `railway up` | 배포 | `gcloud run deploy SERVICE --source .` | 동등 |
| `railway init` | 프로젝트 초기화 | `gcloud init` + 수동 설정 | Railway 우위 |
| `railway logs` | 로그 스트리밍 | `gcloud beta run services logs tail` | 동등 |
| `railway ssh` | 컨테이너 접속 | 없음 (서버리스) | Railway 우위 |
| `railway connect` | DB 셸 | `gcloud sql connect INSTANCE` | 동등 |
| `railway add` | DB/Redis 추가 | 없음 (별도 명령어) | Railway 우위 |
| `railway scale` | 스케일링 | `gcloud run services update --min/max-instances` | 동등 |
| `railway variable` | 환경변수 | `gcloud run services update --update-env-vars` | 동등 |
| `railway domain` | 커스텀 도메인 | `gcloud run domain-mappings create` | 동등 |
| — | 트래픽 분할 | `gcloud run services update-traffic` | Cloud Run 우위 |
| — | 배치 작업 | `gcloud run jobs execute` | Cloud Run 우위 |
| — | 로컬 에뮬레이터 | `gcloud beta code dev` | Cloud Run 우위 |

### 6.3 추가 도구

| 도구 | Railway | Cloud Run |
|------|:-------:|:---------:|
| VS Code 확장 | X | **Google Cloud Code** (에뮬레이터, 디버거) |
| AI 콘솔 어시스턴트 | X | **Gemini Cloud Assist** |
| GitHub Actions | 자체 트리거 | **deploy-cloudrun** 공식 Action |
| IaC (Terraform/Pulumi) | 불필요 | 완전 지원 |
| 로컬 개발 에뮬레이터 | X | **gcloud beta code dev** (핫리로드) |
| Skaffold (지속적 개발) | X | **skaffold dev** (변경 감지→자동 빌드→배포) |

### 6.4 DX 격차 요약

```
                      Railway         Cloud Run
                      ───────         ─────────
공식 Claude Skill:    O (/railway)    X
MCP 서버:             O (171★)        O (571★)
전용 CLI:             O (railway)     △ (gcloud run 서브커맨드)
원커맨드 배포:         O               O
DB 원클릭 추가:        O               X
SSH 접속:             O               X
로컬 에뮬레이터:       X               O
트래픽 분할:           X               O
IDE 통합:             X               O
초기 설정:            ~5분             ~60분
일상 배포:            git push         git push (CI/CD 설정 후 동일)
```

**핵심**: DX 격차는 "초기 설정"에 집중되어 있다. 일상 개발 플로우는 거의 동일하다.

---

## 7. 전략 옵션

### Option A: Railway → Cloud Run 이전 전략

```
Phase 1 (MVP, 0~3개월)     → Railway ($24/월)
  - 빠른 출시, 시장 검증
  - Dockerfile 사용 + Railway 종속 기능 회피

Phase 2 (프로덕션, 3개월~)  → Cloud Run ($87~200/월)
  - 티켓 오픈 이벤트 시작 전 이전
  - 마이그레이션 소요: 1~2일
```

| 장점 | 단점 |
|------|------|
| MVP 최속 출시 | 마이그레이션 비용 (1~2일) |
| 초기 비용 최소 ($24/월) | Railway 종속 기능 회피 필요 |
| 시장 검증 후 투자 | 이전 시점 판단 필요 |

### Option B: 처음부터 Cloud Run

```
전 기간 → Cloud Run ($26~200/월)
  - GCP 학습 1~2주 투자
  - 이후 Railway와 동일한 git push 배포
```

| 장점 | 단점 |
|------|------|
| 마이그레이션 불필요 | 초기 1~2주 학습 투자 |
| 서울 레이턴시 처음부터 확보 | MVP 출시 속도 다소 저하 |
| 성장에 바로 대비 가능 | 초기 비용 다소 높음 ($87/월, warm 설정 시) |

### Option C: 하이브리드 (Vercel + Cloud Run)

```
프론트엔드 (Next.js 16)  → Vercel ($20/월)
백엔드 (NestJS + DB)     → Cloud Run ($30~100/월)
```

| 장점 | 단점 |
|------|------|
| Next.js 최적 환경 (Vercel) | 플랫폼 2개 관리 |
| 서울 백엔드 (Cloud Run) | 비용 이중 발생 |
| 각 플랫폼의 장점 활용 | 1인 개발 관리 포인트 증가 |

---

## 8. 최종 권장안

### 권장: Option B — 처음부터 Cloud Run

**근거:**

1. **서비스 본질**: 티켓 예매는 "속도 경쟁"이 핵심. 싱가포르 서버는 태생적 불리하며, CDN으로 해소 불가
2. **WebSocket 한계**: Railway의 10K 동시 연결 제한은 인기 공연 티켓 오픈(50K+)에서 물리적 제약
3. **총 비용 효율**: Option A는 결국 이전해야 하므로, 처음부터 Cloud Run이 총 비용 절감
4. **안정성**: 99.95% SLA + 서울 3개 가용영역, 결제가 오가는 플랫폼에 적합
5. **개발 도구**: MCP 서버(571 stars) + `gcloud run deploy --source .` 원커맨드 배포로 일상 DX는 Railway와 동등

**초기 투자**: GCP 학습 1~2주
**월 비용**: MVP $26~87 → 성장기 $160 → 대규모 $200~340

### Cloud Run 선택 시 아키텍처

```
┌─────────────────────────────────────────────────┐
│                   Cloudflare                     │
│              CDN + WAF + R2 (이미지)              │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
┌───────────────┐           ┌─────────────────┐
│  Cloud Run    │           │   Cloud Run     │
│  Next.js 16   │ ───────▶  │   NestJS 11     │
│  (서울)       │           │   (서울)         │
└───────────────┘           └────────┬────────┘
                                     │
                          ┌──────────┴──────────┐
                          ▼                     ▼
                   ┌────────────┐        ┌───────────┐
                   │ Cloud SQL  │        │  Upstash   │
                   │ PostgreSQL │        │   Redis    │
                   │  (서울)    │        │ (글로벌)    │
                   └────────────┘        └───────────┘

배치 처리: Cloud Run Jobs + Cloud Scheduler
모니터링: Sentry + Cloud Monitoring
```

### Claude Code 워크플로우 구성

```
1. Cloud Run MCP 서버 설치
   → Claude Code에서 "배포해줘", "로그 보여줘" 가능

2. gcloud CLI 권한 설정
   → Claude Code가 gcloud run deploy 실행 가능

3. (선택) 커스텀 Skill 제작
   → Railway Skill 구조 참고, /skill-creator로 스캐폴딩
```

---

## 9. 의사결정 필요 사항

| # | 항목 | 선택지 |
|:-:|------|--------|
| 1 | 인프라 전략 | Option A (Railway→Cloud Run) / **Option B (Cloud Run)** / Option C (하이브리드) |
| 2 | Cold start 비용 | $59/월 추가(항상 대기) vs 첫 요청 1~5초 지연 허용 |
| 3 | Redis 선택 | Upstash ($0~29/월, 외부) vs Memorystore ($44~58/월, GCP 관리형) |
| 4 | 월 인프라 예산 | MVP 단계 허용 범위 |

---

## 부록: 상세 조사 문서 목록

| 문서 | 내용 |
|------|------|
| `06-VERCEL-RESEARCH.md` | Vercel 심층 분석 (서울 리전, Fluid Compute, 제한사항, 비용) |
| `07-GCP-CLOUD-RUN-RESEARCH.md` | GCP Cloud Run/Functions 심층 분석 (서울 가격, 아키텍처, 비용 시나리오) |
| `08-AWS-LAMBDA-RESEARCH.md` | AWS Lambda 심층 분석 (숨겨진 비용, NestJS cold start, WebSocket 재설계) |
| `09-CLOUD-RUN-VS-RAILWAY-COMPARISON.md` | Cloud Run vs Railway 10개 차원 비교 (DX, 비용, 성능, 안정성, 운영) |
| `10-INFRA-DECISION-PROPOSAL.md` | 대표님 논의용 의사결정 제안서 |
