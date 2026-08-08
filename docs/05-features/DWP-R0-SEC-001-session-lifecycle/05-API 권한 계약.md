# DWP-R0-SEC-001 API·권한 계약

## API

| Method | Path                               | 목적                       | CSRF | Idempotency                 |
| ------ | ---------------------------------- | -------------------------- | ---- | --------------------------- |
| GET    | `/api/auth/sessions`               | 본인의 활성 Session 조회   | No   | Safe                        |
| POST   | `/api/auth/session/refresh`        | 현재 Token ID Rotation     | Yes  | 최소 Rotation 간격 내 No-op |
| DELETE | `/api/auth/sessions/{id}`          | 본인의 Session Family 폐기 | Yes  | 이미 폐기된 경우 Not Found  |
| POST   | `/api/auth/sessions/logout-others` | 현재 외 Session 폐기       | Yes  | 반복 호출 안전              |

## 권한

- 인증된 사용자는 자신의 `tenant_id`, `user_id` Session만 조회·폐기한다.
- Path의 Family ID만으로 다른 사용자 Session 존재 여부를 노출하지 않는다.
- 현재 Session 폐기 시 Cookie를 지우고 이후 요청은 401이어야 한다.
- 관리자 전사 폐기 API는 R0 범위가 아니다.

## Rotation

- 현재 JWT `jti`, user, tenant와 Registry Row를 Pessimistic Lock으로 검증한다.
- 최소 Rotation Age 이전 호출은 `rotated=false`로 성공한다.
- 새 JWT는 새 `jti`, 동일 `sid`, 최신 Role과 기존 절대 만료를 사용한다.
- 이전 Token은 Grace 이후 거부한다.
- Idle 만료와 절대 만료를 Rotation으로 연장하지 않는다.

## Error

| 상황                  | 응답 | Client 동작                     |
| --------------------- | ---- | ------------------------------- |
| 만료·폐기·Idle        | 401  | Auth Cache 제거, Sign-in 이동   |
| 다른 사용자 Family ID | 404  | 존재 여부를 노출하지 않음       |
| CSRF 없음·불일치      | 403  | CSRF Token 재요청 후 1회 재시도 |
| 잘못된 UUID           | 400  | 입력 오류                       |

## Audit·Trace

- Correlation ID와 Session Family ID를 사용하되 Token ID 원문은 Log에서 Mask한다.
- 사용자 폐기는 actor, target family, reason과 결과를 Audit한다.
