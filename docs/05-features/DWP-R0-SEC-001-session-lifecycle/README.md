# DWP-R0-SEC-001 Session Lifecycle

> 상태: in-development, automated and local integration verified
>
> Owner: Identity and Security
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`

> 검증일: 2026-08-08

Browser Session의 절대 만료, Idle Timeout, Token ID Rotation, 기기 목록과 사용자
폐기를 제공한다. 업무 메뉴가 아니라 모든 R1 Journey의 인증 Foundation이다.

## 산출물

- `01-기획 정의.md`
- `02-화면 설계서.md`
- `03-디자인 정의.md`
- `04-데이터 설계.md`
- `05-API 권한 계약.md`
- `06-AI Agent 계약.md`
- `07-수용 테스트.md`

## 구현 증거

- Flyway `V3__add_auth_session_lifecycle.sql` 실제 `dwp_auth` 적용
- Backend Validator·Rotation Unit Test 통과
- Frontend Unit·Typecheck·Lint·Production Build 통과
- Desktop·Mobile Playwright Flow·Axe·Visual Baseline 통과
- Cookie·CSRF 실제 통합에서 Rotation, Logout Others, Current Revoke와 401 확인

Production Proxy, Secure Cookie, Key Rotation과 수동 Security Review는 Release Gate로
남아 있다.
