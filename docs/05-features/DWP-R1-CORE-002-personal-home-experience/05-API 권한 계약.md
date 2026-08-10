# DWP-R1-CORE-002 API·권한 계약

## 1. API

| Method | Path                                                            | 권한               | 목적                   |
| ------ | --------------------------------------------------------------- | ------------------ | ---------------------- |
| GET    | `/api/platform/v1/home-experience`                              | 로그인 사용자      | Tenant Home 설정 조회  |
| GET    | `/api/platform/v1/home-experience/background?v={version}`       | 로그인 사용자      | Tenant Background 전송 |
| GET    | `/api/platform/v1/admin/home-experience`                        | Tenant Admin       | 관리 상세 조회         |
| PUT    | `/api/platform/v1/admin/home-experience`                        | Tenant Admin, CSRF | 문구·위치·Overlay 수정 |
| POST   | `/api/platform/v1/admin/home-experience/background?version={n}` | Tenant Admin, CSRF | 이미지 교체            |
| POST   | `/api/platform/v1/admin/home-experience/background/reset`       | Tenant Admin, CSRF | Built-in 기본값 복원   |

## 2. 인증·Tenant

- Gateway는 Session Cookie를 Auth Service에서 검증하고 내부 User·Tenant·Role Header를
  재생성한다.
- 일반 JSON API의 Client Tenant Assertion은 Session Tenant와 일치해야 한다.
- CSS Background 요청은 사용자 정의 Header를 보낼 수 없으므로 Media GET만 Client
  Assertion을 생략할 수 있다. Session 검증과 내부 Tenant 주입은 그대로 필수다.
- Asset URL에는 Tenant ID와 Storage Key를 노출하지 않는다.

## 3. 업로드 검증

- Multipart 한도 10MB, Request 한도 11MB
- PNG·JPEG Signature와 Image Decode 일치
- 최대 4천만 Pixel
- 확장자는 검증된 Content에서 결정
- Version 불일치 시 `409`, 형식·크기 위반은 `400`, 권한 거부는 `403`

## 4. Cache

- Response URL에 Aggregate Version을 포함한다.
- Binary는 SHA-256 ETag와 Private 1시간 Cache를 사용한다.
- 업로드·Reset 성공 시 Home Query와 Admin Query를 무효화한다.
