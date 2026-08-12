# DWP-R1-CORE-002 API·권한 계약

## 1. API

| Method | Path                                                             | 권한                | 목적                          |
| ------ | ---------------------------------------------------------------- | ------------------- | ----------------------------- |
| GET    | `/api/platform/v1/home-experience`                               | 로그인 사용자       | Tenant Home 설정 조회         |
| GET    | `/api/platform/v1/home-experience/background?v={version}`        | 로그인 사용자       | Tenant Background 전송        |
| GET    | `/api/platform/v1/admin/home-experience`                         | Tenant Admin        | 관리 상세 조회                |
| PUT    | `/api/platform/v1/admin/home-experience`                         | Tenant Admin, CSRF  | Locale 문구·위치·Overlay 게시 |
| POST   | `/api/platform/v1/admin/home-experience/background?version={n}`  | Tenant Admin, CSRF  | 이미지 교체                   |
| POST   | `/api/platform/v1/admin/home-experience/background/reset`        | Tenant Admin, CSRF  | Built-in 기본값 복원          |
| GET    | `/api/platform/v1/admin/home-experience/revisions`               | Tenant Admin        | 불변 게시 이력                |
| POST   | `/api/platform/v1/admin/home-experience/revisions/{id}/rollback` | Tenant Admin, CSRF  | Snapshot 복원                 |
| GET    | `/api/platform/v1/tenant-branding`                               | 로그인 사용자       | 회사명·Logo Metadata          |
| GET    | `/api/platform/v1/tenant-branding/logo?v={version}`              | 로그인 사용자       | Tenant Logo 전송              |
| GET    | `/api/platform/v1/admin/tenant-branding`                         | Tenant Admin        | Branding 관리 조회            |
| PUT    | `/api/platform/v1/admin/tenant-branding`                         | Tenant Admin, CSRF  | 회사명·Accent 게시            |
| POST   | `/api/platform/v1/admin/tenant-branding/logo?version={n}`        | Tenant Admin, CSRF  | Logo 업로드                   |
| POST   | `/api/platform/v1/admin/tenant-branding/logo/reset`              | Tenant Admin, CSRF  | Logo 제거                     |
| GET    | `/api/platform/v1/admin/tenant-branding/revisions`               | Tenant Admin        | 불변 게시 이력                |
| POST   | `/api/platform/v1/admin/tenant-branding/revisions/{id}/rollback` | Tenant Admin, CSRF  | Snapshot 복원                 |
| GET    | `/api/platform/v1/home-preferences`                              | 로그인 사용자       | 개인 Home Layout 조회         |
| PUT    | `/api/platform/v1/home-preferences`                              | 로그인 사용자, CSRF | 개인 Layout 저장              |
| POST   | `/api/platform/v1/home-preferences/reset`                        | 로그인 사용자, CSRF | 개인 Layout 초기화            |
| GET    | `/api/platform/v1/announcements`                                 | 로그인 사용자       | 현재 대상 공지 조회           |
| POST   | `/api/platform/v1/announcements/{id}/engagements/view`           | 로그인 사용자, CSRF | View 증적 Upsert              |
| POST   | `/api/platform/v1/announcements/{id}/engagements/action`         | 로그인 사용자, CSRF | Action 증적 Upsert            |
| GET    | `/api/platform/v1/admin/announcements`                           | Tenant Admin        | 전체 공지 관리 조회           |
| POST   | `/api/platform/v1/admin/announcements`                           | Tenant Admin, CSRF  | Draft 생성                    |
| PUT    | `/api/platform/v1/admin/announcements/{id}`                      | Tenant Admin, CSRF  | 공지 수정                     |
| POST   | `/api/platform/v1/admin/announcements/{id}/publish`              | Tenant Admin, CSRF  | 공지 게시                     |
| POST   | `/api/platform/v1/admin/announcements/{id}/archive`              | Tenant Admin, CSRF  | 공지 보관                     |

`GET /home-preferences`는 저장된 개인 설정이 없어도 관리형 기본 Layout을 반환한다. 응답의
`customized=false`는 기본값, `customized=true`는 저장된 사용자 설정을 뜻한다. 최초 저장의
`version`도 `0`일 수 있으므로 Reset 가능 여부는 `customized`로 판단한다.

## 2. 인증·Tenant

- Gateway는 Session Cookie를 Auth Service에서 검증하고 내부 User·Tenant·Role Header를
  재생성한다.
- 일반 JSON API의 Client Tenant Assertion은 Session Tenant와 일치해야 한다.
- CSS Background 요청은 사용자 정의 Header를 보낼 수 없으므로 Media GET만 Client
  Assertion을 생략할 수 있다. Session 검증과 내부 Tenant 주입은 그대로 필수다.
- Asset URL에는 Tenant ID와 Storage Key를 노출하지 않는다.

## 3. 업로드 검증

- Multipart 한도 10MB, Request 한도 11MB
- 배경 PNG·JPEG Signature와 Image Decode 일치
- Logo PNG·JPEG 또는 안전한 SVG. SVG Script, Event Handler, 외부·Data Resource를 거부
- 최대 4천만 Pixel
- 확장자는 검증된 Content에서 결정
- Version 불일치 시 `409`, 형식·크기 위반은 `400`, 권한 거부는 `403`

## 4. Cache

- Response URL에 Aggregate Version을 포함한다.
- Binary는 SHA-256 ETag와 Private 1시간 Cache를 사용한다.
- 업로드·Reset 성공 시 Home Query와 Admin Query를 무효화한다.
- 공지는 서버가 Tenant, 역할, Published 상태와 게시기간을 다시 필터링한다.
- 공지 Action은 내부 절대경로 또는 HTTPS만 허용한다.
- Revision Rollback도 현재 Version을 요구하며 과거 Revision을 수정하지 않고 새 Rollback
  Revision과 Audit Event를 생성한다. 보존 Asset이 없는 Revision은 복원을 거부한다.
- Engagement는 대상·게시기간 검사를 다시 수행하고 로그인 사용자의 행만 Upsert한다.
