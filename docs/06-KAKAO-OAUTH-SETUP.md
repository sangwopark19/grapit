# 카카오 소셜 로그인 OAuth 설정 가이드

> 카카오 로그인 REST API 연동을 위한 Client ID 발급부터 심사/검수까지의 전체 프로세스.
> 공식 문서: https://developers.kakao.com/docs/latest/ko/kakaologin/common

---

## 목차

1. [카카오 개발자 계정 생성](#1-카카오-개발자-계정-생성)
2. [애플리케이션 생성 및 REST API 키 확인](#2-애플리케이션-생성-및-rest-api-키-확인)
3. [카카오 로그인 활성화](#3-카카오-로그인-활성화)
4. [Redirect URI 설정](#4-redirect-uri-설정)
5. [동의항목 설정](#5-동의항목-설정)
6. [비즈앱 전환](#6-비즈앱-전환)
7. [Client Secret 발급](#7-client-secret-발급)
8. [심사/검수 프로세스](#8-심사검수-프로세스)
9. [주요 API 엔드포인트](#9-주요-api-엔드포인트)
10. [Grapit 프로젝트 적용 가이드](#10-grapit-프로젝트-적용-가이드)

---

## 1. 카카오 개발자 계정 생성

### 1-1. 카카오 디벨로퍼스 접속

1. https://developers.kakao.com 접속
2. 우측 상단 **[로그인]** 클릭
3. 카카오 계정으로 로그인 (일반 카카오톡 계정 사용 가능)

### 1-2. 개발자 등록

1. 최초 로그인 시 **개발자 약관 동의** 화면 표시
2. 이용약관 및 개인정보 처리방침 동의 후 **[동의하고 계속하기]** 클릭
3. 이메일 인증 완료 후 개발자 등록 완료

> **참고:** 별도의 개발자 계정이 필요하지 않다. 기존 카카오 계정으로 바로 사용 가능.

---

## 2. 애플리케이션 생성 및 REST API 키 확인

### 2-1. 앱 생성

1. [카카오 디벨로퍼스 콘솔](https://developers.kakao.com/console/app) 접속
2. **[애플리케이션 추가하기]** 클릭
3. 앱 정보 입력:
   - **앱 이름:** `Grapit` (서비스명)
   - **사업자명:** 사업자명 또는 개인 이름
4. **[저장]** 클릭

### 2-2. REST API 키 확인

앱 생성 후 **[앱 설정]** > **[앱 키]** 에서 4종류의 키를 확인할 수 있다:

| 키 종류 | 용도 | Grapit 사용 여부 |
|---------|------|-----------------|
| **네이티브 앱 키** | Android/iOS SDK | 미사용 |
| **JavaScript 키** | JavaScript SDK (프론트엔드) | 미사용 |
| **REST API 키** | REST API 호출 (서버 사이드) | **사용** |
| **Admin 키** | 관리자용 API | 필요 시 사용 |

> **중요:** REST API 키가 OAuth의 `client_id`에 해당한다. NestJS 백엔드에서 사용.

### 2-3. 플랫폼 등록

**[앱 설정]** > **[플랫폼]** 에서 Web 플랫폼 등록:

1. **[Web 플랫폼 등록]** 클릭
2. **사이트 도메인** 입력:
   - 개발: `http://localhost:3000`
   - 스테이징: `https://staging.grapit.co.kr`
   - 프로덕션: `https://grapit.co.kr`
3. **[저장]** 클릭

---

## 3. 카카오 로그인 활성화

### 3-1. 활성화 설정

**경로:** [앱 설정] > **[카카오 로그인]** > **[활성화 설정]**

1. **상태** 토글을 **ON** 으로 변경
2. 설정 완료 확인

> **주의:** OFF 상태에서 로그인 시도 시 `KOE004` 에러 발생.

### 3-2. OpenID Connect 활성화 (선택)

같은 페이지에서 **[OpenID Connect]** 항목:

1. **상태** 토글을 **ON** 으로 변경
2. 활성화 시 토큰 발급 응답에 `id_token` 포함

> **Grapit 적용:** OpenID Connect는 선택사항. 프로젝트에서는 액세스 토큰으로 사용자 정보를 조회하는 방식을 사용하므로 필수는 아님.

---

## 4. Redirect URI 설정

### 4-1. 설정 방법

**경로:** [앱 설정] > **[카카오 로그인]** > **[Redirect URI]**

1. **[Redirect URI 등록]** 클릭
2. URI 입력 후 **[저장]**

### 4-2. Grapit Redirect URI

```
# 개발 환경
http://localhost:4000/auth/kakao/callback

# 프로덕션 환경
https://api.grapit.co.kr/auth/kakao/callback
```

### 4-3. 설정 규칙

- HTTP, HTTPS 프로토콜 모두 지원
- 포트 80, 443은 생략 가능
- **정확한 URI 일치** 필요 (패턴 매칭 불가)
- 여러 URI 등록 가능
- 불일치 시 `KOE006` 에러 발생

> **주의:** 인가 코드 요청 시 `redirect_uri` 파라미터와 여기 등록된 URI가 **정확히 일치**해야 한다.

---

## 5. 동의항목 설정

### 5-1. 설정 경로

**경로:** [앱 설정] > **[카카오 로그인]** > **[동의항목]**

### 5-2. 동의항목 종류 및 비즈앱 필요 여부

#### 개인정보 동의항목

| 동의항목 | Scope ID | 비즈앱 필요 | Grapit 사용 | 비고 |
|---------|----------|------------|------------|------|
| **닉네임** | `profile_nickname` | 불필요 | **필수 동의** | 기본 제공 |
| **프로필 사진** | `profile_image` | 불필요 | **선택 동의** | 기본 제공 |
| **카카오계정(이메일)** | `account_email` | **필요** | **필수 동의** | 비즈앱 전환 + 검수 필요 |
| 성별 | `gender` | **필요** | 미사용 | |
| 연령대 | `age_range` | **필요** | 미사용 | |
| 생일 | `birthday` | **필요** | 미사용 | |
| 출생 연도 | `birthyear` | **필요** | 미사용 | |
| 전화번호 | `phone_number` | **필요** | 미사용 | 자체 SMS 인증 사용 |
| 배송지 정보 | `shipping_address` | **필요** | 미사용 | |

#### 접근권한 동의항목

| 동의항목 | 비즈앱 필요 | Grapit 사용 |
|---------|------------|------------|
| 카카오톡 메시지 전송 | 불필요 | 미사용 |
| 카카오톡 친구 목록 | **필요** | 미사용 |

### 5-3. 동의 단계 구분

| 단계 | 설명 | 동의 화면 |
|------|------|---------|
| **필수 동의** | 서비스 이용에 반드시 필요. 미동의 시 로그인 불가 | 체크박스 선택 상태 (해제 불가) |
| **선택 동의** | 사용자가 선택적으로 동의 가능 | 체크박스 해제 상태 (선택 가능) |
| **이용 중 동의** | 서비스 이용 중 특정 기능에서 동의 요청 | 별도 동의 화면 |

### 5-4. 설정 방법

1. 동의항목 목록에서 원하는 항목의 **[설정]** 클릭
2. **동의 단계** 선택: 필수 동의 / 선택 동의 / 이용 중 동의
3. **동의 목적** 작성 (예: "회원 식별 및 서비스 제공")
4. **[저장]** 클릭
5. **[동의 화면 미리보기]** 로 사용자에게 보이는 화면 확인

### 5-5. Grapit 권장 설정

```
닉네임          → 필수 동의 (회원 식별)
프로필 사진      → 선택 동의 (프로필 표시)
카카오계정(이메일) → 필수 동의 (계정 연동 및 알림 발송) ← 비즈앱 필요
```

---

## 6. 비즈앱 전환

이메일 등 개인정보 동의항목을 사용하려면 **비즈앱 전환**이 필수.

### 6-1. 전환 유형

| 유형 | 조건 | 전환 방법 |
|------|------|---------|
| **개인 개발자** | 본인인증 | 본인인증 완료 시 즉시 전환 |
| **사업자** | 사업자등록번호 | 사업자 정보 입력 후 전환 |

> **1인 개발 상황:** 사업자등록 전이라도 개인 개발자로 본인인증만 하면 비즈앱 전환이 가능하다. 이메일 동의항목을 사용할 수 있다.

### 6-2. 전환 절차

1. **[앱 설정]** > **[비즈니스]** 이동
2. **[비즈 앱 전환]** 클릭
3. 개인 개발자 선택 시:
   - **본인인증** 진행 (휴대폰 인증)
   - 인증 완료 후 즉시 전환
4. 사업자 선택 시:
   - 사업자등록번호, 사업자명 입력
   - 사업자등록증 첨부
   - 심사 후 전환 (영업일 1~2일)

### 6-3. 전환 후 가능한 기능

- 이메일, 성별, 연령대 등 개인정보 동의항목 신청 가능
- 카카오싱크(간편가입) 사용 가능
- 카카오톡 채널 연결 가능

---

## 7. Client Secret 발급

### 7-1. 발급 및 활성화

**경로:** [앱 설정] > **[카카오 로그인]** > **[보안]**

1. **[코드 생성]** 클릭 → Client Secret 코드 발급
2. **활성화 상태** 설정:
   - **사용 안함:** Client Secret 미사용 (비권장)
   - **사용함:** 토큰 발급/갱신 시 `client_secret` 파라미터 필수

> **참고:** REST API 키로 앱을 생성하면 Client Secret 기능이 **기본 활성화** 상태로 생성된다. 활성화 상태에서 `client_secret`을 누락하면 `KOE010` 에러 발생.

### 7-2. 보안 권장사항

- Client Secret은 **서버 사이드에서만** 사용 (클라이언트 코드 노출 금지)
- **2년 이하 주기로 갱신** 권장
- 환경변수로 관리 (`.env`에 저장, 코드에 하드코딩 금지)

### 7-3. Grapit 환경변수 설정

```bash
# .env (모노레포 루트)
KAKAO_CLIENT_ID=<REST API 키>
KAKAO_CLIENT_SECRET=<Client Secret 코드>
KAKAO_CALLBACK_URL=http://localhost:4000/auth/kakao/callback
```

---

## 8. 심사/검수 프로세스

### 8-1. 검수가 필요한 경우

| 항목 | 검수 필요 여부 |
|------|-------------|
| 닉네임, 프로필 사진으로 로그인만 | **불필요** |
| 이메일 등 개인정보 동의항목 사용 | **필요** (비즈앱 전환 + 검수) |
| 카카오싱크(간편가입) 사용 | **필요** |
| 카카오톡 채널 연결 | **필요** |

### 8-2. 개인정보 동의항목 검수 신청 절차

**경로:** [앱 설정] > **[비즈니스]** > **[개인정보 보호]**

#### 사전 준비

1. 비즈앱 전환 완료
2. 개인정보 처리방침 페이지 준비 (URL 필요)
3. 서비스 회원가입 화면 스크린샷 준비

#### 신청 정보 입력

| 항목 | 설명 |
|------|------|
| **개인정보 동의항목** | 필요한 항목 선택 및 동의 단계(필수/선택) 지정 |
| **카카오 로그인 이용 동의** | 동의 안내 확인 체크 |
| **회원가입 링크** | 동의항목 확인 가능한 URL |
| **개인정보 처리방침** | 수집 목적, 수집 항목, 보유 기간 명시된 URL |
| **회원가입 화면** | 확인 자료 첨부 (20MB 이내 이미지 또는 PDF) |
| **수집 사유** | 각 동의항목별 사용 용도 설명 |

### 8-3. 심사 기준

- 신청 정보와 제출 자료의 일치 여부
- 회원가입 방식과 신청 내역의 정합성
- 개인정보 처리방침과의 일관성

### 8-4. 심사 일정

- **심사 기간:** 영업일 기준 **3~5일**
- **반려 시:** [앱 설정] > [비즈니스]에서 반려 사유 확인 후 보완하여 재신청 가능
- **재심사:** 보완 후 동일 절차로 신청 (영업일 3~5일)

### 8-5. Grapit 검수 전략

```
Phase 1 (개발/테스트):
  - 닉네임 + 프로필 사진만 사용 → 검수 없이 즉시 개발 가능
  - 이메일은 자체 입력 (registrationToken 플로우)

Phase 2 (서비스 런칭 전):
  - 비즈앱 전환 (개인 개발자 본인인증)
  - 이메일 동의항목 검수 신청
  - 개인정보 처리방침 페이지 준비
  - 검수 통과 후 이메일 동의항목 활성화
```

---

## 9. 주요 API 엔드포인트

### 9-1. 인증 서버 (kauth.kakao.com)

#### 인가 코드 받기

```
GET https://kauth.kakao.com/oauth/authorize
```

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `client_id` | O | REST API 키 |
| `redirect_uri` | O | 등록된 Redirect URI |
| `response_type` | O | `code` (고정) |
| `scope` | X | 추가 동의항목 요청 시 사용 |
| `prompt` | X | `login`: 재인증, `none`: 자동 로그인, `select_account`: 계정 선택 |
| `state` | X | CSRF 방지용 상태값 |
| `nonce` | X | ID 토큰 재생 공격 방지 (OIDC 사용 시) |

**응답:** HTTP 302 리다이렉트

```
# 성공
{redirect_uri}?code={인가코드}&state={상태값}

# 실패
{redirect_uri}?error={에러코드}&error_description={메시지}
```

#### 토큰 받기

```
POST https://kauth.kakao.com/oauth/token
Content-Type: application/x-www-form-urlencoded;charset=utf-8
```

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `grant_type` | O | `authorization_code` |
| `client_id` | O | REST API 키 |
| `redirect_uri` | O | 인가 코드 요청 시 사용한 URI |
| `code` | O | 인가 코드 |
| `client_secret` | 조건부 | Client Secret 활성화 시 필수 |

**응답:**

```json
{
  "token_type": "bearer",
  "access_token": "액세스 토큰",
  "expires_in": 21599,
  "refresh_token": "리프레시 토큰",
  "refresh_token_expires_in": 5183999,
  "scope": "account_email profile_image profile_nickname",
  "id_token": "ID 토큰 (OIDC 활성화 시)"
}
```

#### 토큰 갱신하기

```
POST https://kauth.kakao.com/oauth/token
Content-Type: application/x-www-form-urlencoded;charset=utf-8
```

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `grant_type` | O | `refresh_token` |
| `client_id` | O | REST API 키 |
| `refresh_token` | O | 리프레시 토큰 |
| `client_secret` | 조건부 | Client Secret 활성화 시 필수 |

#### 카카오계정과 함께 로그아웃

```
GET https://kauth.kakao.com/oauth/logout
```

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `client_id` | O | REST API 키 |
| `logout_redirect_uri` | O | 로그아웃 후 리다이렉트 URI |
| `state` | X | CSRF 방지용 상태값 |

### 9-2. API 서버 (kapi.kakao.com)

#### 사용자 정보 가져오기

```
GET/POST https://kapi.kakao.com/v2/user/me
Authorization: Bearer {access_token}
```

| 파라미터 | 필수 | 설명 |
|---------|------|------|
| `property_keys` | X | 조회할 프로퍼티 키 목록 (JSON 배열) |
| `secure_resource` | X | 프로필 이미지 HTTPS 여부 |

**응답:**

```json
{
  "id": 123456789,
  "connected_at": "2024-01-01T00:00:00Z",
  "kakao_account": {
    "profile_nickname_needs_agreement": false,
    "profile_image_needs_agreement": false,
    "profile": {
      "nickname": "홍길동",
      "thumbnail_image_url": "https://...",
      "profile_image_url": "https://...",
      "is_default_image": false
    },
    "has_email": true,
    "email_needs_agreement": false,
    "is_email_valid": true,
    "is_email_verified": true,
    "email": "user@example.com"
  }
}
```

#### 액세스 토큰 정보 보기

```
GET https://kapi.kakao.com/v1/user/access_token_info
Authorization: Bearer {access_token}
```

**응답:**

```json
{
  "id": 123456789,
  "expires_in": 21599,
  "app_id": 12345
}
```

#### 로그아웃 (토큰 만료)

```
POST https://kapi.kakao.com/v1/user/logout
Authorization: Bearer {access_token}
```

**응답:**

```json
{
  "id": 123456789
}
```

#### 연결 끊기 (회원 탈퇴)

```
POST https://kapi.kakao.com/v1/user/unlink
Authorization: Bearer {access_token}
```

**응답:**

```json
{
  "id": 123456789
}
```

#### 동의 내역 확인

```
GET https://kapi.kakao.com/v2/user/scopes
Authorization: Bearer {access_token}
```

### 9-3. 토큰 유효기간

| 토큰 | 유효기간 | 비고 |
|------|---------|------|
| 액세스 토큰 | **6시간** (REST API) | 플랫폼별 상이 (2~12시간) |
| 리프레시 토큰 | **2개월** | 만료 1개월 전부터 갱신 시 새 리프레시 토큰 발급 |
| ID 토큰 | 액세스 토큰과 동일 | OpenID Connect 활성화 시 |

### 9-4. OpenID Connect 엔드포인트 (참고)

| 용도 | URL |
|------|-----|
| 메타데이터 | `https://kauth.kakao.com/.well-known/openid-configuration` |
| 공개키 목록 (JWKS) | `https://kauth.kakao.com/.well-known/jwks.json` |
| ID 토큰 정보 조회 | `POST https://kauth.kakao.com/oauth/tokeninfo` |
| OIDC 사용자 정보 | `GET https://kapi.kakao.com/v1/oidc/userinfo` |

### 9-5. 주요 에러 코드

| 에러 코드 | 설명 |
|----------|------|
| `KOE004` | 카카오 로그인 사용 설정이 OFF |
| `KOE006` | Redirect URI 불일치 |
| `KOE010` | Client Secret 누락 또는 잘못된 값 |
| `KOE237` | 분당 요청 수 제한 초과 |
| `-401` | 유효하지 않은 토큰 (만료 또는 잘못된 토큰) |

---

## 10. Grapit 프로젝트 적용 가이드

### 10-1. 환경변수

```bash
# .env (모노레포 루트: /grapit/.env)
KAKAO_CLIENT_ID=<REST API 키>
KAKAO_CLIENT_SECRET=<Client Secret 코드>
KAKAO_CALLBACK_URL=http://localhost:4000/auth/kakao/callback
```

### 10-2. NestJS Passport 전략 흐름

```
1. 프론트엔드에서 카카오 로그인 버튼 클릭
2. GET /auth/kakao → 302 → https://kauth.kakao.com/oauth/authorize
3. 사용자 동의 후 → 302 → /auth/kakao/callback?code=xxx
4. NestJS에서 인가코드로 토큰 교환
   POST https://kauth.kakao.com/oauth/token
5. 액세스 토큰으로 사용자 정보 조회
   GET https://kapi.kakao.com/v2/user/me
6. DB에서 사용자 조회/생성 → JWT 발급 → 프론트엔드 리다이렉트
```

### 10-3. 설정 체크리스트

- [ ] 카카오 디벨로퍼스 계정 생성
- [ ] 애플리케이션 생성 (앱 이름: Grapit)
- [ ] Web 플랫폼 등록 (localhost:3000 + 프로덕션 도메인)
- [ ] 카카오 로그인 활성화 (ON)
- [ ] Redirect URI 등록 (localhost:4000/auth/kakao/callback)
- [ ] 동의항목 설정 (닉네임 필수, 프로필 사진 선택)
- [ ] Client Secret 발급 및 활성화
- [ ] `.env`에 환경변수 추가
- [ ] (서비스 런칭 전) 비즈앱 전환 + 이메일 동의항목 검수

---

## 참고 문서

- [카카오 로그인 > 이해하기](https://developers.kakao.com/docs/latest/ko/kakaologin/common)
- [카카오 로그인 > 설정하기](https://developers.kakao.com/docs/latest/ko/kakaologin/prerequisite)
- [카카오 로그인 > REST API](https://developers.kakao.com/docs/latest/ko/kakaologin/rest-api)
- [카카오 로그인 > 활용하기](https://developers.kakao.com/docs/latest/ko/kakaologin/utilize)
- [카카오 데브톡 (문의)](https://devtalk.kakao.com)
