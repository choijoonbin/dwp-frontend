# DWP-R1-CORE-003 API·권한 계약

| Method | Path                                                           | 목적                           |
| ------ | -------------------------------------------------------------- | ------------------------------ |
| GET    | `/api/platform/v1/personal-preferences`                        | 유효 설정과 관리 정책 조회     |
| PATCH  | `/api/platform/v1/personal-preferences`                        | 개인 설정 Patch와 Version 저장 |
| POST   | `/api/platform/v1/personal-preferences/reset`                  | 개인 Override 초기화           |
| GET    | `/api/platform/v1/personal-preferences/managed-policy`         | Tenant 관리 정책·Rule 조회     |
| GET    | `/api/platform/v1/personal-preferences/exceptions`             | 로그인 사용자의 요청 이력      |
| POST   | `/api/platform/v1/personal-preferences/exceptions`             | 예외 검토 요청                 |
| POST   | `/api/platform/v1/personal-preferences/exceptions/{id}/cancel` | 본인의 Pending 요청 취소       |
| GET    | `/api/platform/v1/admin/preference-exceptions?state=`          | Tenant 관리자 검토 Queue       |
| POST   | `/api/platform/v1/admin/preference-exceptions/{id}/decision`   | 승인·반려와 증적 기록          |

Profile과 Login Policy는 Auth `me`·policy API를 읽고 Security 화면은 로그인 사용자의 Session만
조회·종료한다. Locale 변경은 Preference와 Auth Preferred Locale을 일관되게 갱신한다.

요청 User ID를 받지 않고 Gateway Session User만 사용한다. Payload Size, Schema Version, Enum,
Time Zone과 Home Widget ID를 검증하며 Version 충돌은 `409`로 구분한다. 자동 저장은 실패를
성공으로 표시하지 않는다.

위 Platform Personal Preference·Managed Policy API는 Tenant Principal 전용이다. Provider
Frontend는 호출 자체를 만들지 않고 Provider가 직접 호출하면 `403` 또는 정책상 `404`로
거부한다. Provider 언어 변경은 Auth `preferredLocale` 계약만 사용하고 Appearance·Accessibility·
Regional 표시는 격리된 Browser-local Key를 사용한다. Provider Server Sync API는 후속 Backend Gate 전에는
존재하거나 성공하는 것처럼 표현하지 않는다.

사용자 API는 Session User만 사용하고 다른 사용자의 요청 ID는 찾을 수 없게 처리한다. 관리자
API는 Admin Route Guard와 서버 Tenant Context를 모두 통과해야 하며 교차 Tenant 요청을
허용하지 않는다. 결정에는 현재 Version, 10자 이상의 근거와 선택적 증적 참조가 필요하다.
요청·취소·결정은 `PREFERENCE_EXCEPTION_REQUEST` Target으로 전후 Snapshot을 감사한다.
