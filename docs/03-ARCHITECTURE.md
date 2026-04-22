# 시스템 아키텍처 문서

## 1. 아키텍처 개요

### 1.1 설계 원칙

- **모듈러 모놀리스:** 마이크로서비스 대신 NestJS Module 기반 단일 배포 단위. 모듈 간 인메모리 호출로 네트워크 오버헤드 제거
- **Just Use Postgres:** PostgreSQL로 검색(tsvector + pg_trgm), Job Queue(SKIP LOCKED / pgboss) 통합. Redis는 실시간 성능이 필수인 영역에만 사용
- **Google Cloud Run 기반 인프라:** Cloud Run + Cloud SQL (서울 리전, asia-northeast3) 기반 배포. 자동 확장, 한국 사용자 2~5ms 레이턴시, 99.95% SLA
- **점진적 확장:** MVP에서 단순하게 시작하고, 실제 트래픽 관측 후 스케일링 결정

### 1.2 고수준 시스템 다이어그램

```mermaid
graph TB
    subgraph Client["클라이언트"]
        WEB["웹 브라우저<br/>(Next.js 16)"]
        MOB["모바일 앱<br/>(Expo SDK 55)"]
    end

    subgraph Cloudflare["Cloudflare"]
        CF_CDN["CDN + WAF"]
        CF_R2["R2<br/>(이미지/SVG)"]
    end

    subgraph GCP["Google Cloud Platform (서울, asia-northeast3)"]
        NEXT["Cloud Run: web<br/>(Next.js 16 Standalone)"]
        API["Cloud Run: api<br/>(NestJS 11 모듈러 모놀리스)"]
        PG["Cloud SQL<br/>(PostgreSQL 16)"]
    end

    subgraph Redis["외부 서비스"]
        RD["Upstash Redis<br/>(좌석점유/대기열/실시간)"]
    end

    subgraph External["외부 시스템"]
        PGW["PG사<br/>(KG이니시스 등)"]
        KP["카카오페이/<br/>네이버페이"]
        SMS["SMS/알림톡"]
        EMAIL["이메일"]
        OAUTH["소셜 로그인<br/>(카카오/네이버)"]
    end

    subgraph Monitoring["모니터링"]
        SENTRY["Sentry<br/>(에러 추적)"]
        GCM["Cloud Monitoring<br/>(GCP 내장)"]
    end

    WEB --> CF_CDN
    MOB --> CF_CDN
    CF_CDN --> NEXT
    CF_CDN --> API

    NEXT --> API

    API --> PG
    API --> RD
    API --> CF_R2
    API --> PGW
    API --> KP
    API --> SMS
    API --> EMAIL
    API --> OAUTH

    API --> SENTRY
    API --> GCM
    NEXT --> SENTRY
```

### 1.3 기술 스택

| 계층 | 기술 | 선정 이유 |
|------|------|-----------|
| **프론트엔드** | Next.js 16 (App Router, React 19, TypeScript 5.9) | SSR/SSG 하이브리드, SEO 최적화, Turbopack 기본 |
| **모바일** | Expo SDK 55 (React Native 0.83, React 19.2) | New Architecture 전용, Expo Router, 웹과 로직 공유 |
| **런타임** | Node.js 22 LTS (Jod) | Next.js 16 / NestJS 11 / Expo 모두 호환 (>= 20.9.0) |
| **백엔드** | NestJS 11 (모듈러 모놀리스) | TypeScript 통일, 모듈 기반 관심사 분리, 모노레포 공유 가능 |
| **인증** | @nestjs/jwt + @nestjs/passport | 자체 JWT 인증 + Passport Strategy (카카오/네이버) |
| **메인 DB** | Cloud SQL for PostgreSQL 16 (서울 리전) | ACID 트랜잭션, 좌석 예매 동시성 처리, 자동 백업(7일 시점 복구) |
| **캐시/실시간** | Upstash Redis (글로벌, 서버리스) | 좌석 임시 점유, 대기열, 랭킹 캐시, 실시간 pub/sub |
| **검색** | PostgreSQL (pg_trgm + tsvector) | 공연 검색, 자동완성 — Elasticsearch 불필요 |
| **비동기 Job Queue** | PostgreSQL (pgboss / SKIP LOCKED) | 비동기 처리 (알림, 정산) — Kafka 불필요 |
| **오브젝트 스토리지** | Cloudflare R2 | S3 호환 API, 이그레스 비용 무료, 포스터/좌석 배치도 SVG |
| **CDN / WAF** | Cloudflare (무료 플랜) | 정적 자원 캐싱, DDoS 방어, WAF 레이트 리밋 |
| **배포 플랫폼** | Google Cloud Run (서울, asia-northeast3) | 자동 확장, 서울 2~5ms 레이턴시, 99.95% SLA, 카나리 배포 |
| **CI/CD** | GitHub Actions + deploy-cloudrun | Workload Identity Federation(OIDC), 이미지 빌드→Artifact Registry→Cloud Run 배포 |
| **에러 추적** | Sentry (무료 티어) | 프론트/백엔드 에러 추적, 소스맵 지원 |
| **로깅/메트릭** | Cloud Logging + Cloud Monitoring + Sentry | 구조화된 JSON 로그, 분산 트레이싱, 커스텀 대시보드 |

---

## 2. 프론트엔드 아키텍처

### 2.1 라우팅 구조 (분석된 URL 패턴 기반)

```
app/
├── (portal)/
│   └── ticket/
│       └── page.tsx                    # 티켓 홈
├── contents/
│   ├── genre/
│   │   └── [genre]/
│   │       └── page.tsx                # 장르별 카테고리
│   ├── ranking/
│   │   └── page.tsx                    # 랭킹 (?genre=)
│   ├── notice/
│   │   ├── page.tsx                    # 오픈예정 목록
│   │   └── detail/
│   │       └── [id]/
│   │           └── page.tsx            # 오픈예정 상세
│   ├── search/
│   │   └── page.tsx                    # 검색
│   ├── bridge/
│   │   └── [id]/
│   │       └── page.tsx                # 브릿지 페이지
│   └── guide/
│       └── manual/
│           └── page.tsx                # 판매 안내
├── goods/
│   └── [goodsId]/
│       └── page.tsx                    # 공연 상세
├── place/
│   └── page.tsx                        # 공연장
├── waiting/
│   └── page.tsx                        # 대기열
├── onestop/
│   ├── seat/
│   │   └── page.tsx                    # 좌석 선택
│   ├── order/
│   │   └── page.tsx                    # 결제
│   └── complete/
│       └── page.tsx                    # 예매 완료
├── play/
│   └── performance/
│       └── [slug]/
│           └── page.tsx                # 공연 상세 정보
└── layout.tsx                          # 공통 레이아웃 (GNB, Footer)
```

### 2.2 상태관리 전략

| 상태 유형 | 도구 | 용도 |
|-----------|------|------|
| 서버 상태 | React Query (TanStack Query) | API 데이터 페칭, 캐싱, 재검증 |
| 전역 클라이언트 상태 | Zustand | 사용자 세션, 예매 프로세스 상태 |
| URL 상태 | Next.js searchParams | 필터, 정렬, 페이지네이션 |
| 폼 상태 | React Hook Form | 예매자 정보, 결제 폼 |
| 실시간 상태 | WebSocket / SSE | 좌석 점유 실시간 업데이트, 대기열 순번 |

### 2.3 컴포넌트 계층 구조

```
components/
├── common/
│   ├── Layout/           # GNB, Footer, PageLayout
│   ├── Button/           # Primary, Secondary, Ghost, Icon
│   ├── Badge/            # 단독판매, 좌석우위, NEW, D-day
│   ├── Card/             # PerformanceCard, TimeDealCard, RankingCard
│   ├── Modal/            # Dialog, BottomSheet, Alert
│   ├── Toast/            # 알림 토스트
│   ├── Tab/              # GenreTab, DetailTab
│   ├── Carousel/         # Swiper 기반 슬라이더
│   ├── Form/             # Input, Select, Checkbox, Radio
│   ├── Calendar/         # 날짜 선택 캘린더
│   ├── Countdown/        # 타임딜 카운트다운
│   ├── Skeleton/         # 로딩 스켈레톤
│   └── Empty/            # 빈 상태
├── features/
│   ├── auth/             # LoginForm, SocialLogin
│   ├── search/           # SearchBar, SearchFilter, SearchResult
│   ├── performance/      # PerformanceInfo, CastingInfo, PriceTable
│   ├── booking/
│   │   ├── SeatMap/      # SVG 좌석 배치도
│   │   ├── SeatPanel/    # 선택 좌석 패널
│   │   ├── SchedulePicker/ # 날짜/회차 선택
│   │   └── GradePrice/   # 등급별 가격 표시
│   ├── payment/          # PaymentForm, PaymentMethod, CouponApply
│   ├── ranking/          # RankingList, RankingCard
│   ├── promotion/        # TimeDeal, FinalCall, EarlyBird
│   └── review/           # ReviewList, ReviewForm, ExpectationForm
└── pages/                # 페이지별 컴포넌트 조합
```

---

## 3. 백엔드 아키텍처

### 3.1 모듈러 모놀리스 구조

마이크로서비스 대신 NestJS Module 시스템으로 관심사를 분리합니다. 단일 프로세스 내 인메모리 함수 호출로 서비스 간 통신 오버헤드를 제거합니다.

```
src/
├── main.ts                     # 앱 엔트리 (0.0.0.0:$PORT 바인딩)
├── app.module.ts               # 루트 모듈
├── common/
│   ├── guards/                 # AuthGuard (JWT 검증), RolesGuard
│   ├── interceptors/           # LoggingInterceptor, TimeoutInterceptor
│   ├── filters/                # HttpExceptionFilter
│   ├── decorators/             # @CurrentUser, @Public
│   └── pipes/                  # ValidationPipe
├── modules/
│   ├── auth/                   # 인증 (JWT + Passport + 소셜 로그인)
│   ├── user/                   # 회원 관리
│   ├── performance/            # 공연 카탈로그 + 검색
│   ├── booking/                # 예매 + 좌석 + 대기열 (핵심 트랜잭션 통합)
│   ├── payment/                # 결제 + 환불
│   ├── notification/           # 알림 (pgboss worker)
│   ├── promotion/              # 프로모션 + 랭킹 + 쿠폰
│   └── venue/                  # 공연장 + 좌석 배치도
├── jobs/
│   └── worker.module.ts        # pgboss Job Worker (알림, 정산, 랭킹 갱신)
└── config/
    ├── database.config.ts      # TypeORM/Prisma 설정
    └── redis.config.ts         # Redis 연결 설정
```

**모듈 통합 근거:**
- `booking` 모듈: Seat + Reservation을 통합. 좌석 점유 → 예매 생성이 같은 트랜잭션 내에서 처리되어야 하므로 분리 불필요
- `promotion` 모듈: Promotion + Ranking + Coupon 통합. 모두 같은 공연 데이터 기반으로 동작
- `performance` 모듈: 공연 카탈로그 + 검색 통합. 검색 대상이 performances 테이블 단일

### 3.2 API 설계 (RESTful 엔드포인트 목록)

#### 공연 (Performance)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/performances` | 공연 목록 (장르, 필터, 페이지네이션) |
| GET | `/api/v1/performances/:id` | 공연 상세 |
| GET | `/api/v1/performances/:id/schedules` | 공연 회차 목록 |
| GET | `/api/v1/performances/:id/castings` | 캐스팅 정보 |
| GET | `/api/v1/performances/:id/casting-schedule` | 캐스팅 일정 |
| GET | `/api/v1/performances/:id/reviews` | 관람후기 |
| GET | `/api/v1/performances/:id/expectations` | 기대평 |
| GET | `/api/v1/performances/ranking` | 랭킹 |

#### 검색 (Search)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/search` | 통합 검색 (PostgreSQL tsvector) |
| GET | `/api/v1/search/autocomplete` | 자동완성 (pg_trgm) |

#### 예매 (Reservation)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v1/reservations/queue` | 대기열 진입 |
| GET | `/api/v1/reservations/queue/:token/status` | 대기열 상태 조회 |
| GET | `/api/v1/schedules/:id/seats` | 좌석 현황 조회 |
| POST | `/api/v1/seats/lock` | 좌석 임시 점유 |
| DELETE | `/api/v1/seats/lock/:lockId` | 좌석 점유 해제 |
| POST | `/api/v1/reservations` | 예매 생성 |
| GET | `/api/v1/reservations/:id` | 예매 상세 |
| PUT | `/api/v1/reservations/:id/cancel` | 예매 취소 |

#### 결제 (Payment)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v1/payments` | 결제 요청 |
| POST | `/api/v1/payments/confirm` | 결제 승인 |
| POST | `/api/v1/payments/:id/refund` | 환불 요청 |
| GET | `/api/v1/payments/:id` | 결제 상세 |

#### 사용자 (User)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/v1/auth/login` | 로그인 |
| POST | `/api/v1/auth/register` | 회원가입 |
| POST | `/api/v1/auth/refresh` | 토큰 갱신 |
| POST | `/api/v1/auth/social/:provider` | 소셜 로그인 (카카오/네이버) |
| GET | `/api/v1/users/me` | 내 정보 |
| GET | `/api/v1/users/me/reservations` | 내 예매 내역 |
| POST | `/api/v1/users/me/ticket-cast` | 티켓캐스트 등록 |

#### 프로모션 (Promotion)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/promotions` | 프로모션 목록 |
| GET | `/api/v1/promotions/time-deals` | 타임딜 목록 |
| POST | `/api/v1/coupons/apply` | 쿠폰 적용 |

#### 공연장 (Venue)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/v1/venues` | 공연장 목록 |
| GET | `/api/v1/venues/:id` | 공연장 상세 |
| GET | `/api/v1/venues/:id/seat-map` | 좌석 배치도 |

#### 헬스체크
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/health` | Cloud Run 헬스체크 (DB + Redis 연결 확인) |

### 3.3 인증/인가 플로우

별도 Auth 서비스 없이 NestJS 내장 모듈로 처리합니다. iframe 기반 Silent Refresh 대신 단순한 Refresh Token Rotation을 사용합니다.

```mermaid
sequenceDiagram
    participant U as 사용자
    participant F as 프론트엔드 (Next.js)
    participant A as API (NestJS AuthModule)
    participant DB as PostgreSQL

    U->>F: 로그인 요청
    F->>A: POST /auth/login (credentials)
    A->>DB: 사용자 확인 + bcrypt 검증
    A-->>F: Access Token (15분) + Refresh Token (httpOnly Cookie, 7일)

    Note over F,A: 일반 API 요청
    F->>A: API 요청 (Bearer Token)
    A->>A: AuthGuard — JWT 검증 (인메모리, DB 조회 없음)
    A-->>F: API 응답

    Note over F,A: Access Token 만료 시
    F->>A: POST /auth/refresh (httpOnly Cookie 자동 전송)
    A->>DB: Refresh Token 검증 + Rotation (기존 토큰 폐기, 새 토큰 발급)
    A-->>F: 새 Access Token + 새 Refresh Token (Cookie)

    Note over F,A: 소셜 로그인
    U->>F: 카카오 로그인 버튼 클릭
    F->>A: POST /auth/social/kakao (authorization_code)
    A->>A: passport-kakao Strategy 검증
    A->>DB: 사용자 조회 또는 자동 가입
    A-->>F: Access Token + Refresh Token
```

**기존 대비 단순화:**
- ~~API Gateway (Kong) → Auth Service → 마이크로서비스~~ → NestJS `AuthGuard` 인메모리 JWT 검증 (1 hop → 0 hop)
- ~~Keycloak/Auth0~~ → `@nestjs/jwt` + `@nestjs/passport` 자체 구현
- ~~iframe Silent Refresh~~ → httpOnly Cookie + Refresh Token Rotation (3rd-party cookie 제한 문제 회피)

### 3.4 좌석 예매 동시성 처리 전략

#### 비관적 잠금 (Pessimistic Locking) + TTL 기반 임시 점유

```mermaid
sequenceDiagram
    participant U1 as 사용자 A
    participant U2 as 사용자 B
    participant API as NestJS (BookingModule)
    participant Redis as Redis
    participant DB as PostgreSQL

    U1->>API: 좌석 A-1 선택
    API->>Redis: SET seat:schedule123:A-1 = userA (NX, EX 600)
    Redis-->>API: OK (성공)
    API-->>U1: 좌석 점유 성공 (10분 TTL)

    U2->>API: 좌석 A-1 선택
    API->>Redis: SET seat:schedule123:A-1 = userB (NX, EX 600)
    Redis-->>API: FAIL (이미 존재)
    API-->>U2: 좌석 이미 선택됨

    Note over U1,DB: 결제 완료 시
    U1->>API: 결제 완료
    API->>DB: BEGIN TRANSACTION
    API->>DB: UPDATE seat_inventory SET status='SOLD' WHERE seat_id='A-1' AND status='AVAILABLE'
    API->>DB: INSERT INTO reservation (...)
    API->>DB: COMMIT
    API->>Redis: DEL seat:schedule123:A-1
    API-->>U1: 예매 완료

    Note over U1,Redis: TTL 만료 시 (미결제)
    Redis-->>Redis: 키 자동 삭제 (10분 후)
    Note over Redis: 좌석 자동 해제
```

**핵심 전략:**

1. **Redis SET NX (Not eXists):** 좌석 선택 시 Redis에 원자적 잠금. 이미 점유된 좌석은 즉시 거부.
2. **TTL 600초 (10분):** 결제 미완료 시 자동 해제. 타이머는 프론트에서도 표시.
3. **DB 트랜잭션:** 최종 결제 시 PostgreSQL 트랜잭션으로 데이터 정합성 보장.
4. **WebSocket/SSE:** 좌석 상태 변경을 실시간으로 다른 사용자에게 브로드캐스트. Cloud Run은 WebSocket/SSE를 네이티브 지원 (별도 헤더 설정 불필요).
5. **멀티 인스턴스 브로드캐스트:** Cloud Run이 여러 인스턴스로 스케일 아웃될 때, 각 인스턴스의 WebSocket 클라이언트에게 이벤트를 전달하기 위해 Redis Pub/Sub를 백엔드로 사용. 좌석 상태 변경 시 Redis 채널에 publish → 모든 인스턴스의 subscriber가 수신 → 각 인스턴스 내 WebSocket 클라이언트에게 전달. Sticky session은 불필요 (stateless pub/sub 패턴).

#### 대기열 시스템

```mermaid
flowchart TD
    A["사용자 요청"] --> B{"트래픽 임계값<br/>초과?"}
    B -->|No| C["바로 좌석 선택<br/>페이지 진입"]
    B -->|Yes| D["대기열 진입<br/>/waiting?key=token"]
    D --> E["Redis Sorted Set<br/>score=타임스탬프"]
    E --> F{"순번 도달?"}
    F -->|No| G["대기 중<br/>(Polling/SSE)"]
    G --> F
    F -->|Yes| H["입장 토큰 발급"]
    H --> C
    C --> I["좌석 선택"]
```

---

## 4. 데이터베이스 설계

### 4.1 ERD

```mermaid
erDiagram
    users ||--o{ reservations : makes
    users ||--o{ ticket_casts : registers
    users ||--o{ reviews : writes
    users ||--o{ user_coupons : owns

    performances ||--|{ schedules : has
    performances ||--o{ castings : features
    performances ||--o{ reviews : receives
    performances ||--o{ ticket_casts : notifies
    performances }|--|| venues : hosted_at
    performances }|--|| genres : belongs_to

    venues ||--|{ seat_maps : defines
    seat_maps ||--|{ seats : contains

    schedules ||--|{ seat_inventories : tracks
    seats ||--|{ seat_inventories : mapped_to

    reservations ||--|{ reservation_items : contains
    reservations ||--|| payments : paid_by
    reservation_items }|--|| seat_inventories : occupies

    promotions ||--o{ promotion_performances : applies
    promotions ||--o{ coupons : generates
    coupons ||--o{ user_coupons : distributed

    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar name
        varchar phone
        varchar membership_grade
        boolean is_verified
        timestamp created_at
        timestamp updated_at
    }

    performances {
        uuid id PK
        varchar title
        uuid genre_id FK
        uuid venue_id FK
        date start_date
        date end_date
        int duration_minutes
        varchar age_restriction
        varchar status
        text description
        varchar poster_url
        varchar sale_type
        tsvector search_vector "GENERATED (title + description)"
        timestamp created_at
    }

    genres {
        uuid id PK
        varchar name
        varchar slug
        int sort_order
    }

    venues {
        uuid id PK
        varchar name
        varchar address
        varchar region
        varchar phone
        float latitude
        float longitude
    }

    schedules {
        uuid id PK
        uuid performance_id FK
        date show_date
        time show_time
        int session_number
        varchar status
        timestamp booking_open_at
        timestamp cancel_deadline
    }

    seat_maps {
        uuid id PK
        uuid venue_id FK
        varchar hall_name
        text svg_data
        jsonb seat_config
    }

    seats {
        uuid id PK
        uuid seat_map_id FK
        varchar section
        varchar grade
        varchar row_label
        varchar seat_number
        float x_position
        float y_position
    }

    seat_inventories {
        uuid id PK
        uuid schedule_id FK
        uuid seat_id FK
        int price
        varchar status
        timestamp locked_until
        uuid locked_by
    }

    reservations {
        uuid id PK
        uuid user_id FK
        uuid schedule_id FK
        varchar reservation_number UK
        varchar status
        int total_amount
        int discount_amount
        int final_amount
        timestamp cancel_deadline
        timestamp created_at
    }

    reservation_items {
        uuid id PK
        uuid reservation_id FK
        uuid seat_inventory_id FK
        varchar grade
        int price
    }

    payments {
        uuid id PK
        uuid reservation_id FK
        varchar method
        varchar pg_provider
        varchar pg_transaction_id
        int amount
        varchar status
        timestamp paid_at
        timestamp refunded_at
    }

    promotions {
        uuid id PK
        varchar type
        varchar title
        int discount_rate
        int discount_amount
        timestamp start_at
        timestamp end_at
        jsonb conditions
    }

    coupons {
        uuid id PK
        uuid promotion_id FK
        varchar code UK
        int discount_value
        varchar discount_type
        timestamp expires_at
    }

    castings {
        uuid id PK
        uuid performance_id FK
        varchar actor_name
        varchar role_name
        varchar profile_image_url
    }
```

### 4.2 주요 인덱싱 전략

| 테이블 | 인덱스 | 타입 | 용도 |
|--------|--------|------|------|
| `performances` | `(genre_id, status, start_date)` | B-Tree | 장르별 카테고리 조회 |
| `performances` | `(status, title)` | GIN (pg_trgm) | 자동완성, LIKE 검색 |
| `performances` | `(search_vector)` | GIN (tsvector) | 전체 텍스트 검색 (title, description 기반) |
| `schedules` | `(performance_id, show_date, status)` | B-Tree | 캘린더 조회 |
| `seat_inventories` | `(schedule_id, status)` | B-Tree | 좌석 현황 조회 |
| `seat_inventories` | `(schedule_id, seat_id)` | Unique | 동시성 제어 |
| `reservations` | `(user_id, created_at DESC)` | B-Tree | 내 예매 내역 |
| `reservations` | `(reservation_number)` | Unique | 예매번호 조회 |
| `payments` | `(pg_transaction_id)` | Unique | PG 트랜잭션 조회 |

### 4.3 PostgreSQL 기반 검색 전략 (Elasticsearch 대체)

Elasticsearch를 제거하고 PostgreSQL 내장 기능으로 검색을 처리합니다.

#### 전체 텍스트 검색 (tsvector)

```sql
-- performances 테이블에 검색 벡터 컬럼 추가
ALTER TABLE performances ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) STORED;

CREATE INDEX idx_performances_search ON performances USING GIN (search_vector);

-- 검색 쿼리
SELECT *, ts_rank(search_vector, plainto_tsquery('simple', '뮤지컬')) AS rank
FROM performances
WHERE search_vector @@ plainto_tsquery('simple', '뮤지컬')
ORDER BY rank DESC;
```

#### 자동완성 (pg_trgm)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_performances_title_trgm ON performances USING GIN (title gin_trgm_ops);

-- 자동완성 쿼리 (유사도 기반)
SELECT title, similarity(title, '레미') AS sim
FROM performances
WHERE title % '레미'
ORDER BY sim DESC
LIMIT 10;
```

#### 적용 근거
- 공연 데이터는 수십만 건 이하로 PostgreSQL FTS 성능 범위 내
- 한국어 검색은 `simple` 파서 + trigram 조합으로 충분
- Elasticsearch 클러스터 운영 비용 및 데이터 동기화 복잡도 제거

#### 한국어 검색 한계 및 대응

> **주의:** `'simple'` 파서는 한국어 형태소 분석을 지원하지 않습니다. "뮤지컬"을 "뮤지" 또는 "지컬"로 검색 시 매칭되지 않을 수 있습니다.
>
> **현재 대응:** `pg_trgm`의 trigram 유사도 검색으로 부분 문자열 매칭을 보완합니다.
>
> **향후 고도화:** 검색 품질 이슈 발생 시 `textsearch_ko` (mecab 기반 한국어 사전) 확장을 도입하거나, Cloud SQL에서 지원하지 않을 경우 애플리케이션 레벨에서 형태소 분석 후 검색 벡터를 업데이트하는 방식을 검토합니다.

### 4.4 PostgreSQL 기반 비동기 Job Queue (Kafka 대체)

Kafka를 제거하고 PostgreSQL의 `SKIP LOCKED`를 활용한 Job Queue로 대체합니다. NestJS 환경에서는 `pgboss` 라이브러리를 사용합니다.

#### Job Queue 테이블 구조

```sql
CREATE TABLE job_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name varchar(64) NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  status varchar(20) NOT NULL DEFAULT 'pending',  -- pending, active, completed, failed
  priority int NOT NULL DEFAULT 0,
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text
);

CREATE INDEX idx_job_queue_fetch ON job_queue (queue_name, status, scheduled_at)
  WHERE status = 'pending';
```

#### Worker 폴링 (SKIP LOCKED)

```sql
-- 워커가 작업을 가져올 때 (원자적, 경합 없음)
UPDATE job_queue
SET status = 'active', started_at = now()
WHERE id = (
  SELECT id FROM job_queue
  WHERE queue_name = 'notification'
    AND status = 'pending'
    AND scheduled_at <= now()
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

#### 사용 대상 큐
| 큐 이름 | 용도 | 예상 처리량 |
|---------|------|------------|
| `notification` | 예매 완료 알림, 티켓캐스트 알림 발송 | ~100/분 |
| `settlement` | 정산 처리 | ~10/분 |
| `ranking_update` | 랭킹 데이터 갱신 | ~1/분 |
| `email` | 이메일 발송 | ~50/분 |

#### 적용 근거
- 위 처리량은 Kafka 없이 PostgreSQL + pgboss Worker로 충분히 처리 가능
- 메시지 유실 방지: DB 트랜잭션으로 at-least-once 보장
- pgboss는 NestJS와 네이티브 통합되며, 지연 작업/반복 작업/재시도를 지원

### 4.5 인프라 단순화 설계 원칙

> **"Just Use Postgres" 선택적 적용 원칙**

| 역할 | 기존 | 변경 | 근거 |
|------|------|------|------|
| 메인 DB | PostgreSQL | PostgreSQL | 유지 |
| 검색 엔진 | Elasticsearch | PostgreSQL (tsvector + pg_trgm) | 공연 수 규모에서 충분, 동기화 복잡도 제거 |
| 메시지 큐 | Kafka (MSK) | PostgreSQL (SKIP LOCKED / pgboss) | 처리량이 Kafka 불필요, 비용 절감 |
| 좌석 점유 | Redis | Redis | **유지** — 10만 동시접속 원자적 잠금 필수 |
| 대기열 | Redis Sorted Set | Redis Sorted Set | **유지** — 초당 10,000+ write 성능 필수 |
| 실시간 pub/sub | Redis | Redis | **유지** — WebSocket 브로드캐스트 백엔드 |
| 랭킹 캐시 | Redis | Redis | **유지** — 높은 읽기 빈도 |
| 오브젝트 스토리지 | AWS S3 | Cloudflare R2 | S3 호환 API, 이그레스 비용 무료 |
| 로깅 | ELK Stack | Cloud Logging (GCP 내장) | 구조화된 JSON 로그, 별도 인프라 불필요 |

**최종 인프라 구성: Cloud SQL(PostgreSQL) + Upstash Redis + Cloudflare R2 (3-tier)**

---

## 5. 인프라 & DevOps (Google Cloud Run)

### 5.1 GCP 프로젝트 구성

```mermaid
graph TB
    subgraph GCP["Google Cloud Platform (서울, asia-northeast3)"]
        subgraph Production["Environment: production"]
            WEB_SVC["Cloud Run: web<br/>(Next.js 16 Standalone)"]
            API_SVC["Cloud Run: api<br/>(NestJS 11)"]
            PG_SVC["Cloud SQL<br/>(PostgreSQL 16)"]
        end

        subgraph Staging["Environment: staging"]
            WEB_STG["Cloud Run: web-staging"]
            API_STG["Cloud Run: api-staging"]
            PG_STG["Cloud SQL (staging 인스턴스)"]
        end

        AR["Artifact Registry<br/>(컨테이너 이미지)"]
        SM["Secret Manager<br/>(시크릿 관리)"]
        CS["Cloud Scheduler<br/>(크론 작업)"]
        JOBS["Cloud Run Jobs<br/>(배치 처리)"]
    end

    subgraph External["외부 서비스"]
        UPSTASH["Upstash Redis<br/>(글로벌, 서버리스)"]
    end

    API_SVC --> PG_SVC
    API_SVC --> UPSTASH
    WEB_SVC --> API_SVC
    CS --> JOBS
```

#### Cloud Run 서비스 구성

| 서비스 | 소스 | 빌드 방식 | 리전 | 역할 |
|--------|------|-----------|------|------|
| `web` | `apps/web` (모노레포) | Dockerfile (standalone) | asia-northeast3 (서울) | Next.js SSR/SSG |
| `api` | `apps/api` (모노레포) | Dockerfile (multi-stage) | asia-northeast3 (서울) | NestJS API + pgboss Worker |
| Cloud SQL | GCP 관리형 | PostgreSQL 16 | asia-northeast3 (서울) | 메인 DB + 검색 + Job Queue |
| Upstash Redis | 외부 서비스 | 서버리스 | 글로벌 (서울 엣지) | 좌석 점유, 대기열, 실시간 |

### 5.2 Cloud Run 배포 설정

#### Next.js Standalone 배포

```dockerfile
# apps/web/Dockerfile
FROM node:22-alpine AS base

FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 8080
ENV PORT=8080
CMD ["node", "server.js"]
```

```typescript
// next.config.ts
export default {
  output: 'standalone',  // Cloud Run 컨테이너 배포 필수
};
```

#### NestJS 배포

```typescript
// main.ts — Cloud Run 설정
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  // Cloud Run은 PORT 환경변수를 자동 주입 (기본 8080)
  await app.listen(process.env.PORT || 8080, '0.0.0.0');
}
```

```dockerfile
# apps/api/Dockerfile
FROM node:22-alpine AS base

FROM base AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 8080
ENV PORT=8080
CMD ["node", "dist/main.js"]
```

#### Cloud Run 서비스 설정

```bash
# API 서비스 배포 예시
gcloud run deploy api \
  --image asia-northeast3-docker.pkg.dev/PROJECT_ID/grabit/api:latest \
  --region asia-northeast3 \
  --platform managed \
  --port 8080 \
  --cpu 2 \
  --memory 1Gi \
  --min-instances 0 \
  --max-instances 100 \
  --concurrency 80 \
  --timeout 300 \
  --set-env-vars NODE_ENV=production \
  --set-secrets JWT_SECRET=jwt-secret:latest \
  --add-cloudsql-instances PROJECT_ID:asia-northeast3:grabit-db \
  --allow-unauthenticated
```

### 5.3 서비스 간 통신

Cloud Run 서비스 간 통신은 HTTPS를 통해 이루어집니다. 같은 리전(서울) 내 서비스 간 호출은 ~1ms 레이턴시를 보장합니다.

| From | To | 주소 | 프로토콜 |
|------|----|------|----------|
| `web` | `api` | `https://api-HASH-du.a.run.app` 또는 커스텀 도메인 | HTTPS |
| `api` | Cloud SQL | Cloud SQL Auth Proxy (Unix Socket) | TCP (VPC 내부) |
| `api` | Upstash Redis | `REDIS_URL` (TLS) | TCP/TLS |

> **Cloud SQL 연결:** Cloud Run에서 Cloud SQL로의 연결은 `--add-cloudsql-instances` 플래그로 Cloud SQL Auth Proxy를 자동 설정합니다. Unix Socket 경로: `/cloudsql/PROJECT:asia-northeast3:grabit-db`

### 5.4 환경 변수 관리

GCP Secret Manager와 Cloud Run 환경 변수를 조합하여 관리합니다.

```bash
# Cloud SQL 연결 (Cloud SQL Auth Proxy 사용)
DATABASE_URL=postgresql://user:password@/grabit?host=/cloudsql/PROJECT_ID:asia-northeast3:grabit-db

# Upstash Redis (Upstash 콘솔에서 발급)
REDIS_URL=rediss://default:PASSWORD@HOST:PORT

# 서비스 간 참조
API_URL=https://api-HASH-du.a.run.app

# 민감 정보 → Secret Manager로 관리
# 생성: gcloud secrets create jwt-secret --data-file=- <<< "YOUR_SECRET"
# 마운트: --set-secrets=JWT_SECRET=jwt-secret:latest
JWT_SECRET=<Secret Manager 참조>
JWT_REFRESH_SECRET=<Secret Manager 참조>

# 일반 환경 변수 → Cloud Run 환경 변수로 설정
KAKAO_CLIENT_ID=<클라이언트 ID>
NAVER_CLIENT_ID=<클라이언트 ID>
CLOUDFLARE_R2_ACCESS_KEY=<키>
CLOUDFLARE_R2_SECRET_KEY=<키>
CLOUDFLARE_R2_BUCKET=<버킷명>
PG_MERCHANT_KEY=<PG사 키>
SENTRY_DSN=<DSN>
```

### 5.5 CI/CD 파이프라인

```mermaid
flowchart LR
    A["git push"] --> B{"branch?"}
    B -->|feature/*| C["GitHub Actions<br/>빌드 + 테스트"]
    B -->|develop| D["GitHub Actions →<br/>Cloud Run staging 배포"]
    B -->|main| E["GitHub Actions →<br/>Cloud Run production 배포"]

    C --> F["PR 리뷰"]
    E --> G["카나리 배포<br/>(트래픽 10% → 100%)"]
    G --> H["100% 트래픽 전환"]
```

```yaml
# .github/workflows/deploy-api.yml
name: Deploy API to Cloud Run

on:
  push:
    branches: [main, develop]
    paths: ['apps/api/**']

env:
  PROJECT_ID: grabit-project
  REGION: asia-northeast3
  REGISTRY: asia-northeast3-docker.pkg.dev
  SERVICE_NAME: api

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write  # Workload Identity Federation (OIDC)

    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: projects/${{ vars.PROJECT_NUM }}/locations/global/workloadIdentityPools/github/providers/github
          service_account: github-actions@${{ env.PROJECT_ID }}.iam.gserviceaccount.com

      - uses: google-github-actions/setup-gcloud@v2

      - name: Configure Docker for Artifact Registry
        run: gcloud auth configure-docker ${{ env.REGISTRY }}

      - name: Build and Push Image
        run: |
          docker build -t ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/grabit/${{ env.SERVICE_NAME }}:${{ github.sha }} ./apps/api
          docker push ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/grabit/${{ env.SERVICE_NAME }}:${{ github.sha }}

      - name: Deploy to Cloud Run
        uses: google-github-actions/deploy-cloudrun@v2
        with:
          service: ${{ env.SERVICE_NAME }}
          region: ${{ env.REGION }}
          image: ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/grabit/${{ env.SERVICE_NAME }}:${{ github.sha }}
```

**배포 흐름:**
1. GitHub push → GitHub Actions가 Docker 이미지 빌드 + Artifact Registry 푸시
2. `google-github-actions/deploy-cloudrun@v2` 액션으로 Cloud Run 자동 배포
3. 새 리비전 생성 → 헬스체크(`/api/health`) 통과 후 트래픽 전환 (Zero-downtime)
4. 카나리 배포: `gcloud run deploy --tag canary --no-traffic` → 검증 후 `gcloud run services update-traffic --to-latest`
5. 롤백: `gcloud run services update-traffic api --to-revisions=REVISION=100 --region=asia-northeast3`

> **인증:** Workload Identity Federation(OIDC)을 사용하여 GitHub Actions에서 GCP에 접근합니다. 장기 서비스 계정 키 대신 단기 토큰을 사용하므로 보안이 강화됩니다.

### 5.6 CDN & 캐싱 전략

Cloudflare를 Cloud Run 앞단에 배치하여 CDN, WAF, DDoS 방어를 처리합니다.

| 계층 | 대상 | TTL | 전략 |
|------|------|-----|------|
| Cloudflare CDN | 정적 자원 (JS, CSS, 이미지) | 1년 | 파일 해시 기반 캐시 버스팅 |
| Cloudflare CDN | 포스터 이미지 (R2) | 24시간 | R2 Custom Domain |
| Cloudflare CDN | 좌석 배치도 SVG (R2) | 1시간 | 변경 시 캐시 Purge |
| Upstash Redis | 랭킹 데이터 | 1분 | Write-Through |
| Upstash Redis | 좌석 점유 상태 | TTL 600초 | NX + EX |
| Upstash Redis | 대기열 | 실시간 | Sorted Set |
| Next.js ISR | 카테고리 페이지 | 60초 | On-demand Revalidation |
| Next.js ISR | 공연 상세 | 30초 | On-demand Revalidation |

### 5.7 모니터링 & 로깅

| 도구 | 용도 | 비용 |
|------|------|------|
| Cloud Monitoring | CPU, 메모리, 요청 수, 레이턴시, 인스턴스 수 모니터링 | GCP 무료 할당량 포함 |
| Cloud Logging | 구조화된 JSON 로그, 실시간 로그 스트림 | GCP 무료 할당량 포함 |
| Cloud Trace | 분산 트레이싱 (서비스 간 요청 지연 추적) | GCP 무료 할당량 포함 |
| Cloud Run 메트릭 | 콜드 스타트 빈도, 동시 요청 수, 빌링 시간 | 포함 |
| Sentry | 프론트/백엔드 에러 추적, 소스맵 | 무료 티어 |
| Cloudflare Analytics | CDN 히트율, WAF 차단 현황 | 무료 |
| Cloud Alerting | 에러율 급증, 레이턴시 임계값 초과 시 알림 | 무료 |

> NestJS에서 `console.log(JSON.stringify({ severity: 'INFO', message: '...' }))` 형태로 출력하면 Cloud Logging에서 자동으로 구조화되어 필터링/검색이 가능합니다. 또는 `@google-cloud/logging-winston` 패키지를 사용할 수 있습니다.

---

## 6. 보안 아키텍처

### 6.1 인증 플로우

- **JWT 기반:** Access Token (15분, 메모리) + Refresh Token (7일, httpOnly Cookie)
- **Refresh Token Rotation:** 갱신 시 기존 토큰 폐기 + 새 토큰 발급 (토큰 탈취 감지)
- **소셜 로그인:** OAuth 2.0 (카카오, 네이버) — passport-kakao, passport-naver
- **본인인증:** PASS 인증, 공동인증서 (예매 시)

### 6.2 결제 보안

- PCI DSS 준수: 카드정보 PG사 위임 (비저장)
- 결제 콜백 검증: 서버 간 직접 검증 (클라이언트 값 불신)
- 결제 금액 변조 방지: 서버에서 최종 금액 재계산
- HTTPS 필수: Cloudflare SSL (Full Strict 모드) + Cloud Run 관리형 SSL (자동 인증서)

### 6.3 봇 방지 (매크로 차단)

| 방어 계층 | 방법 |
|-----------|------|
| 네트워크 | Cloudflare WAF + Rate Limiting (무료 플랜 포함) |
| 애플리케이션 | NestJS `@nestjs/throttler` + CAPTCHA (reCAPTCHA v3) |
| 대기열 | 암호화된 대기열 토큰, 디바이스 핑거프린팅 |
| 좌석 선택 | 요청 속도 제한, 비정상 패턴 감지 |
| 결제 | 본인인증 필수, 결제 창 팝업 (자동화 어려움) |

---

## 7. 확장성 & 성능

### 7.1 트래픽 스파이크 대응 (티켓 오픈 시)

```mermaid
sequenceDiagram
    participant Users as 다수 사용자
    participant CF as Cloudflare CDN/WAF
    participant Web as Next.js (Cloud Run 서울)
    participant API as NestJS (Cloud Run 서울)
    participant Queue as 대기열 (Upstash Redis)

    Note over Users,API: 티켓 오픈 시점
    Users->>CF: 대량 요청
    CF->>CF: WAF Rate Limit + 캐시 히트
    CF->>Web: 캐시 미스만 전달
    Web->>API: API 요청

    API->>Queue: 대기열 진입
    Queue->>Queue: Sorted Set 순번 관리
    Queue-->>Users: 대기 순번 응답 (SSE)

    Note over Queue,API: 순차 입장
    Queue->>API: 입장 토큰 발급
    API->>API: 좌석 조회/점유

    Note over API: Cloud Run 자동 수평 확장
    API->>API: 인스턴스 자동 추가 (최대 100+)
```

### 7.2 Cloud Run 스케일링 전략

| 전략 | 설정 | 시점 |
|------|------|------|
| **자동 수평 확장** | `--min-instances 0 --max-instances 100` | 트래픽 기반 자동 |
| **최소 인스턴스** | `--min-instances 1` (콜드 스타트 방지) | 프로덕션 안정화 후 |
| **동시성 제어** | `--concurrency 80` (인스턴스당 동시 요청 수) | 기본 |
| **수직 스케일링** | `--cpu 2 --memory 2Gi` (인스턴스 스펙 상향) | 부하 증가 시 |
| **카나리 배포** | `gcloud run services update-traffic --to-tags=canary=10` | 프로덕션 배포 시 |
| **Cloudflare 캐싱** | 정적 페이지 캐시 히트율 극대화 | 상시 |
| **Next.js ISR** | SSG 페이지로 서버 부하 분산 | 상시 |

> Cloud Run은 요청 수에 따라 자동으로 인스턴스를 0~100+ 사이에서 조절합니다. 티켓 오픈 이벤트 시 별도 설정 변경 없이 자동 대응됩니다.

### 7.3 대기열 시스템 설계

| 구성 요소 | 기술 | 설명 |
|-----------|------|------|
| 대기열 저장소 | Upstash Redis Sorted Set | score=진입시간, member=세션토큰 |
| 입장 제어 | NestJS `@nestjs/throttler` | 초당 입장 인원 제한 (설정 가능) |
| 클라이언트 통신 | SSE (Server-Sent Events) | 대기 순번 실시간 업데이트 |
| 토큰 관리 | JWT + Upstash Redis | 입장 토큰 발급/검증 |
| 임계값 설정 | 관리자 설정 | 공연별 대기열 활성화 임계값 |

### 7.4 Cloud Run 운영 주의사항

| 항목 | 주의점 | 대응 |
|------|--------|------|
| **Cold Start** | 첫 요청 시 1.5~5초 지연 가능 (NestJS DI 컨테이너 초기화) | MVP: `--min-instances 0` (비용 절감), 프로덕션: `--min-instances 1` |
| **요청 타임아웃** | 기본 300초, 최대 3600초 | 장기 작업은 Cloud Run Jobs로 분리 |
| **WebSocket** | Cloud Run은 WebSocket 네이티브 지원 (제한 없음) | 배포 시 연결 끊김 대비 클라이언트 Exponential Backoff 재연결 구현 |
| **SSE 스트리밍** | Cloud Run은 SSE 네이티브 지원 | 별도 프록시 설정 불필요 |
| **디스크 휘발성** | 컨테이너 재시작 시 파일시스템 초기화 | 파일 업로드는 반드시 Cloudflare R2 사용 |
| **Cloud SQL 연결** | 인스턴스 확장 시 DB 커넥션 풀 관리 필요 | Cloud SQL Auth Proxy + Connection Pooling (max 5 per instance). 스파이크 시 max-instances 100 × 5 = 500 커넥션으로 Cloud SQL 한도(~200~500) 초과 가능. PgBouncer 또는 Cloud SQL Auth Proxy의 내장 커넥션 풀링 기능 활용 필수. 또는 max pool size를 2~3으로 줄여 총 커넥션 수를 제한 |
| **비용 최적화** | `--min-instances > 0` 설정 시 유휴 인스턴스도 과금 | MVP: min=0 ($26/월), 프로덕션: min=1 ($87/월) |
| **리전** | 서울 (asia-northeast3) 고정 | 한국 사용자 대상 2~5ms 레이턴시, 3개 가용영역 이중화 |
| **Cloudflare IP** | `@nestjs/throttler`가 Cloudflare 프록시 IP가 아닌 원본 클라이언트 IP로 제한해야 함 | NestJS에서 `CF-Connecting-IP` 또는 `X-Forwarded-For` 헤더를 신뢰하도록 설정. `app.set('trust proxy', true)` 필수 |

### 7.5 비용 시나리오

| 단계 | 월 비용 | 구성 |
|:----:|--------:|------|
| **MVP** (1K DAU) | $26~87 | Cloud Run (min=0~1) + Cloud SQL ($12) + Upstash Redis (무료~$10) |
| **성장기** (10K DAU) | ~$160 | Cloud Run (min=1) + Cloud SQL ($56) + Upstash Redis ($29) |
| **대규모** (50K DAU+) | $200~340 | Cloud Run (auto-scale) + Cloud SQL HA ($112) + Upstash Redis ($99) |

> 50K 동시접속 티켓 오픈 이벤트 시 추가 비용: ~$70~90 (Cloud Run 인스턴스 자동 확장, 30분 기준)

---

## 8. 미결정 사항 및 추가 설계

### 8.1 ORM 선택

> **결정 필요:** `database.config.ts`에 TypeORM/Prisma를 병기했으나 하나를 선택해야 합니다.

| 항목 | TypeORM | Prisma |
|------|---------|--------|
| NestJS 통합 | `@nestjs/typeorm` 공식 지원 | `prisma-nestjs-graphql` 등 커뮤니티 |
| 마이그레이션 | 데코레이터 기반, 자동 생성 가능 | `prisma migrate`, 스키마 파일 기반 |
| 타입 안전성 | 데코레이터 방식, 런타임 타입 | 스키마에서 타입 자동 생성, 컴파일 타임 안전 |
| Raw SQL | QueryBuilder, 유연함 | `$queryRaw`, 제한적 |
| 성능 | 성숙, 예측 가능 | 쿼리 엔진 프로세스 별도 실행 (Cold Start 추가) |

**권장:** NestJS 프로젝트에서는 TypeORM이 통합성 측면에서 유리하나, Prisma의 타입 안전성이 강력합니다. Cold Start가 중요한 Cloud Run 환경에서는 TypeORM이 유리합니다 (Prisma Engine 추가 초기화 없음).

### 8.2 테스트 전략

| 테스트 유형 | 도구 | 대상 | 커버리지 목표 |
|------------|------|------|:---:|
| 단위 테스트 | Jest | 서비스 로직, 유틸리티 | 80%+ |
| 통합 테스트 | Jest + Supertest | API 엔드포인트, DB 연동 | 핵심 플로우 |
| E2E 테스트 | Playwright | 예매 Critical Path (홈 → 상세 → 좌석 → 결제) | Happy Path |
| 부하 테스트 | k6 | 좌석 동시 점유, 대기열 진입 | 목표 동시접속 |

**테스트 환경:**
- 단위/통합: GitHub Actions CI에서 실행 (Cloud SQL 대신 Docker PostgreSQL)
- E2E: staging 환경 대상
- 부하: 티켓 오픈 이벤트 전 staging에서 사전 검증

### 8.3 에러 핸들링 전략

**HTTP 에러 응답 포맷 (통일):**

```json
{
  "statusCode": 409,
  "error": "SEAT_ALREADY_OCCUPIED",
  "message": "해당 좌석은 이미 다른 사용자가 선택했습니다.",
  "timestamp": "2026-03-27T12:00:00.000Z",
  "path": "/api/v1/seats/lock"
}
```

**에러 코드 체계:**
| HTTP 코드 | 에러 코드 패턴 | 예시 |
|:---------:|---------------|------|
| 400 | `INVALID_*` | `INVALID_SCHEDULE_DATE`, `INVALID_SEAT_GRADE` |
| 401 | `AUTH_*` | `AUTH_TOKEN_EXPIRED`, `AUTH_INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN_*` | `FORBIDDEN_ADMIN_ONLY`, `FORBIDDEN_BLACKLISTED` |
| 404 | `NOT_FOUND_*` | `NOT_FOUND_PERFORMANCE`, `NOT_FOUND_SEAT` |
| 409 | `CONFLICT_*` | `SEAT_ALREADY_OCCUPIED`, `RESERVATION_ALREADY_CANCELLED` |
| 429 | `RATE_LIMIT_*` | `RATE_LIMIT_EXCEEDED`, `QUEUE_CAPACITY_FULL` |
| 500 | `INTERNAL_*` | `INTERNAL_PG_ERROR`, `INTERNAL_REDIS_ERROR` |

**NestJS 구현:** `HttpExceptionFilter` (global exception filter)에서 위 포맷으로 통일 변환.

### 8.4 로깅 표준

```typescript
// 구조화된 JSON 로그 포맷 (Cloud Logging 호환)
interface LogEntry {
  severity: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  correlationId: string;  // 요청 추적 ID (X-Request-ID 헤더)
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  duration?: number;       // ms
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}
```

**Correlation ID 전파:**
1. 프론트엔드에서 `X-Request-ID` 헤더 생성 (UUID v4)
2. NestJS `LoggingInterceptor`에서 추출 → 모든 로그에 포함
3. DB 쿼리, Redis 명령, 외부 API 호출에도 전파
4. Sentry 이벤트에 `correlationId` 태그 추가

### 8.5 API 버저닝 전략

- **현재:** URL path 기반 (`/api/v1/...`)
- **버전 업그레이드 시:** `/api/v2/...` 신규 경로 추가, v1은 최소 6개월 병행 운영 후 deprecate
- **하위 호환:** 기존 필드 삭제 대신 optional로 전환, 새 필드는 추가만
- **클라이언트 알림:** 응답 헤더 `X-API-Deprecated: true` + `Sunset: <date>` 헤더

### 8.6 백업 및 복구

| 항목 | 전략 | 목표 |
|------|------|------|
| Cloud SQL 자동 백업 | 매일 자동 (GCP 관리형, 7일 보관) | RPO: 24시간 |
| Cloud SQL PITR | 시점 복구 (Point-in-Time Recovery) 활성화 | RPO: 5분 |
| 수동 백업 | 대규모 마이그레이션 전 수동 스냅샷 | 즉시 |
| Redis | Upstash 자동 백업 (Pro 플랜) | 캐시 유실 허용 (재생성 가능) |
| Cloudflare R2 | 버저닝 활성화 | 이미지/SVG 복구 가능 |

**RTO (Recovery Time Objective):**
- Cloud SQL 자동 복구: ~10분 (장애 감지 → 자동 페일오버)
- Cloud SQL PITR 복구: ~30분 (수동 개입 필요)
- Cloud Run: 즉시 (이전 리비전으로 트래픽 전환)

### 8.7 관리자 시스템 통합

> 관리자 기능의 상세 역추론은 `05-ADMIN-PREDICTION.md`를 참조하세요.

**NestJS 모듈 구조 확장:**

```
src/modules/
├── auth/                   # 사용자 + 관리자 공통 인증
│   ├── guards/
│   │   ├── jwt-auth.guard.ts     # JWT 검증 (공통)
│   │   └── roles.guard.ts        # RBAC 역할 검증 (관리자)
│   └── decorators/
│       └── roles.decorator.ts    # @Roles('ADMIN', 'GENRE_MANAGER')
├── admin/                  # 관리자 전용 모듈
│   ├── admin-performance/  # 공연 CRUD (관리자)
│   ├── admin-reservation/  # 예매 조회/환불 (관리자)
│   ├── admin-user/         # 회원 관리 (관리자)
│   ├── admin-settlement/   # 정산 관리
│   └── admin-dashboard/    # 대시보드 집계
└── ... (기존 사용자 모듈)
```

**라우팅:** 사용자 API와 관리자 API는 같은 NestJS 인스턴스에서 prefix로 분리:
- 사용자: `GET /api/v1/performances/:id`
- 관리자: `GET /api/v1/admin/performances` (목록 + 필터 + 상태 변경 가능)
