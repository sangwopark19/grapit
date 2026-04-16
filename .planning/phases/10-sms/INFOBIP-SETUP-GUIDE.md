# Infobip SMS 실연동 셋업 가이드 (Phase 10)

> **목적**: Phase 10 (SMS 인증 실연동)을 마치고 실제 SMS OTP를 발송하기 위해 필요한 모든 사전 작업을 처음부터 끝까지 기록한다.
>
> **대상 독자**: Grapit을 1인 개발하는 개발자(사업자등록증 유무 양쪽 모두).
>
> **작성일**: 2026-04-16
>
> **스코프**: Infobip 포털 계정 생성 → KISA 한국 발신번호 사전등록 → 로컬 `pnpm dev` 실 SMS 테스트 → GCP Cloud Run 프로덕션 배포 및 smoke 검증까지.

---

## 전체 흐름 요약

```
[사전 병행 작업]          [단계 1]           [단계 2]           [단계 3]           [단계 4]
사업자등록(필요시) ───┐
                     │
                     ▼
                  Infobip 포털     KISA 발신번호     로컬 pnpm dev      Cloud Run
                  계정 + 2FA   →   사전등록       →  실 SMS 테스트   →  프로덕션 배포
                  (§1)            (§2)             (§3)              (§4)
                                  영업일 3~7일                      휴먼 verify
                                  ★ 최장 블로커 ★                  (HUMAN-UAT)
```

**전체 캘린더 기간:** 사업자등록 있음 약 1주 / 없음 약 2주 (병행 가능)

**최소 비용:** 0원 (Free Trial 100건 + 본인 번호만 verified) — Phase 10 휴먼 검증은 실 발송 1건 ~35원으로 충분

---

## 작업 전 체크리스트 (전역)

시작 전에 다음을 확인한다. 하나라도 미충족이면 해당 단계 앞에서 멈춘다.

- [ ] **Node.js 22.22.x LTS** 로컬 설치 (`node -v`)
- [ ] **pnpm 10.x** (`pnpm -v`)
- [ ] **Docker Desktop / OrbStack** 기동 가능 (로컬 Valkey/Postgres용)
- [ ] **gcloud CLI** 설치 + `gcloud auth login` 완료 (프로덕션 배포 시)
- [ ] **GitHub CLI (`gh`)** 설치 + `gh auth status` 완료
- [ ] **본인 명의 한국 휴대폰 번호** (010-XXXX-XXXX) — 즉시 SMS 수신 가능한 번호
- [ ] **이메일 계정** — Infobip 영업팀 콜드메일 받아도 괜찮은 주소
- [ ] (선택) **사업자등록증** — 없으면 홈택스에서 당일 발급 가능 (§2.7 시나리오 A 참조)
- [ ] **Grapit 리포지토리 clone 완료** + `.env` 작성 권한

---

## 1. Infobip 포털 계정 및 2FA 설정

> Grapit는 Infobip 2FA PIN API(일반 SMS API가 아님)를 사용한다. 이 절차는 **포털에서 계정을 만들고 → 2FA Application/Message Template을 만들고 → API Key를 발급받아 → `.env` 4개 변수를 채우는** 흐름이다. 1인 개발자가 처음 Infobip을 만진다는 가정으로 단계별로 정리한다.

---

### 1.1 계정 생성 및 요금제

#### 1.1.1 회원가입

1. https://www.infobip.com 접속 → 우상단 **Sign up** 또는 https://portal.infobip.com 으로 직접 진입
2. 가입 폼 작성 (회사명, 업무 이메일 권장)
   - **회사명(Company)**: 사업자등록 전이라면 본인 이름 또는 임시명 가능 (계정 정지 사유 아님, 결제 단계에서 사업자 정보를 다시 입력)
   - **업무 이메일**: gmail/네이버 등 일반 이메일도 받지만, 영업팀의 콜드콜이 와도 무방한 메일을 권장
   - **휴대폰 번호**: 한국 번호 그대로(+82-10-...) 입력. 이 번호가 Free Trial의 **유일한 검증된 수신자**가 되므로 **본인이 즉시 SMS를 받을 수 있는 번호**여야 한다
3. 이메일 인증 링크 클릭 → 휴대폰 SMS 인증코드 입력 → 패스워드 설정
4. 첫 로그인 시 "어떤 채널을 쓸 예정이냐"를 묻는 온보딩 위저드가 뜨면 **SMS** 또는 **2FA / Authentication**을 선택. (스킵해도 무방)

#### 1.1.2 Free Trial 자동 시작

Infobip은 가입과 동시에 **60일 Free Trial**이 시작된다. 즉시 결제 정보를 등록할 필요 없다.
- 60일 안에 결제 카드를 등록하지 않으면 계정은 비활성화되지만 **삭제되지는 않으므로** 나중에 결제 정보만 추가하면 그대로 이어서 쓸 수 있다.
- Free Trial 한도 내에서 본인 휴대폰에 직접 SMS를 보내면서 코드를 검증하는 데 집중하면 된다 (자세한 한도는 §1.6 참고).

#### 1.1.3 한국향 SMS 요금 (2026년 기준)

- 한국 모바일 종단(SK텔레콤 / KT / LG U+)으로 발송하는 A2P SMS는 **건당 약 USD $0.035 ~ $0.040** 수준 (네트워크/시간대/할인협상에 따라 변동).
- **정확한 금액은 포털에서 직접 확인**하는 것이 정답이다.
  - 포털 좌측 메뉴 → **Account & Billing → Pricing** (또는 우측 상단 가격 계산기)
  - **Country: South Korea (KR)** 선택 → 월 예상 발송량 입력 → MNO별 단가 확인
- 결제 카드를 등록하면 자동으로 Free Trial 한도가 풀리고, **선불(prepaid) 또는 후불(postpaid)** 중 선택할 수 있다. 1인 개발자 MVP 단계에서는 **선불 + 자동 충전 OFF**를 권장 (실수로 큰 금액이 빠지는 것을 막는다).
- 한국 발송 시 추가로 알아둘 점:
  - **알파뉴메릭 sender ID는 한국에서 미지원**. 발신번호는 숫자형이며, 국제망을 통한 발송은 통신사가 자동으로 `009`/`006` 접두사를 붙인다. 따라서 `from: "Grapit"` 같은 영문 sender는 **국내 단말에서 다른 sender로 치환되어 표시**된다.
  - 한국 통신사는 모든 A2P 메시지 본문 앞에 자동으로 `[국제발신]` 또는 `[Web 발신]` 태그를 삽입한다. 우리가 컨트롤할 수 없으니 그대로 받아들이면 된다.
  - 한국 SMS 1세그먼트는 EUC-KR 기준 **140바이트**(한글 약 45자). PIN 메시지가 짧으니 1SMS 안에 들어간다.

#### 1.1.4 Free Trial의 핵심 제약

| 항목 | 제한 |
|---|---|
| 검증된 수신 번호 | 가입 시 등록한 번호 1개 (포털에서 최대 5개까지 추가 검증 가능) |
| 채널당 메시지 수 | 검증 번호 1개 기준 **최대 100건/채널** (SMS 기준 약 15건이라는 안내가 병행되니 보수적으로 잡을 것) |
| Sender ID | `InfoSMS` / `ServiceSMS` / `DemoCompany` 같은 **공유 테스트 sender** 강제 사용. 한도를 다 쓰면 테스트 sender도 제거됨 |
| 기간 | 가입 후 60일 |
| 미검증 번호로 발송 | **거절됨** (`PIN_NOT_SENT` 또는 4xx 에러) |

> Free Trial로는 "코드가 정상 동작하는지"까지만 확인한다. **타인 번호로 발송 테스트 → 실서비스 베타** 같은 흐름은 결제 카드 등록(=유료 전환) 이후에 가능하다.

---

### 1.2 Base URL 확인

Infobip은 모든 계정에 **고유한 서브도메인**을 발급한다. 일반 `api.infobip.com`이 아니라 본인 계정의 베이스 URL을 써야 라우팅 최적화가 적용된다.

#### 1.2.1 Base URL 형식

```
xxxxx.api.infobip.com
```

- `xxxxx` 부분은 5~6글자 영숫자(예: `9k5lzj`, `m3p2q9`)이며 계정마다 다르다.
- 비밀값은 아니지만(공개되어도 보안상 문제없음), **잘못 쓰면 라우팅이 어긋나 실패하거나 지연이 발생**하므로 정확히 복붙해야 한다.

#### 1.2.2 어디에서 확인하나

1. **포털 메인 대시보드 상단 바**: 로그인 직후 페이지 상단 또는 우상단 프로필 영역에 본인의 Base URL이 표시된다 (`yourdomain.api.infobip.com` 형태).
2. **API Documentation Hub** (https://www.infobip.com/docs/api): 로그인된 상태로 들어가면 좌측에 본인 계정의 Base URL이 자동으로 채워져 있다. 모든 코드 샘플의 `{baseUrl}` 자리에 본인 값이 들어간다.
3. **Developer Tools → API Keys** 페이지에서도 키 생성 화면 상단에 같이 노출된다.

#### 1.2.3 환경변수에 저장할 형식

Grapit의 `infobip-client.ts`는 `${baseUrl}/2fa/2/pin` 으로 URL을 조립한다(파일 39, 68행). 즉 **스킴(`https://`) 포함 + 끝 슬래시 없음**으로 넣어야 한다.

```bash
# .env (모노레포 루트)
INFOBIP_BASE_URL=https://xxxxx.api.infobip.com
```

> `https://` 접두사를 빼먹으면 fetch가 상대 경로로 해석해 즉시 실패한다. 끝에 `/`를 붙이면 `//2fa/2/pin`이 되어 일부 게이트웨이가 404를 돌려준다.

---

### 1.3 2FA Application 생성

Application은 "이 서비스의 2FA 트래픽이 어떤 정책으로 동작하는가"를 정의하는 **설정 묶음**이다. 만들면 `applicationId`가 발급된다. 한 계정에 여러 application을 둘 수 있다(예: `회원가입`, `결제확인`, `비밀번호변경`).

#### 1.3.1 포털 경로 (2026년 현재)

Infobip 포털 UI는 분기마다 미세하게 바뀌므로 메뉴 라벨이 약간 다를 수 있지만 **2가지 경로 중 하나**로 도달한다.

- **경로 A (UI 우선):** 좌측 사이드바 → **Channels and Numbers → Apps and Integrations → 2FA**
  - 하위에 **Applications** 탭과 **Message templates** 탭이 보인다
  - 우측 상단 **Create application** 버튼 클릭
- **경로 B (UI 라벨이 다른 경우):** 좌측 메뉴 → **Use Cases → Authenticate (2FA)** → **Applications** → **Create new**
- **경로 C (UI에서 안 보이는 경우):** API로 직접 만들면 된다 (아래 §1.3.4 참고). 1인 개발 입장에서는 오히려 API가 더 빠르다.

#### 1.3.2 입력 필드 (Grapit 권장값)

| 포털 필드 | API 필드명 | 값 | 설명 |
|---|---|---|---|
| Application name | `name` | `Grapit Phone Verify` | 식별용. 영문 권장 |
| Enabled | `enabled` | `true` (체크) | 비활성화하면 PIN 발송이 거절됨 |
| PIN attempts | `configuration.pinAttempts` | `5` | 한 PIN당 최대 검증 시도 횟수 (기본 10) |
| Allow multiple PIN verifications | `configuration.allowMultiplePinVerifications` | `true` (체크) | 같은 pinId에 대해 여러 번 verify 가능 (기본 true). 결제 단계 직전 재확인용으로 필요 |
| PIN time to live | `configuration.pinTimeToLive` | `3m` | PIN 유효시간. `3m` = 3분. (`ms`/`s`/`m`/`h`/`d` 단위) |
| Send PIN per phone number limit | `configuration.sendPinPerPhoneNumberLimit` | `5/1h` | 한 번호로 1시간에 최대 5회 발송 (남용/문자폭탄 방지) |
| Send PIN per application limit | `configuration.sendPinPerApplicationLimit` | `10000/1d` | 앱 전체 1일 발송 상한 (기본값 그대로 무방) |
| Verify PIN limit | `configuration.verifyPinLimit` | `1/3s` | 한 번호 기준 3초당 1회 검증 (브루트포스 방지, 기본값 무방) |

> **체크리스트 합치성**: `pinAttempts=5` / `allowMultiplePinVerifications=true` / `pinTimeToLive=3m` / `sendPinPerPhoneNumberLimit=5/1h` 4개는 `DEPLOY-CHECKLIST.md`에서 강제하는 값이다. 다르게 설정하면 백엔드 정책(재시도 카운트, TTL)이 어긋난다.

#### 1.3.3 시간/한도 필드 포맷 규칙

- **단일 시간 필드** (`pinTimeToLive`): `{숫자}{단위}` — `30s`, `3m`, `1h`, `2d`
- **빈도 한도 필드** (`*Limit`): `{횟수}/{시간길이}{단위}` — `5/1h`, `10000/1d`, `1/3s`
- 단위: `ms`(밀리초), `s`(초), `m`(분), `h`(시), `d`(일)

> **잘못된 형식 예시:** `3 minutes`, `3min`, `5per1h` 모두 거절된다.

#### 1.3.4 API로 만들 때 (포털 UI가 헷갈리면 추천)

다음 cURL 한 방으로 끝난다. `{baseUrl}`과 `{apiKey}`만 본인 값으로 치환.

```bash
curl -X POST "https://{baseUrl}/2fa/2/applications" \
  -H "Authorization: App {apiKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Grapit Phone Verify",
    "enabled": true,
    "configuration": {
      "pinAttempts": 5,
      "allowMultiplePinVerifications": true,
      "pinTimeToLive": "3m",
      "sendPinPerPhoneNumberLimit": "5/1h",
      "sendPinPerApplicationLimit": "10000/1d",
      "verifyPinLimit": "1/3s"
    }
  }'
```

응답 예시:

```json
{
  "applicationId": "1234567ABCDEF...",
  "name": "Grapit Phone Verify",
  "configuration": {
    "pinAttempts": 5,
    "allowMultiplePinVerifications": true,
    "pinTimeToLive": "3m",
    "sendPinPerPhoneNumberLimit": "5/1h",
    "sendPinPerApplicationLimit": "10000/1d",
    "verifyPinLimit": "1/3s"
  },
  "enabled": true
}
```

→ `applicationId` 값을 **즉시 메모**해서 `.env`의 `INFOBIP_APPLICATION_ID`에 넣는다 (포털 Applications 목록에서 다시 확인 가능하지만, 만들 때 받아두면 빠르다).

> 닭과 달걀 문제: API로 만들려면 API Key가 먼저 필요하다. 즉 **§1.5에서 키부터 발급한 다음 다시 §1.3으로 돌아오는** 순서가 실제로는 더 자연스럽다.

---

### 1.4 Message Template 생성

Message Template은 사용자에게 실제로 표시될 **SMS 본문**을 정의한다. PIN을 어디에 끼울지(`{{pin}}`)와 어떤 형식의 PIN을 만들지(숫자/영문/길이)를 지정한다. Application 1개에 여러 template을 만들 수 있다(언어별, 시나리오별).

#### 1.4.1 포털 경로

- **경로 A:** Channels and Numbers → Apps and Integrations → 2FA → 방금 만든 application 선택 → **Message templates** 탭 → **Create message template**
- **경로 B:** Use Cases → Authenticate → applications 목록에서 application 클릭 → **Templates** → **New**

#### 1.4.2 입력 필드 (Grapit 값)

| 포털 필드 | API 필드명 | 값 | 설명 |
|---|---|---|---|
| Channel | (포털 전용 토글) | **SMS** | Voice/Email은 사용 안 함 |
| PIN type | `pinType` | `NUMERIC` | 숫자만. ALPHA / ALPHANUMERIC / HEX 가능 |
| PIN length | `pinLength` | `6` | 6자리 숫자 |
| Message text | `messageText` | `[Grapit] 인증번호 {{pin}} (3분 이내 입력)` | `{{pin}}` 자리에 자동으로 6자리 숫자가 들어감 |
| Language | `language.languageCode` 또는 `language` | `ko` | 한국어 텍스트 명시. 일부 UI에는 노출되지 않을 수 있으나 한글이 들어가면 자동 추론됨 |
| Sender ID | `senderId` | (Free Trial: 비워두기 / 유료: KISA 등록 완료된 한국 발신번호) | 한국향은 알파뉴메릭 미지원 (§2.5) |

#### 1.4.3 왜 이 값들이 중요한가

- **`pinType=NUMERIC`** — 한국 단말은 한자/특수문자가 섞이면 입력 UX가 망가진다. 또한 백엔드 검증 로직이 `^\d{6}$`로 들어오는 것을 가정하므로(zod 스키마 기준) 다른 타입을 쓰면 즉시 검증 실패가 난다.
- **`pinLength=6`** — 한국 인증번호 사실상의 표준. 4자리는 무차별 대입에 약하고, 8자리는 사용자가 입력 도중 잘못 칠 가능성이 높다. 6자리가 보안/UX 균형점이며 NIST/KISA 권고와도 부합한다.
- **`{{pin}}` 자리에 띄어쓰기 없이 정확히 표기** — `{{ pin }}`처럼 공백을 넣으면 치환되지 않고 문자 그대로 발송된다.
- **본문에 `[Grapit]`을 넣은 이유** — 한국 통신사가 자동으로 `[국제발신]` 태그를 앞에 붙이므로 사용자가 발신자를 식별할 단서가 필요하다. 브랜드명을 본문에 명시하는 게 가장 확실하다.

#### 1.4.4 API로 만들 때

```bash
curl -X POST "https://{baseUrl}/2fa/2/applications/{applicationId}/messages" \
  -H "Authorization: App {apiKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "pinType": "NUMERIC",
    "messageText": "[Grapit] 인증번호 {{pin}} (3분 이내 입력)",
    "pinLength": 6,
    "language": "ko"
  }'
```

응답 예시:

```json
{
  "messageId": "0130269F44AFD07AEBC2FEFEB30398A0"
}
```

→ `messageId`를 **즉시 메모**해서 `INFOBIP_MESSAGE_ID`에 넣는다.

> **검수 팁**: 만든 후 곧바로 본인 휴대폰으로 한 번 보내보고 (§1.6) 실제로 문자가 `[국제발신][Grapit] 인증번호 123456 (3분 이내 입력)` 형태로 도착하는지 확인. 한글이 깨지면 (`???` 표시) `language: "ko"`를 넣어 재생성한다.

---

### 1.5 API Key 발급

API Key는 위에서 만든 Application/Template에 접근하고 PIN을 발송할 수 있는 **인증 토큰**이다. 헤더 `Authorization: App {apiKey}` 형태로 모든 요청에 포함된다.

#### 1.5.1 포털 경로

좌측 메뉴 → **Developer Tools → API Keys → Create API key**

(메뉴 라벨이 보이지 않는다면 우상단 프로필 아이콘 → **Account settings → API keys** 경로도 동일한 페이지로 연결된다.)

#### 1.5.2 입력 항목

| 필드 | 값 | 설명 |
|---|---|---|
| Name | `grapit-api-prod` 또는 `grapit-api-dev` | 환경별로 분리 권장. 나중에 회수할 때 식별 |
| Allowed IPs | (비워두기 또는 Cloud Run NAT IP) | Cloud Run은 동적 IP라 비워두는 것이 일반적. 보안 강화 시 NAT egress IP 고정 후 입력 |
| Valid from / Valid to | (Valid from = 오늘, Valid to = 1년 후) | 만료일 없이 두면 OWASP 권고 위반. 최소 연 1회 로테이션 |
| API scopes (Permissions) | 아래 §1.5.3 참고 | **반드시 최소 권한만** 부여 |

#### 1.5.3 필요한 Scope (권한)

Infobip의 scope 카테고리에서 **2FA 관련 3개**만 선택한다.

| Scope ID | 용도 | Grapit에서 사용하는 곳 |
|---|---|---|
| `2fa:pin:send` | PIN 발송 (`POST /2fa/2/pin`) | 회원가입 / 로그인 인증번호 요청 |
| `2fa:pin:manage` | PIN verify/resend 등 PIN 라이프사이클 관리 | 인증번호 검증, 재전송 |
| `2fa:manage` | Application/Template 생성·수정·조회 (관리자 작업용) | (선택) 코드/스크립트로 application 자체를 만들 때만 필요 |

> **권장 분리:**
> - **운영용 키 (`grapit-api-prod`)**: `2fa:pin:send` + `2fa:pin:manage`만 부여 (`2fa:manage` 제외)
> - **부트스트랩용 키 (`grapit-bootstrap`)**: `2fa:manage` 포함, application/template 만든 직후 즉시 폐기 또는 비활성화
>
> 이렇게 분리하면 운영 키가 유출되어도 application 설정이 변경되거나 새 template이 만들어지는 사고를 막을 수 있다.

#### 1.5.4 ★보안 경고★ — 키는 단 한 번만 표시된다

생성 직후 화면에 **`apiKeySecret`**(또는 `key`) 값이 평문으로 표시된다. 이 화면을 닫으면 **다시는 조회할 수 없다**. 잃어버리면 새 키를 발급해야 한다.

대응:
1. 화면을 닫기 전에 `.env`에 즉시 붙여넣기
2. 1Password / Bitwarden 같은 비밀번호 관리자에 백업
3. 절대로 git에 커밋하지 말 것 (`.env`는 `.gitignore`에 포함되어 있는지 확인)
4. Slack / 이메일 / 문서 등에 평문으로 적지 말 것
5. 만약 의심스러운 곳에 노출되었다면 즉시 포털 → API Keys → 해당 키 → **Revoke** 후 재발급

#### 1.5.5 인증 헤더 형식

Grapit의 `infobip-client.ts:42, 71`은 다음 형식으로 호출한다.

```
Authorization: App {INFOBIP_API_KEY}
```

다른 형식 (`Bearer ...`, `Basic ...`, `IBSSO ...`)도 Infobip이 지원하지만 **API Key 인증은 반드시 `App ` 접두사**를 사용해야 한다. `Bearer`로 보내면 401이 떨어진다.

> **중요 — prefix 중복 주의**: `infobip-client.ts:43`에서 `Authorization: \`App ${this.apiKey}\`` 로 이미 `App ` prefix를 붙인다. `.env`에 `INFOBIP_API_KEY=App xxxxx`처럼 prefix를 포함해서 저장하면 `App App xxxxx`가 되어 401 발생. **raw key 값만** 넣는다.

---

### 1.6 Free Trial로 먼저 검증하기

결제 카드를 등록하기 전에 코드가 정상 동작하는지 확인하는 권장 흐름이다. 1인 개발 MVP에서 가장 안전한 방법.

#### 1.6.1 검증된 수신 번호 추가

가입 시 등록한 본인 번호 외에 동료/지인 번호를 1~4개 더 검증할 수 있다 (총 5개까지).

1. 포털 좌측 → **Account & Billing → My profile → Verified phone numbers**
   (또는 우상단 프로필 → **Settings → Verified recipients**)
2. **Add verified number** → E.164 형식(`+82-10-XXXX-XXXX`)으로 입력
3. 해당 번호로 도착한 인증코드 4~6자리를 포털에 입력 → 검증 완료
4. 추가된 번호는 즉시 사용 가능

#### 1.6.2 첫 발송 테스트 (Grapit 코드 실행 전 cURL로 사전 점검)

```bash
# 1) PIN 발송
curl -X POST "https://{baseUrl}/2fa/2/pin" \
  -H "Authorization: App {apiKey}" \
  -H "Content-Type: application/json" \
  -d '{
    "applicationId": "{applicationId}",
    "messageId": "{messageId}",
    "from": "Grapit",
    "to": "821012345678"
  }'
# 응답: { "pinId": "...", "to": "821012345678", "smsStatus": "MESSAGE_SENT" }

# 2) 휴대폰으로 도착한 6자리 코드를 즉시 입력해 verify
curl -X POST "https://{baseUrl}/2fa/2/pin/{pinId}/verify" \
  -H "Authorization: App {apiKey}" \
  -H "Content-Type: application/json" \
  -d '{ "pin": "123456" }'
# 응답: { "msisdn": "821012345678", "verified": true, "attemptsRemaining": 0 }
```

> **`to` 형식 주의**: Grapit 코드(`infobip-client.ts:50`)는 `+`를 떼고 보낸다. `+821012345678` → `821012345678`. cURL 테스트 시에도 같은 규칙을 따라야 한다.

#### 1.6.3 알아둘 한계

| 시도 | 결과 |
|---|---|
| 검증된 번호로 발송 | 정상 발송 (잔여 한도 내) |
| 미검증 번호로 발송 | **거절** — `EC_UNDEFINED_DEFAULT_NUMBER` 또는 `PIN_NOT_SENT` |
| 카카오톡/Whatsapp 등 다른 채널 발송 | Free Trial은 채널별로 한도 따로 차감, 마찬가지로 검증 번호만 가능 |
| `from`에 임의의 알파뉴메릭 입력 | 무시되고 `ServiceSMS` 등 공유 sender로 발송됨 |
| 잔여 SMS 0건 | 발송 거절. 결제 카드 등록 → 소액 충전 → 즉시 해제 |
| `[국제발신]` 태그 미표시 원함 | Free Trial 단계에선 통제 불가. 유료 전환 후 KMC 등록 sender ID로만 가능 |

#### 1.6.4 Trial → Paid 전환 타이밍

다음 4가지 중 하나에 해당하면 결제 카드를 등록한다.
- 베타 테스터(검증 번호 외)에게 보내야 할 때
- Sender ID를 통제해야 할 때 (브랜드명 노출이 필요한 경우)
- 한국 정식 발신번호로 보내야 할 때 (KISA 사전 등록 필요, §2 참고)
- 60일 Trial 만료가 임박했을 때

결제 정보를 등록해도 **방금 만든 Application/Template/API Key는 그대로 유효**하다. 환경변수도 바꿀 필요 없다. 단지 `from` 필드만 운영 sender로 바꾸면 된다.

---

### 1.7 환경변수 정리

최종적으로 모노레포 루트 `.env`에 다음 4개를 채운다.

```bash
# /grapit/.env
INFOBIP_API_KEY=abcd1234ef567890abcd1234ef567890-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
INFOBIP_BASE_URL=https://9k5lzj.api.infobip.com
INFOBIP_APPLICATION_ID=1234567ABCDEF89012345678901234567
INFOBIP_MESSAGE_ID=0130269F44AFD07AEBC2FEFEB30398A0
```

#### 1.7.1 Portal 필드 ↔ env var ↔ 예시 매핑

| Portal에서 받는 값 | 받는 위치 | env var | 형식 / 예시 | 코드에서 쓰이는 곳 |
|---|---|---|---|---|
| API Key (`apiKeySecret`) | Developer Tools → API Keys → Create | `INFOBIP_API_KEY` | 50~80자 영숫자 + 하이픈 (단 한 번만 표시) | `Authorization: App ${apiKey}` 헤더 |
| Personal Base URL | 대시보드 상단 / API Docs 페이지 상단 | `INFOBIP_BASE_URL` | `https://xxxxx.api.infobip.com` (스킴 포함, 끝 슬래시 없음) | `${baseUrl}/2fa/2/pin` URL 조립 |
| `applicationId` | 2FA Applications 목록 또는 POST /2fa/2/applications 응답 | `INFOBIP_APPLICATION_ID` | 32자 영숫자 (예: `1234567ABCDEF...`) | `POST /2fa/2/pin` body의 `applicationId` |
| `messageId` | Message templates 목록 또는 POST /2fa/2/applications/{id}/messages 응답 | `INFOBIP_MESSAGE_ID` | 32자 영숫자 (예: `0130269F44AFD...`) | `POST /2fa/2/pin` body의 `messageId` |

#### 1.7.2 검증 (실 호출 전 sanity check)

`.env`를 채운 다음 루트에서 다음을 실행해 환경변수가 잘 읽히는지 확인:

```bash
node -e "
  require('dotenv').config({ path: './.env' });
  const url = process.env.INFOBIP_BASE_URL;
  const key = process.env.INFOBIP_API_KEY;
  const app = process.env.INFOBIP_APPLICATION_ID;
  const msg = process.env.INFOBIP_MESSAGE_ID;
  console.log('BASE_URL ok:', /^https:\/\/[a-z0-9]+\.api\.infobip\.com$/.test(url));
  console.log('API_KEY len:', key?.length ?? 0);
  console.log('APP_ID len:', app?.length ?? 0);
  console.log('MSG_ID len:', msg?.length ?? 0);
"
```

---

## 2. KISA 발신번호 사전등록 및 한국 번호 확보

### 2.1 KISA 발신번호 사전등록제 개요

**제도의 정의**
KISA(한국인터넷진흥원)이 운영·감독하는 「발신번호 사전등록제」는 2015년 10월 16일부터 시행된 제도로, **「전기통신사업법」 제84조의2 (발신번호의 거짓표시 금지)** 에 근거한다. 핵심은 "사전에 등록되지 않은 발신번호로는 대량(시스템) 문자메시지를 발송할 수 없다"는 것이다.

**적용 대상**
- 적용: **API/시스템을 통한 모든 A2P(Application-to-Person) SMS** — 즉 Grapit이 OTP 인증을 위해 Infobip API를 호출하는 모든 트래픽이 해당된다.
- 비적용: 개인이 자기 스마트폰에서 손으로 보내는 P2P 문자.

**미등록 번호로 발송할 경우 어떤 일이 일어나는가**

발송 차단은 **세 단계**에서 발생할 수 있다.

| 차단 지점 | 동작 | 비고 |
|---|---|---|
| 1차: SMS 사업자(Infobip) | API 응답 단계에서 즉시 거절 | 등록되지 않은 sender ID는 Infobip 콘솔의 Sender 상태가 "Pending" / "Rejected"이므로 메시지 자체가 큐에 들어가지 않음 |
| 2차: 국내 어그리게이터(LG U+, KT 등 도매 사업자) | KISA의 등록 DB와 대조 후 차단 | Infobip은 한국 트래픽을 국내 도매 사업자를 거쳐 전달하므로 어그리게이터 단계에서 한 번 더 검증 |
| 3차: 이통사(SKT/KT/LG U+) | 단말기 도달 직전 차단 | 도달 자체가 발생하지 않으므로 사용자에게 "수신 실패" 알림조차 가지 않음 |

**규제 강화 동향 (2026년 기준)**
- 방송통신위원회(BMCC)는 2026년 7월 10일부로 **대량 SMS 사업자 의무 인증제(One-Strike Rule)** 를 시행. 마약·도박·사기 관련 스팸이 단 1건이라도 송출되면 사업자등록 자체가 즉시 취소된다.
- 사업자 인증을 받지 못한 어그리게이터는 부가통신사업자 등록조차 불가능하므로, **국내 도매 사업자들의 KISA DB 검증이 더 엄격해지고 있다.**
- 결과적으로 Infobip 같은 글로벌 사업자도 한국 트래픽 송출 시 국내 어그리게이터의 검증을 우회할 수 없다.

**법적 근거 요약**
- 「전기통신사업법」 제84조의2 (발신번호 거짓표시 금지)
- 「정보통신망법」 제50조 (광고성 정보 전송 시 명시 의무: `[Web발신]` / `[국제발신]` 태그 자동 삽입)
- 미래창조과학부 고시 「발신번호 변작 방지를 위한 세부 지침」

---

### 2.2 Infobip에서 한국 번호 등록하기

Infobip은 **KISA에 직접 등록하는 주체가 아니라**, 자사가 보유한 한국 도매 회선(SK Broadband, LG U+ 등)에 신청자의 발신번호 + 증빙서류를 등록 대행해주는 구조다. 즉, 신청자는 KISA 사이트(`spamcop.or.kr` 등)에 직접 접속해 등록할 필요가 없고, **Infobip 콘솔 → Infobip CPaaS Registration Team → 국내 도매 사업자 → KISA DB** 의 흐름으로 위임된다.

**콘솔 접근 경로 (2026년 기준)**

1. Infobip Web Interface (https://portal.infobip.com) 로그인
2. 좌측 메뉴: **Channels and Numbers > My Requests** 진입
3. 상단 탭: **Sender requests** 선택
4. 우측 상단 **Request Sender** 버튼 클릭

**신청 양식 작성**

다음 항목을 입력한다.

| 필드 | Grapit 입력 예시 |
|---|---|
| Channel | SMS |
| Sender Type | Numeric Sender ID (한국은 alphanumeric 불가, §2.5 참조) |
| Sender Name (실제 발신번호) | `0212345678` 등 본인 명의 한국 유선/070/휴대폰 번호 |
| Country | South Korea |
| Legal office in country? | 사업자등록증 보유 시 체크 / 미보유 시 체크 해제 |
| Use case | Transactional - OTP / 2FA verification |
| Expected MT volume | 예상 월간 발송량 (예: 5,000건/월) |
| Sample message | `[Grapit] 인증번호는 [123456]입니다. 정확히 입력해 주세요.` |

**제출 후 처리**
- SMS 한국 번호 등록은 **Self-serviceable이 아닌 Ticket-based** 채널로 처리되므로, CPaaS Registration Team이 수동 검토한다.
- 처리 시작 시 담당 Solution Engineer가 이메일로 추가 서류를 요청한다 (다음 절 참조).
- 진행 상태는 **My Requests > Sender requests** 탭에서 `Pending` → `In Review` → `Approved` / `Rejected` 로 변동.

**중요: 한국 사무소가 없는 글로벌 계정의 경우**
- "Legal office in country" 체크박스를 해제하면 Infobip이 한국 도매 사업자를 통해 등록을 대행하지만, **한국 명의 (본인/법인) 의 발신번호는 반드시 필요하다.** 즉 외국 번호로 한국 트래픽을 보내는 것은 불가능하다 (§2.5 참조).

---

### 2.3 필요 서류 및 심사 기간

Infobip이 한국 도매 사업자에게 제출할 증빙서류는 사실상 국내 SMS 사업자(SOLAPI, NHN Bizgo, 비즈고 등)와 동일하다.

**A. 사업자 명의로 등록할 경우 (사업자등록증 보유자)**

| 서류 | 발급처 | 유효기간 |
|---|---|---|
| 사업자등록증 사본 | 홈택스 / 국세청 | 별도 기한 없음 (단, 폐업 여부 확인 가능 자료) |
| 통신서비스 이용증명원 | 통신사 (명의자 본인) | **발급 후 1개월 이내** |
| 대표자 신분증 사본 | — | 주민번호 뒷자리 마스킹 필수 |
| 개인정보 수집·이용 동의서 (Infobip 양식) | Infobip 담당자가 메일로 송부 | — |

**B. 개인 명의로 등록할 경우 (사업자등록증 없음)**

| 서류 | 발급처 | 비고 |
|---|---|---|
| 통신서비스 이용증명원 | 통신사 (명의자 본인) | 발급 후 1개월 이내 |
| 본인 신분증 사본 | — | 주민번호 뒷자리 마스킹 필수 |
| 4대보험 가입자 확인서 또는 재직증명서 | 국민건강보험공단 / 재직 회사 | 회사 재직자가 회사 번호로 등록할 때만 |
| 개인정보 수집·이용 동의서 | Infobip 담당자 메일 | — |

**통신서비스 이용증명원 통신사별 발급 방법** (Infobip 신청 전 미리 발급해 둘 것)

| 통신사 | 명칭 | 비대면 발급 경로 |
|---|---|---|
| SKT | 이용계약증명서 | T World (`tworld.co.kr`) → 로그인 → 나의 가입정보 → 이용계약 등록사항 증명서 → PDF 다운로드 |
| KT | 원부증명서 / 가입증명원 | KT닷컴 (`kt.com`) → 로그인 → My올레 → 가입정보 → 가입증명원 출력 |
| LG U+ | 가입 확인서 | LG U+ (`uplus.co.kr`) → 고객지원 → 상품가입안내 → 가입조회 → 실명인증 후 출력 |

**주의사항**
- 모든 서류는 **PDF 또는 고해상도 스캔본 (이미지)** 으로 제출. 휴대폰으로 찍은 사진은 텍스트 인식이 안 되어 반려된다.
- 주민등록번호가 노출된 서류는 자체 마스킹 처리 후 제출 (Infobip에서 사전 가공해주지 않음).
- 발신번호가 070 인터넷 전화일 경우, 별도의 070 사업자 (예: LG 헬로비전, 삼성SDS) 가입증명원이 필요하다.

**심사 소요 기간**

| 단계 | 소요 시간 |
|---|---|
| Infobip 콘솔 신청 → CPaaS Registration Team 1차 검토 | **영업일 기준 1~2일** |
| 추가 서류 요청 → 국내 도매 사업자 제출 | 추가 1일 |
| 도매 사업자 → KISA DB 등록 반영 | **영업일 기준 1~3일** |
| **합계 (서류 무결할 경우)** | **영업일 기준 3~7일** |

서류가 1회 반려될 경우 +3~5일 추가, 따라서 **여유 있게 2주 (10영업일)** 를 잡고 사전 등록을 시작할 것.

---

### 2.4 사업자등록 없이 테스트하는 방법

**결론부터 말하면: KISA 등록 없이 한국 휴대폰 번호로 실제 SMS를 발송하는 합법적인 경로는 존재하지 않는다.** 단, 개발 단계에서 등록 절차를 우회하면서 코드를 검증할 수 있는 방법은 다음과 같이 4가지가 있다.

**옵션 1: Infobip Free Trial — Verified Number 만 사용 (✅ 일부 가능)**

Infobip Free Trial은 다음 조건으로 작동한다.
- 가입 시 SMS 인증을 통해 **본인 휴대폰 1개만 verified recipient로 등록 가능** (2026년 기준)
- 트라이얼 기간: 가입 후 60일
- 무료 메시지: 채널당 100건
- **Sender ID:** `InfoSMS`, `ServiceSMS` 등 Infobip 공유 alphanumeric sender 가 자동 사용됨

**한국에서의 실제 동작:**
- 본인 명의 한국 휴대폰을 verified recipient로 등록하면 SMS 수신은 가능하지만, **Sender ID가 alphanumeric이므로 한국 통신사가 일부 차단할 수 있다.** Infobip이 한국 트래픽에 대해서는 자동으로 numeric long code (009/006 prefix) 로 변환하여 발송하지만, 도달률은 90% 미만으로 떨어질 수 있다.
- 즉, **개발자 본인 휴대폰으로 OTP 수신 테스트는 가능**하지만, **다른 사용자에게는 절대 발송 불가** (verified 안 된 수신자).
- 통신사 측에서 `[국제발신]` 태그가 자동 부착되어 도착하므로 사용자 경험은 프로덕션과 다르다.

**옵션 2: Mock 모드로 dev 환경 운영 (✅ 이미 Grapit에 구현됨)**

Grapit의 `sms.service.ts:60-66`은 `NODE_ENV !== 'production'`이고 INFOBIP env 중 하나라도 비어 있으면 자동으로 `isDevMock=true`로 전환한다. 이 상태에서는:
- 모든 `sendVerificationCode` 호출은 logger.warn 1줄과 `{success:true}` 응답으로 끝나며 **단 1원도 과금되지 않음**
- verify-code는 `code: "000000"` (zero 6개)만 통과 (`sms.service.ts:163-169`)
- E2E 테스트 `signup-sms.spec.ts`는 mock 000000 flow로 회원가입 3단계를 완주

**옵션 3: 1인 사업자등록 후 정식 등록 (✅ 권장 — 1인 개발자도 손쉬움)**

- **간이 개인사업자등록**: 홈택스 (`hometax.go.kr`) → 신청/제출 → 사업자등록 신청 (개인). 비대면, **수수료 0원, 즉시 발급 (당일)**.
- 업종 코드: `722000 (응용 소프트웨어 개발 및 공급업)` 또는 `639100 (포털 및 기타 인터넷 정보매개 서비스업)` 추천.
- 사업자등록 후 **부가가치세 간이과세자** 신청 시 연 매출 8,000만원 미만은 세금 부담이 거의 없다.
- 발급 즉시 사업자등록증 PDF 다운로드 → Infobip 신청에 사용 가능.

**1인 개발자에게 가장 합리적인 경로**: 옵션 2 (mock 모드)로 개발을 진행하면서, 동시에 옵션 3 (사업자등록 → KISA 등록) 절차를 시작하면 베타 테스트 시점에는 정식 등록이 완료되어 있다.

**옵션 4: 국내 SMS 사업자(NHN Bizgo, SOLAPI 등) 의 "개인 명의 등록" 활용 (❌ Infobip 대체)**

만약 사업자등록증이 정말로 없고 빠르게 한국 OTP가 필요하다면, Infobip 대신 **국내 사업자가 제공하는 개인 명의 등록 옵션**을 사용할 수도 있다.
- SOLAPI / NHN Bizgo / CoolSMS / 비즈고 등은 개인 계정도 통신서비스 이용증명원만으로 발신번호 등록을 받아준다 (사업자등록증 불필요).
- 단점: 한국 외 글로벌 SMS 발송 시 별도 사업자와 이중 관리 필요. Grapit이 향후 글로벌 확장을 고려한다면 Infobip 단일화가 유리.

**중요 — 절대로 작동하지 않는 시도들:**
- ❌ 한국이 아닌 국가의 sender ID로 한국 번호에 발송 → 도달은 되지만 `[국제발신]` 태그 강제 부착으로 OTP UX 훼손, 또한 도달률 50% 이하
- ❌ 미등록 번호로 발송 → API 응답은 `PENDING_ACCEPTED` 가 와도 실제로는 도매 사업자 단계에서 차단됨 (delivery report에서 `REJECTED_DESTINATION` 또는 `EXPIRED` 상태로 확인됨)
- ❌ Twilio Verify로 우회 → Twilio도 동일한 KISA 규제를 받으므로 결과는 동일

---

### 2.5 Alphanumeric vs Numeric Sender ID

**한국은 Numeric Only (규제 강제)**

KISA 발신번호 사전등록제는 발신번호의 형태를 **숫자(휴대폰/유선/070)** 로만 한정한다. Alphanumeric sender (예: `Grapit`, `GRAPIT-OTP`) 는 한국 이동통신사 3사(SKT, KT, LG U+) 가 모두 차단한다.

| 항목 | 한국 (KR) | 미국 (US) | 영국 (UK) | 싱가포르 (SG) |
|---|---|---|---|---|
| Numeric long code | ✅ (필수) | ✅ (10DLC 등록 필요) | ✅ | ✅ |
| Short code | ❌ (외국 사업자 불가) | ✅ | ✅ | ✅ |
| Alphanumeric sender | ❌ **금지** | ⚠️ Toll-Free 대체 | ✅ (등록 후 가능) | ✅ |
| 사전등록 의무 | ✅ KISA | ✅ TCR | ⚠️ 일부 사업자 | ✅ IMDA |

**Infobip의 한국 동작 방식**
- Infobip API에 alphanumeric sender ID (`from: "Grapit"`) 를 전달하면, Infobip이 자동으로 해당 트래픽을 international long code (009/006 prefix) 로 변환하거나, 등록된 numeric sender 로 fallback 한다.
- 이 fallback은 도달률을 보장하지 않으므로, **한국 트래픽은 처음부터 등록된 numeric sender ID를 명시적으로 지정하는 것이 안전**하다.

**숫자 발신번호의 종류**
| 형태 | 예시 | Grapit 권장 여부 |
|---|---|---|
| 휴대폰 (010) | `01012345678` | ✅ 1인 개발자에게 가장 간편 (본인 명의) |
| 유선 (02, 031, 02-XXX-XXXX) | `0212345678` | ✅ 사업자 명의 등록 시 신뢰도 ↑ |
| 070 인터넷 전화 | `07012345678` | ⚠️ 별도 070 사업자 가입증명서 필요 |
| 1588/1577 대표번호 | `15881234` | ❌ 별도 계약/비용 발생, 1인 개발자 부적합 |

**메시지 태그 자동 부착**
한국에서 발송되는 모든 A2P SMS는 메시지 본문 앞에 통신사가 자동으로 태그를 붙인다.
- 광고성: `[Web발신]` (정보통신망법 제50조)
- 국제 발신: `[국제발신]` (외국 사업자가 발송 시)
- 인증 (transactional): 일반적으로 태그 없음, 단 발송 경로에 따라 `[Web발신]` 부착 가능

OTP는 transactional 분류이므로 사용자에게 보일 메시지 길이를 80바이트 이내로 작성하는 것이 안전하다 (140바이트 제한 - EUC-KR 인코딩이라 한글 1자 = 2바이트).

---

### 2.6 승인 후 확인 방법

**Infobip 콘솔에서 상태 확인**

1. 좌측 메뉴: **Channels and Numbers > My Requests > Sender requests**
2. 신청한 sender 행을 클릭
3. 상태 컬럼이 다음 중 하나로 표시됨:

| 상태 | 의미 | 다음 액션 |
|---|---|---|
| `Pending` | 신청 접수 (CPaaS 팀 검토 대기) | 대기 (영업일 1~2일) |
| `In Review` | 추가 서류 요청 가능성 | 이메일 확인, 빠르게 회신 |
| `Approved` | KISA DB 등록 완료, 발송 가능 | 다음 단계 진행 |
| `Active` | 트래픽 송출 활성화 | 정상 사용 |
| `Rejected` | 반려 | 사유 확인 후 재신청 |

**Application과 Message Template에 sender 연결**

Infobip 2FA API는 Application → Message Template → Sender 의 3단 구조다.

1. **2FA Applications** 메뉴에서 새 application 생성 (§1.3 참고)
2. **Message Templates** 에서 템플릿 생성:
   ```
   Sender: 01012345678  (✅ 위에서 Active 상태인 sender 만 선택 가능)
   Language: ko (Korean)
   Pin Type: NUMERIC
   Pin Length: 6
   Message Text: [Grapit] 인증번호 {{pin}} (3분 이내 입력)
   PIN Time-to-Live: 3m
   ```
3. **API 호출 시**: Grapit의 `infobip-client.ts`가 자동으로 처리 (§1.4 참고)

**발송 검증 체크리스트**
- [ ] Sender 상태가 `Active` 인지 콘솔에서 확인
- [ ] Application과 Message Template이 동일 sender 에 연결되었는지
- [ ] API 응답의 `smsStatus` 가 `MESSAGE_SENT` 인지 (단순 `PENDING_ACCEPTED`는 큐 진입만 의미)
- [ ] Delivery Report (Infobip Logs) 에서 `DELIVERED` 상태 확인 (`REJECTED_DESTINATION` 이면 KISA 등록 누락)

---

### 2.7 1인 개발자 현실 가이드

**시나리오 A: 사업자등록증이 없는 단계**

| 단계 | 작업 | 소요 시간 | 비용 |
|---|---|---|---|
| 1 | Infobip Free Trial 가입, 본인 휴대폰을 verified recipient로 등록 | 10분 | 무료 |
| 2 | `apps/api/src/modules/sms/` 에 이미 구현된 mock 모드 활용 | 이미 완료 | — |
| 3 | dev/staging 에서는 mock, 본인 휴대폰만 Infobip Free Trial로 실측 검증 | 1일 | 무료 |
| 4 | 홈택스에서 간이 개인사업자등록 신청 (당일 발급) | 30분 | 무료 |
| 5 | 통신서비스 이용증명원 발급 (본인 명의 휴대폰) | 5분 | 무료 |
| 6 | Infobip 콘솔에서 Sender Registration 신청 + 서류 업로드 | 30분 | 무료 |
| 7 | 승인 대기 (영업일 3~7일) | — | — |
| 8 | Active 상태 확인 후 프로덕션 환경 변수 업데이트 | 5분 | — |

**총 캘린더 기간: 약 2주 (사업자등록 + KISA 등록 병행)**
**총 비용: 0원** (Free Trial 100건 + 간이과세자)

**승인 대기 중에 할 수 있는 개발 작업 (병행 권장)**
- ✅ Phase 10의 OTP 발송/검증 비즈니스 로직 (완료된 상태)
- ✅ Valkey 기반 PIN TTL, 재발송 쿨다운, 발송 횟수 제한 (완료된 상태)
- ✅ Playwright E2E 시나리오 (mock OTP를 로그에서 추출) (완료된 상태)
- ✅ Sentry OTP 실패율 메트릭 수집 (완료된 상태)
- ✅ 회원가입 → 휴대폰 인증 → 본인확인 플로우 UI (완료된 상태)

**시나리오 B: 사업자등록증이 이미 있는 경우**

위 표에서 4단계 (사업자등록) 를 건너뛰면 된다. **총 캘린더 기간 약 1주** 로 단축.

**1인 개발자가 흔히 빠지는 함정**
- ❌ "트라이얼로 일단 출시하고 나중에 등록하자" → Free Trial은 본인 휴대폰 1개만 발송 가능. 베타 테스터 5명에게도 못 보낸다.
- ❌ "환경 변수만 바꾸면 동작할 줄 알았는데..." → 환경 변수가 맞아도 Sender 가 `Pending` 이면 Infobip이 거절. 콘솔 상태를 매번 확인해야 함.
- ❌ "Twilio가 더 쉬울까?" → 둘 다 동일한 KISA 규제를 받으므로 절차는 동일. 단가는 Infobip 이 약 30% 저렴.
- ❌ "사업자등록증을 일단 미루자" → 옳음. 단, **베타 출시 D-3주 시점**에는 반드시 등록 시작 (KISA 영업일 7일 + 버퍼).

**최종 권고**
사업자등록증이 없다면 **즉시 다음 두 가지를 병행**한다.
1. **개발**: mock 모드로 Phase 10의 모든 OTP 로직을 완성하고 본인 휴대폰만 Free Trial 로 실측.
2. **행정**: 홈택스에서 사업자등록 (당일) → 통신증명원 발급 (5분) → Infobip 콘솔에서 Sender 등록 신청 (영업일 3~7일).

이 두 트랙을 병행하면 Phase 10 완료 시점에 KISA 등록도 완료되어 있어 **베타 출시에 실 사용자에게 OTP 발송이 가능**해진다.

---

## 3. 로컬 개발 서버에서 실 SMS 테스트

> **목표**: staging/prod 배포 없이 자기 PC에서 `pnpm dev`만으로 Infobip SMS 1건을 실제로 받아본다.
> **소요 시간**: Infobip 계정·KISA 발신번호가 준비된 상태에서 약 15분.
> **전제**: 모노레포 루트 = `/Users/sangwopark19/icons/grapit`, web=3000/api=8080.

### 3.1 사전 체크리스트

아래 항목 중 하나라도 빠지면 발송이 실패하거나 4xx로 막힌다. 코드 작업 전에 모두 확인한다.

- [ ] **KISA 발신번호 등록 완료** (§2 참고)
  - 한국 SMS는 KISA 사전등록제 적용 대상이라 미등록 번호로는 Infobip이 사업자에게 통보 후 차단한다.
  - `apps/api/src/modules/sms/infobip-client.ts:49` 의 `from: 'Grapit'`은 **alphanumeric sender** 라서 한국향(+82)에는 사용 불가하다 — Infobip 측 한국 routing이 자동으로 등록된 KISA 번호로 치환해 주기 때문에, Infobip Portal → "Senders" 메뉴에서 해당 alphanumeric을 KISA 번호와 매핑해 두어야 한다. (매핑이 없으면 첫 호출에서 `403 Forbidden / NO_KOREA_SENDER` 반환)
- [ ] **Infobip 2FA 리소스 3종 생성 완료** (§1.3~§1.5 참고)
  - Application (`pinAttempts: 5`, `pinTimeToLive: 3m`)
  - Message Template (한글 본문, `{{pin}}` placeholder 포함)
  - API Key (Permission = `2fa:pin:send` + `2fa:pin:manage`)
  - 위 3개의 ID/Key를 메모해 둔다 (3.3에서 사용).
- [ ] **본인 테스트 번호가 Infobip Verified Number 목록에 등록**
  - Free Trial 계정은 *verified destination*에만 발송 가능. Portal → "Account Settings → Test Numbers"에 본인 휴대폰 번호를 OTP로 등록해 둔다.
  - 유료 plan(Pay-as-you-go)으로 전환했다면 이 단계는 skip.
- [ ] **Docker Desktop 또는 OrbStack 기동** — 3.2의 Valkey 컨테이너를 띄울 수 있어야 함.
- [ ] **PostgreSQL 컨테이너 기동** — 회원가입 플로우는 user 테이블 INSERT까지 가야 검증이 끝나므로 `docker compose up -d postgres` 먼저 실행.

---

### 3.2 로컬 Valkey 실행

`apps/api/src/app.module.ts:32-46`의 ThrottlerModule은 `REDIS_CLIENT`를 주입받아 `incr` 메서드 존재 여부로 실 Valkey/Redis인지 InMemory mock인지 분기한다. **dev mock(InMemoryRedis)에는 `incr`가 없어서 throttle storage가 비활성화되어 IP axis가 무한 허용**되므로, 실 SMS 테스트 전에는 반드시 외부 Valkey/Redis를 띄워야 한다.

#### Option A) Docker 1-liner (권장, Mac M1/M2/M3 모두 지원)

```bash
docker run -d --name grapit-valkey \
  -p 6379:6379 \
  --restart unless-stopped \
  valkey/valkey:8-alpine
```

- Valkey는 Redis 7.2 fork OSS이며 8.x는 2026년 1분기 기준 stable. Redis 라이선스 변경(SSPL)을 회피한 정통 fork라 ioredis client와 100% wire-compatible.
- Apple Silicon은 `valkey/valkey:8-alpine` multi-arch 이미지가 자동으로 `linux/arm64` 변종을 받는다.

#### Option B) docker-compose에 추가

`docker-compose.yml`에 service 한 블록만 더 붙이면 postgres와 함께 한 번에 기동 가능:

```yaml
services:
  postgres:
    # ...기존 그대로
  valkey:
    image: valkey/valkey:8-alpine
    container_name: grapit-valkey
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

#### Option C) Homebrew native (Docker를 안 쓰는 경우)

```bash
brew install valkey
brew services start valkey
```

#### 동작 확인

```bash
docker exec grapit-valkey valkey-cli ping
# → PONG
```

`REDIS_URL` 형식은 `redis://[user[:pass]]@host:port[/db]` — 로컬 dev에서 인증 없이 띄웠다면 그냥 `redis://localhost:6379`.

---

### 3.3 .env 구성

> **루트 .env에만 추가한다**. `apps/api/`나 `apps/web/`에 별도 `.env`를 만들면 안 됨.
> `app.module.ts`에서 `envFilePath: '../../.env'`로 명시되어 있어 NestJS `ConfigModule`이 모노레포 루트 `.env`를 읽는다.

루트 `/Users/sangwopark19/icons/grapit/.env`에 아래 키를 추가/수정:

```dotenv
# === Node 환경 ===
# 반드시 production이 아닌 값. 비워두거나 development 권장.
# (prod로 두면 sms.service.ts:60에서 Error throw하며 boot 실패함)
NODE_ENV=development

# === Valkey/Redis (3.2에서 띄운 컨테이너) ===
# 미설정 시 InMemoryRedis fallback이 동작해 throttle이 무력화됨
REDIS_URL=redis://localhost:6379

# === Infobip 4종 (전부 채워야 dev mock이 꺼짐) ===
# 하나라도 빈 문자열이면 isDevMock=true가 되어 실제 발송 대신 logger.warn으로 끝남
INFOBIP_API_KEY=abcd1234ef567890abcd1234ef567890-xxxx-xxxx-xxxx-xxxxxxxxxxxx
INFOBIP_BASE_URL=https://xxxxx.api.infobip.com
INFOBIP_APPLICATION_ID=XXXXXXXXXXXXXXXXXXXXXXXX
INFOBIP_MESSAGE_ID=XXXXXXXXXXXXXXXXXXXXXXXX

# === 회원가입 플로우 의존 (이미 있을 가능성 높음) ===
DATABASE_URL=postgresql://grapit:grapit_dev@localhost:5432/grapit
JWT_SECRET=dev-only-jwt-secret-please-rotate
JWT_REFRESH_SECRET=dev-only-jwt-refresh-secret-please-rotate
FRONTEND_URL=http://localhost:3000

# === 웹 → API 연결 ===
NEXT_PUBLIC_API_URL=http://localhost:8080
```

**주의 사항**
- `INFOBIP_API_KEY` 값은 **raw key 값만** 넣는다 (`App ` prefix 없이). 코드(`infobip-client.ts:43`)에서 `Authorization: \`App ${this.apiKey}\``로 prefix를 붙이므로 prefix를 또 넣으면 `App App xxx`가 되어 401.
- `INFOBIP_BASE_URL`은 계정마다 sub-domain이 다르다. 끝에 `/`나 `/2fa/2/pin` 같은 경로 붙이지 않음.
- `.env`는 `.gitignore`에 포함되어 커밋되지 않는다.

---

### 3.4 dev mock 비활성화 확인

`apps/api/src/modules/sms/sms.service.ts:42-74` 생성자가 dev mock 분기를 결정한다:

```ts
// sms.service.ts:47-66
const apiKey = configService.get<string>('INFOBIP_API_KEY')?.trim() ?? '';
const baseUrl = configService.get<string>('INFOBIP_BASE_URL')?.trim() ?? '';
const applicationId = configService.get<string>('INFOBIP_APPLICATION_ID')?.trim() ?? '';
const messageId = configService.get<string>('INFOBIP_MESSAGE_ID')?.trim() ?? '';
const isProduction = process.env['NODE_ENV'] === 'production';

const missing = [
  !apiKey && 'INFOBIP_API_KEY',
  !baseUrl && 'INFOBIP_BASE_URL',
  !applicationId && 'INFOBIP_APPLICATION_ID',
  !messageId && 'INFOBIP_MESSAGE_ID',
].filter(Boolean) as string[];

if (isProduction && missing.length > 0) {
  throw new Error(
    `[sms] ${missing.join(', ')} required in production. Silent dev mock disabled.`,
  );
}

this.isDevMock = !isProduction && missing.length > 0;
this.client = this.isDevMock
  ? null
  : new InfobipClient(baseUrl, apiKey, applicationId, messageId);
```

**진리표**

| `NODE_ENV` | INFOBIP 4종 상태 | 결과 |
|---|---|---|
| `production` | 1개라도 빈 값 | **boot 실패** (Error throw) |
| `production` | 모두 채워짐 | 실 Infobip 호출 |
| `development` (or unset) | 1개라도 빈 값 | dev mock (logger.warn `sms.credential_missing`) |
| **`development` (or unset)** | **모두 채워짐** | **실 Infobip 호출** ← 우리 목표 |

> **Tip**: 서버 기동 직후 stdout에서 `sms.credential_missing` 로그가 한 줄도 안 떠야 정상.

---

### 3.5 개발 서버 기동

루트에서 한 방에 띄운다:

```bash
cd /Users/sangwopark19/icons/grapit
pnpm dev
```

`package.json`의 `"dev": "turbo dev"`가 `apps/api`(`nest start --watch`)와 `apps/web`(`next dev --turbopack`)을 동시 기동한다.

#### 개별 기동 (디버깅 시)

```bash
# Terminal A
pnpm --filter @grapit/api dev

# Terminal B
pnpm --filter @grapit/web dev
```

#### 기동 직후 확인할 로그

API 콘솔에 아래 줄이 보이면 OK:

```
[Nest] LOG [NestApplication] Nest application successfully started
API server running on http://localhost:8080
```

그리고 **다음 로그가 보이면 안 된다**:

```
WARN [SmsService] {"event":"sms.credential_missing","mode":"dev_mock"}
```

이 줄이 떴다면 → 3.3의 INFOBIP 4종 중 하나가 빠졌거나 오타. `.env` 다시 점검 후 재기동.

추가로 **다음 줄이 안 떠야** 한다 (Valkey 연결 실패 시그널):

```
[redis] Redis unavailable — seat locking will fail. ...
```

이 줄이 보이면 3.2의 Valkey 컨테이너가 안 떴거나 6379 포트 충돌.

---

### 3.6 UI에서 실제 SMS 발송 테스트

1. 브라우저에서 **`http://localhost:3000/auth`** 열기.
2. 상단 탭에서 **"회원가입"** 클릭.
3. **Step 1**: 이메일 + 비밀번호 입력 → "다음".
4. **Step 2**: 약관 동의 (필수 2개) → "다음".
5. **Step 3 (전화번호 인증)**:
   - 이름/생년월일/성별/국가 입력.
   - **Phone 입력란에 본인 휴대폰 번호** (3.1에서 verified 등록한 번호) 입력. 한국 번호는 `010-0000-0000` mask가 자동 적용됨.
   - **"인증번호 발송"** 버튼 클릭.
   - **예상 API 로그**:
     ```
     [Nest] LOG [SmsService] {"event":"sms.sent","phone":"+821012345678","pinId":"abcd1234efgh5678"}
     ```
   - 약 5~10초 내로 **본인 휴대폰에 SMS 수신** (`[Grapit] 인증번호 123456 (3분 이내 입력)`).
6. **6자리 코드 입력** → **"확인"** 버튼 클릭.
   - **예상 로그**: `{"event":"sms.verified","phone":"+821012345678"}`
   - UI에 초록색 체크와 "인증 완료" 표시.
7. 나머지 회원가입 form을 마저 채워 제출하면 user 테이블에 INSERT 되며 메인으로 redirect.

#### 검증 포인트

| 단계 | 캡처 대상 | 검증 포인트 |
|---|---|---|
| 5-1 | "인증번호 발송" 버튼 클릭 직후 | 버튼 텍스트 → "발송 중..." spinner |
| 5-2 | SMS 수신 화면 | 발신번호가 KISA 등록된 번호로 표시 |
| 5-3 | 발송 후 30초 내 재발송 시도 | 버튼 텍스트 → "재발송 (NNs)" cooldown 표시 |
| 6-1 | 6자리 입력 직후 | timer가 03:00에서 카운트다운 |
| 6-2 | "확인" 클릭 후 | 초록 체크 + "인증 완료" |

---

### 3.7 직접 API curl 테스트

UI flow를 매번 거치기 번거로울 때 사용.

#### Send code

```bash
curl -i -X POST http://localhost:8080/api/v1/sms/send-code \
  -H 'Content-Type: application/json' \
  -d '{"phone":"010-1234-5678"}'
```

**예상 응답** (성공):
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"success":true,"message":"인증번호가 발송되었습니다"}
```

**예상 응답** (cooldown 30s 미경과 시):
```http
HTTP/1.1 429 Too Many Requests

{"statusCode":429,"message":"잠시 후 다시 시도해주세요","retryAfterMs":24812}
```

#### Verify code

```bash
curl -i -X POST http://localhost:8080/api/v1/sms/verify-code \
  -H 'Content-Type: application/json' \
  -d '{"phone":"010-1234-5678","code":"123456"}'
```

**예상 응답** (성공):
```http
HTTP/1.1 200 OK

{"verified":true}
```

**예상 응답** (PIN expired/no record):
```http
HTTP/1.1 410 Gone

{"statusCode":410,"message":"인증번호가 만료되었습니다. 재발송해주세요"}
```

#### Dev mock 모드일 때 verify shortcut

INFOBIP env를 비워둔 dev mock 상태에서는 `code: "000000"`이 universal pass 코드:

```bash
curl -X POST http://localhost:8080/api/v1/sms/verify-code \
  -H 'Content-Type: application/json' \
  -d '{"phone":"010-1234-5678","code":"000000"}'
# → {"verified":true}
```

실 Infobip 모드에서는 `000000`도 그냥 잘못된 코드로 처리되니 혼동 주의.

---

### 3.8 자주 겪는 오류와 해결

#### (a) KISA 미등록 번호로 발송 시 — 4xx Sentry 캡처

**증상**: API 로그에 `{"event":"sms.send_failed", ... "Infobip API 400: NO_KOREA_SENDER ..."}`. 사용자에게는 `400 인증번호 발송에 실패했습니다. 잠시 후 다시 시도해주세요.` 응답.

**원인**: `infobip-client.ts:49`의 `from: 'Grapit'` alphanumeric sender가 Infobip Portal에서 KISA 등록된 한국 발신번호와 매핑되지 않음.

**해결**:
1. Infobip Portal → "Senders" → "South Korea" 영역에서 KISA 등록된 발신번호 추가.
2. 해당 발신번호와 alphanumeric `Grapit`을 routing rule로 매핑.
3. 실패 후 30초 기다렸다 재시도.

#### (b) `INFOBIP_APPLICATION_ID` / `MESSAGE_ID` 오타 — 404

**증상**: `Infobip API 404: Application not found` 또는 `Message Template not found`.

**해결**:
1. Portal → "Applications" → 해당 Application 클릭 → URL bar의 마지막 segment가 ApplicationId.
2. `.env` 값 trim — 공백/개행 제거.
3. API 재기동 (`nest start --watch`는 `.env` 변경 자동 reload하지 않으므로 Ctrl+C 후 `pnpm dev`).

#### (c) Valkey 미기동 — Throttle 무한 허용 (보안 구멍)

**증상**: `curl`로 5번 연속 send-code 호출해도 IP throttle 20/h 가 안 걸림.

**원인**: `app.module.ts`에서 `redis.incr` 함수 존재 여부로 InMemoryRedis vs 실 Redis를 분기하는데, InMemoryRedis에는 `incr`가 구현되어 있지 않다 → ThrottlerStorage 비활성화.

**해결**:
- 3.2의 Valkey 컨테이너가 떠 있는지 `docker ps | grep valkey`로 확인.
- `REDIS_URL` 값이 정확히 `redis://localhost:6379`인지 확인.

#### (d) `NODE_ENV=production`인데 INFOBIP env 미주입 — boot 실패

**증상**: `pnpm dev` 직후 즉시 죽음:
```
Error: [sms] INFOBIP_API_KEY, INFOBIP_BASE_URL, INFOBIP_APPLICATION_ID, INFOBIP_MESSAGE_ID required in production. Silent dev mock disabled.
```

**해결**: 로컬 테스트라면 `NODE_ENV=development` (혹은 unset)로 바꾼다.

---

### 3.9 비용 및 안전장치

#### 비용 (2026-04 시점, 한국 향)

- Infobip 한국 SMS = **건당 약 30~35원** (KISA 등록번호 발신 기준).
- 로컬 테스트로 100건 발송 = 약 3,000~3,500원.
- Free Trial 계정은 verified number에만 발송 가능하고 별도 trial credit이 차감됨.

#### 자동 안전장치 (이미 구현됨)

| 축 | Limit | Window | 위치 |
|---|---|---|---|
| Phone resend cooldown | 1회 (NX lock) | 30s | `sms.service.ts:104-114` |
| Phone send | 5회 | 1h | `sms.service.ts:117-127` (Lua atomic INCR) |
| Phone verify | 10회 | 15min | `sms.service.ts:173-183` |
| IP send (Throttler) | 20회 | 1h | `sms.controller.ts:35` |
| IP verify (Throttler) | 10회 | 15min | `sms.controller.ts:47` |

#### 실 발송 즉시 중단 (panic switch)

```bash
# .env에서 한 줄만 비우면 됨
INFOBIP_API_KEY=
```

이후 API 재기동 (`Ctrl+C` → `pnpm dev`) 하면 dev mock으로 전환되어 **단 1원도 과금되지 않음**.

---

## 4. 프로덕션 배포 경로 (GCP Cloud Run)

> 본 섹션은 Phase 10의 프로덕션 배포 절차와 최종 휴먼 검증 단계를 정의한다. 모든 명령은 macOS / zsh 기준이며, GCP 프로젝트 ID는 `grapit-prod`, 리전은 `asia-northeast3`(서울)로 고정한다.

---

### 4.1 배포 전 사전 점검

> 아래 5개 항목 중 하나라도 미충족이면 4.2 이후 단계를 절대 진행하지 않는다.

- [ ] **KISA 발신번호 사전등록 "Approved" 상태 확인**
  - Infobip Portal > Number Management 에서 한국 발신번호가 `Active` / `Approved` 인지 캡처
  - 블로커: 미승인 상태에서 send-pin 호출 시 Infobip이 4xx로 차단 → SMS 미수신 + Sentry alert 폭주 → 즉시 롤백 필요
- [ ] **Infobip 4종 값 손에 들고 있기** (§1.7 참고)
  - `INFOBIP_API_KEY`, `INFOBIP_BASE_URL`, `INFOBIP_APPLICATION_ID`, `INFOBIP_MESSAGE_ID`
  - 블로커: API Key는 재표시 불가. 분실 시 §1.5부터 재발급
- [ ] **Infobip Application 설정 4종 일치 확인**
  - `pinAttempts=5`, `pinType=NUMERIC`, `pinLength=6`, `pinTimeToLive=3m`
  - `sendPinPerPhoneNumberLimit=5/1h` 도 함께 설정되어 있는지
- [ ] **로컬 dev smoke 통과** (§3 완료)
  - 실 번호로 1건 수신 확인 완료 상태
- [ ] **`main` 브랜치가 최신 상태**
  ```bash
  git fetch origin
  git checkout main
  git pull --ff-only origin main
  git status   # working tree clean 이어야 함
  ```

---

### 4.2 GCP Secret Manager 업데이트

> Twilio → Infobip 마이그레이션. **Cloud Run 시크릿 ID는 lowercase-kebab 컨벤션**(`infobip-api-key`)을 따른다. 환경변수 이름(UPPER_SNAKE)과 다르므로 혼동 주의.

#### 4.2.1 기존 TWILIO_* 시크릿 삭제

```bash
for SECRET in twilio-account-sid twilio-auth-token twilio-verify-service-sid; do
  gcloud secrets delete "$SECRET" \
    --project=grapit-prod \
    --quiet 2>/dev/null || echo "skip: $SECRET (not found)"
done
```

#### 4.2.2 INFOBIP_* 시크릿 4종 생성

```bash
# 1) API Key (재표시 불가 — 1Password 백업 필수)
echo -n "<INFOBIP_API_KEY>" | gcloud secrets create infobip-api-key \
  --project=grapit-prod \
  --replication-policy=user-managed \
  --locations=asia-northeast3 \
  --data-file=-

# 2) Base URL
echo -n "<INFOBIP_BASE_URL>" | gcloud secrets create infobip-base-url \
  --project=grapit-prod \
  --replication-policy=user-managed \
  --locations=asia-northeast3 \
  --data-file=-

# 3) Application ID
echo -n "<INFOBIP_APPLICATION_ID>" | gcloud secrets create infobip-application-id \
  --project=grapit-prod \
  --replication-policy=user-managed \
  --locations=asia-northeast3 \
  --data-file=-

# 4) Message ID
echo -n "<INFOBIP_MESSAGE_ID>" | gcloud secrets create infobip-message-id \
  --project=grapit-prod \
  --replication-policy=user-managed \
  --locations=asia-northeast3 \
  --data-file=-
```

> **`echo -n` 주의**: `-n` 빠지면 trailing newline이 secret 값에 포함되어 Infobip 401 발생.
> **`--replication-policy=user-managed`**: 데이터 거주성. asia-northeast3 단일 리전 고정.

#### 4.2.3 Cloud Run 서비스 계정에 secretAccessor IAM 부여

```bash
for SECRET in infobip-api-key infobip-base-url infobip-application-id infobip-message-id; do
  gcloud secrets add-iam-policy-binding "$SECRET" \
    --project=grapit-prod \
    --member="serviceAccount:grapit-cloudrun@grapit-prod.iam.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
done
```

> **블로커**: IAM 부여 누락 시 Cloud Run 새 리비전이 `Permission denied on secret` 에러로 부팅 실패.

#### 4.2.4 검증

```bash
# 4종 시크릿 + 리전 확인
gcloud secrets list --project=grapit-prod \
  --filter="name~infobip" \
  --format="table(name,replication.userManaged.replicas[0].location,createTime)"

# Twilio 잔재 없는지 확인 (출력 0줄이어야 함)
gcloud secrets list --project=grapit-prod --filter="name~twilio"

# 값 sanity check (API Key 처음 4자만 노출)
gcloud secrets versions access latest \
  --secret=infobip-api-key --project=grapit-prod | head -c 4 ; echo "..."
```

---

### 4.3 Cloud Run 서비스 업데이트 (GitOps 우선)

> **원칙**: 시크릿/환경변수 바인딩 변경은 `.github/workflows/deploy.yml` 수정 + main 머지로 처리한다.

#### 4.3.1 정상 경로 — `deploy.yml` 의 `secrets:` 블록 패치

`apps/api` 잡의 `deploy-cloudrun@v3` step `secrets:` 리스트에 4줄 추가:

```yaml
secrets: |
  DATABASE_URL=database-url:latest
  JWT_SECRET=jwt-secret:latest
  # ... (기존 라인 유지) ...
  INFOBIP_API_KEY=infobip-api-key:latest
  INFOBIP_BASE_URL=infobip-base-url:latest
  INFOBIP_APPLICATION_ID=infobip-application-id:latest
  INFOBIP_MESSAGE_ID=infobip-message-id:latest
```

머지 → CI 통과 → `workflow_run` 트리거로 deploy job 자동 실행.

#### 4.3.2 Hotfix 경로 — 수동 `gcloud run services update`

```bash
gcloud run services update grapit-api \
  --project=grapit-prod \
  --region=asia-northeast3 \
  --update-secrets=INFOBIP_API_KEY=infobip-api-key:latest,INFOBIP_BASE_URL=infobip-base-url:latest,INFOBIP_APPLICATION_ID=infobip-application-id:latest,INFOBIP_MESSAGE_ID=infobip-message-id:latest \
  --remove-env-vars=TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN,TWILIO_VERIFY_SERVICE_SID
```

> **수동 update 직후 반드시 deploy.yml 도 동일하게 수정 + 커밋**. 안 그러면 다음 main 머지에서 INFOBIP_* 4종이 자동으로 사라진다.

#### 4.3.3 새 리비전 확인

```bash
gcloud run revisions list \
  --service=grapit-api \
  --project=grapit-prod \
  --region=asia-northeast3 \
  --limit=3 \
  --format="table(metadata.name,status.conditions[0].status,spec.containers[0].env)"
```

---

### 4.4 GitHub Actions Secrets 교체

> 현재 정책: CI는 dev mock 모드로만 SMS 검증 → INFOBIP_* 를 GitHub Secrets에 등록하지 않는다.

#### 4.4.1 Twilio 잔재 삭제

```bash
gh secret delete TWILIO_ACCOUNT_SID --repo grapit-org/grapit
gh secret delete TWILIO_AUTH_TOKEN --repo grapit-org/grapit
gh secret delete TWILIO_VERIFY_SERVICE_SID --repo grapit-org/grapit
```

#### 4.4.2 워크플로우 파일에서 TWILIO 잔재 검증

```bash
# 0줄이어야 함
grep -rni "twilio" .github/workflows/
```

#### 4.4.3 등록된 GitHub Secrets 목록 확인

```bash
gh secret list --repo grapit-org/grapit
```

---

### 4.5 CI/CD 배포 트리거

#### 4.5.1 트리거 메커니즘

`.github/workflows/deploy.yml`에 정의된 트리거:

```yaml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]
```

**수동 트리거 없음. main 에 머지되면 → CI 실행 → CI 성공 시 Deploy 자동 실행.**

#### 4.5.2 인증 — Workload Identity Federation

```yaml
- id: auth
  uses: google-github-actions/auth@v3
  with:
    workload_identity_provider: ${{ secrets.GCP_WIF_PROVIDER }}
    service_account: ${{ secrets.GCP_SERVICE_ACCOUNT }}
- uses: google-github-actions/setup-gcloud@v3
```

OIDC 토큰 → GCP STS → 단기 access token. 키 로테이션 불필요.

#### 4.5.3 트리거 실행 후 모니터링

```bash
# CI + Deploy 진행 상황 추적
gh run watch --repo grapit-org/grapit

# 또는 가장 최근 deploy run 의 로그
gh run view --repo grapit-org/grapit --log
```

---

### 4.6 배포 완료 검증

> 배포 완료 직후 **5분 안에** 아래 4개 항목 전부 통과해야 4.7 (실 SMS smoke) 로 진행한다.

#### 4.6.1 Cloud Run 새 리비전이 `serving` 상태인지 확인

```bash
gcloud run services describe grapit-api \
  --project=grapit-prod \
  --region=asia-northeast3 \
  --format="value(status.url,status.latestReadyRevisionName,status.traffic[0].revisionName,status.traffic[0].percent)"
```

기대: `latestReadyRevisionName == status.traffic[0].revisionName` 이고 `percent == 100`.

#### 4.6.2 `/api/v1/health` 200 OK 확인

```bash
API_URL=$(gcloud run services describe grapit-api \
  --project=grapit-prod --region=asia-northeast3 \
  --format="value(status.url)")

curl -i "$API_URL/api/v1/health"
```

기대: `HTTP/2 200`, body `{"status":"ok","info":{"redis":{"status":"up"}},...}`.

> **중요**: `sms.service.ts:60-64` 의 production guard 가 INFOBIP_* 누락 시 생성자에서 throw → NestJS 부팅 실패 → `/health` 가 5xx가 아니라 **connection refused / 503**으로 돌아온다. 200 이 떨어지면 4종 시크릿이 정상 마운트된 것.

#### 4.6.3 Sentry 에러 이벤트 5분 모니터링

- Sentry 대시보드 → Project `grapit-api` → Issues → Filter: `release:<NEW_REVISION_SHA>` + `last 5 minutes`
- 새 이벤트 0건이어야 함
- 특히 검색: `event.tag.provider:infobip`, `[sms] INFOBIP_* required in production`

#### 4.6.4 Cloud Run 로그에서 부팅 메시지 확인

```bash
gcloud run services logs read grapit-api \
  --project=grapit-prod \
  --region=asia-northeast3 \
  --limit=50 \
  --format="value(textPayload)" | grep -E "Nest application|sms|INFOBIP"
```

기대: `Nest application successfully started`. **NOT** 기대: `sms.credential_missing`, `INFOBIP_API_KEY required in production`.

---

### 4.7 프로덕션 smoke test (Phase 10 final human verification)

> **이 테스트가 `10-HUMAN-UAT.md` 의 "Test 1: 실제 SMS OTP 수신 확인" 의 최종 종결 조건이다.**

#### 4.7.1 사전 준비

- 본인 한국 휴대폰 번호 (e.g., `+82-10-XXXX-XXXX`) — KISA 등록 발신번호로부터 수신 가능해야 함
- 비용: SMS 1건 ~30원 + verify ~5원 ≈ **35원**
- 비용 추적: Infobip Portal > Finance > Usage 에서 실시간 확인

#### 4.7.2 Web UI를 통한 end-to-end 검증

1. 브라우저로 `https://<CLOUD_RUN_WEB_URL>/signup` 접속 (시크릿 모드 권장)
2. 회원가입 폼에서 본인 휴대폰 번호 입력 → "인증번호 받기" 클릭
3. **타이머**: 시계 시작 — SMS 도달까지 (목표 < 10s, 허용 < 30s)
4. SMS 수신 확인:
   - 발신자: KISA 등록 발신번호와 일치
   - 메시지 형식: `[Grapit] 인증번호 XXXXXX (3분 이내 입력)`
   - 6자리 숫자
5. 받은 6자리를 입력 필드에 입력 → "확인" 클릭
6. 200 OK + "인증되었습니다" 토스트 → 다음 가입 단계로 진행
7. **idempotent verify 검증**: 같은 코드를 한 번 더 입력 → 여전히 verified (`allowMultiplePinVerifications=true`)

#### 4.7.3 구조화 로그 확인

```bash
gcloud run services logs read grapit-api \
  --project=grapit-prod \
  --region=asia-northeast3 \
  --limit=100 \
  --format=json | jq -r '.[] | select(.jsonPayload.event=="sms.sent" or .jsonPayload.event=="sms.verified") | "\(.timestamp) \(.jsonPayload.event) phone=\(.jsonPayload.phone) pinId=\(.jsonPayload.pinId // "-")"'
```

기대 출력:
```
2026-04-16T... sms.sent     phone=+8210XXXXYYYY pinId=abc123-...
2026-04-16T... sms.verified phone=+8210XXXXYYYY pinId=-
```

> `mode: 'dev_mock'` 이 찍히면 시크릿 마운트 실패 + production guard 우회 (이론상 불가능 — guard 가 throw 함). 발견 시 즉시 4.9 롤백.

#### 4.7.4 Infobip Portal 에서 발송 기록 cross-check

- Infobip Portal > 2FA > Logs (또는 Reports > Sent SMS)
- 본인 번호로의 send-pin / verify-pin 기록이 같은 시각에 존재
- Status: `Delivered`

#### 4.7.5 실패 시 진단 표

| 증상 | 원인 후보 | 1차 조치 |
|---|---|---|
| 30s 내 SMS 미수신 | KISA 발신번호 미승인 / 메시지 템플릿 ID 불일치 | Infobip Portal Logs 확인 |
| send-pin 401 | INFOBIP_API_KEY 시크릿에 trailing newline | §4.2.2 `echo -n` 로 재생성 |
| send-pin 403 | API Key 권한 부족 | Portal > Developers > API Keys 에서 2FA 권한 추가 |
| verify 410 Gone | PIN TTL 3분 초과 | 재발송 후 즉시 입력 |
| verify 404 | pinId 매핑 분실 (Redis 재기동) | Valkey 인스턴스 상태 확인 |
| `mode: dev_mock` 로그 | 시크릿 미마운트 | 즉시 §4.9 롤백 + IAM 재확인 |

---

### 4.8 `10-HUMAN-UAT.md` 업데이트

#### 4.8.1 성공 시

`.planning/phases/10-sms/10-HUMAN-UAT.md` 헤더 frontmatter 수정:

```yaml
---
status: resolved        # partial → resolved
phase: 10-sms
source: [10-VERIFICATION.md]
started: 2026-04-16T05:00:00Z
updated: 2026-04-16T<배포_검증_완료_UTC>Z
---
```

`### 1. 실제 SMS OTP 수신 확인` 섹션:

```markdown
result: passed (2026-04-16, 본인 번호 +8210XXXXYYYY, 도달 ~6s, sms.sent + sms.verified 로그 확인, 비용 35원)
why_human: -
```

`## Summary` 블록:
```
total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0
```

#### 4.8.2 실패 시 (gap 기록)

`status: blocked` 또는 `partial` 유지, `## Gaps` 섹션에 추가:

```markdown
## Gaps

- gap-01: send-pin 401 — INFOBIP_API_KEY trailing newline 의심. 2026-04-16T... 발생.
  - 4.2.2 재생성 후 재시도 필요.
  - blocker: yes (Phase 10 진입 차단)
```

#### 4.8.3 최종 verify 실행

```bash
/gsd-verify-work 10
```

---

### 4.9 롤백 절차

> **절대 원칙**: 새 리비전 부팅 실패 / Sentry alert burst / SMS 미수신 다발 중 **하나라도** 5분 안에 재현되면 즉시 롤백.

#### 4.9.1 Cloud Run 트래픽 즉시 전환 (RTO < 60s)

```bash
# 직전 정상 리비전 이름 확보
PREV_REVISION=$(gcloud run revisions list \
  --service=grapit-api \
  --project=grapit-prod \
  --region=asia-northeast3 \
  --filter="metadata.name!=$(gcloud run services describe grapit-api --project=grapit-prod --region=asia-northeast3 --format='value(status.latestReadyRevisionName)')" \
  --limit=1 \
  --format="value(metadata.name)")

echo "Rolling back to: $PREV_REVISION"

gcloud run services update-traffic grapit-api \
  --project=grapit-prod \
  --region=asia-northeast3 \
  --to-revisions="$PREV_REVISION=100"
```

#### 4.9.2 Secret Manager 값 복원 (필요 시)

```bash
# 시크릿 버전 히스토리
gcloud secrets versions list infobip-api-key --project=grapit-prod

# 특정 이전 버전 활성화
gcloud secrets versions add infobip-api-key \
  --project=grapit-prod \
  --data-file=<(gcloud secrets versions access <PREV_VERSION_NUMBER> --secret=infobip-api-key --project=grapit-prod)
```

> Cloud Run 시크릿 마운트는 `:latest` 라도 **새 리비전 부팅 시점에만 resolve** 된다. 시크릿만 바꿔도 트래픽 받는 리비전에는 적용되지 않는다.

#### 4.9.3 GitHub Actions 후속 처리

```bash
gh pr create --title "revert: rollback INFOBIP deploy <sha>" \
  --body "Rolled back Cloud Run revision due to <증상>. Re-deploy after fix."
```

---

### 4.10 배포 후 모니터링 지표

> 배포 후 24시간은 아래 4개 지표를 시간당 1회 확인. 임계치 초과 시 즉시 §4.9 롤백.

#### 4.10.1 Sentry error rate

- 대시보드: Sentry > grapit-api > Performance
- 지표: `event.tag.module:sms` 만 필터한 error 발생률
- 임계: **5분 윈도우에서 5건 이상** → 즉시 조사. **20건 이상** → 롤백 검토

#### 4.10.2 Cloud Run latency (p95)

- Cloud Run Console > grapit-api > Metrics
- 임계: SMS endpoint p95 < **800ms**
- p95 > 1500ms 가 5분 지속 → Infobip 응답 지연 의심

#### 4.10.3 Infobip Portal — send-pin 성공률

- Portal > 2FA > Reports
- Filter: 최근 24시간, Application = `grapit-sms-2fa`
- 지표:
  - **Send Success Rate**: 목표 > 98%
  - **Delivered Rate**: 목표 > 95%
  - **Verify Success Rate**: 목표 > 70%

#### 4.10.4 비용 추적

- Infobip Portal > Finance > Daily usage
- **일일 알림 임계**: 5,000원 (~150건/일)
- **월간 예산**: 30,000원 (MVP 일평균 30건 가정)

#### 4.10.5 Valkey pin 매핑 키 누수 감시

```bash
# SCAN 사용 (KEYS * 금지)
redis-cli --scan --pattern "sms:pin:*" | wc -l
```

- 정상: < 100 (PIN_MAPPING_TTL_MS = 3분 → 자동 만료)
- > 1000 → TTL 미설정 / 트래픽 폭주 의심

#### 4.10.6 모니터링 종료 조건

- 24시간 동안 모든 지표가 임계 이내 → Phase 10 배포 종료 선언
- `10-HUMAN-UAT.md` status `resolved` 확정
- `.planning/STATE.md` 에 `phase: 10-sms / status: shipped / deployed_at: ...` 기록
- 다음 phase (`/gsd-progress`) 로 이동

---

## 부록 A. 용어 정리

| 용어 | 의미 |
|------|------|
| **KISA** | 한국인터넷진흥원. 발신번호 사전등록제 운영 주체 |
| **A2P SMS** | Application-to-Person SMS. 시스템이 사용자에게 보내는 문자 (OTP, 알림 등) |
| **Sender ID** | 발신번호 또는 발신자명 |
| **Alphanumeric Sender** | 영문+숫자 혼합 발신자명 (예: `Grapit`). 한국 미지원 |
| **Numeric Long Code** | 숫자만 사용하는 발신번호 (예: `01012345678`). 한국 필수 |
| **Infobip 2FA PIN API** | OTP 발송·검증 전용 API. 일반 SMS API와 분리됨 |
| **pinId** | Infobip이 발급하는 PIN 식별자. verify 시 필요 |
| **CPaaS** | Communications Platform as a Service. Infobip의 서비스 분류 |
| **Valkey** | Redis 7.2 fork OSS. 2024년 Redis 라이선스 변경 후 등장 |
| **Workload Identity Federation (WIF)** | GCP가 외부 OIDC 토큰을 GCP 서비스 계정에 매핑해주는 인증 방식. 키 없이 인증 가능 |

---

## 부록 B. 참고 자료

### Infobip 공식 문서
- [Using 2FA API](https://www.infobip.com/docs/2fa-service/using-2fa-api)
- [General 2FA (OTP) setup](https://www.infobip.com/docs/2fa-service/general-2fa-otp-setup)
- [Create 2FA application — API reference](https://www.infobip.com/docs/api/platform/2fa/2fa-configuration/create-2fa-application)
- [Create 2FA message template](https://www.infobip.com/docs/api/channels/sms/2fa/2fa-configuration/create-2fa-message-template)
- [Base URL](https://www.infobip.com/docs/essentials/api-essentials/base-url)
- [API authentication](https://www.infobip.com/docs/essentials/api-essentials/api-authentication)
- [Create API key](https://www.infobip.com/docs/api/platform/account-management/create-api-key)
- [Free trial](https://www.infobip.com/docs/essentials/getting-started/free-trial)
- [SMS coverage and connectivity](https://www.infobip.com/docs/essentials/getting-started/sms-coverage-and-connectivity)

### KISA / 한국 규제
- [KISA 발신번호 거짓표시(변작) 대응](https://www.kisa.or.kr/1030502)
- [KISA 발신번호 거짓표시 신고](https://anti-forgery.kisa.or.kr/)
- [발신번호 사전등록제 개요 - BIZGO](https://blog.bizgo.io/howto/caller-id-pre-registration/)
- [통신사 가입 증명서 발급 방법 - BIZGO](https://blog.bizgo.io/howto/how-to-get-telecom-subscription-certificate/)

### GCP / Cloud Run
- [Cloud Run secret mounting](https://cloud.google.com/run/docs/configuring/secrets)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation)
- [gcloud secrets reference](https://cloud.google.com/sdk/gcloud/reference/secrets)

### Grapit 프로젝트 내부 문서
- `.planning/phases/10-sms/DEPLOY-CHECKLIST.md` — 본 가이드의 원본 체크리스트
- `.planning/phases/10-sms/10-VERIFICATION.md` — Phase 10 verification 결과
- `.planning/phases/10-sms/10-HUMAN-UAT.md` — 남은 휴먼 검증 항목
- `CLAUDE.md` — 프로젝트 규약 (포트, .env 위치, 컨벤션)

---

**문서 작성일**: 2026-04-16
**Phase**: 10-sms (SMS 인증 실연동)
**작성자**: Grapit 팀 (자동 리서치 파이프라인 기반)
**다음 업데이트 트리거**: Infobip UI 변경 / KISA 규제 개정 / Cloud Run 배포 컨벤션 변경
