# DWP-R1-CORE-004 API 권한 계약

Base path는 `/api/people/v1/workforce/exports`다.

| 동작         | Method·Path          | 통제                                               |
| ------------ | -------------------- | -------------------------------------------------- |
| Dataset 조회 | `GET /datasets`      | `DATA.WORKFORCE:MANAGE`와 `EXPORT` 경계            |
| 정책 Preview | `POST /preview`      | Dataset·Selection·Population·Field 재검증, 감사    |
| 요청 목록    | `GET /`              | 본인 요청, Governor만 Tenant 전체                  |
| 요청 생성    | `POST /`             | Idempotency, 목적·수신자·권위 참조, Snapshot·Hash  |
| 처리 증거    | `GET /{id}/attempts` | 동일 Tenant와 소유자/Governor                      |
| 취소         | `PATCH /{id}/cancel` | 소유자 또는 Governor, Version·사유 필수            |
| 수동 재시도  | `PATCH /{id}/retry`  | `ADMIN.WORKFORCE_ACCESS:MANAGE`, 예산·Version·사유 |

Gateway가 검증한 User, Tenant, Role, Permission과 Correlation Header만 신뢰한다. 명시적
Permission Header가 있는 세션에서는 역할 문자열을 Governor 우회로 사용하지 않는다.

Worker는 외부에 노출되지 않고 DB Claim을 사용한다. Artifact Writer는 비공개 staging에
기록하며 취소·TTL 위반·DB 완료 실패 시 idempotent `discard`를 수행해야 한다. DB 상태와
Audit Outbox는 같은 Transaction Boundary에서 기록한다.

보존 만료는 `discard` 성공 후 낙관적 Version 조건으로 확정한다. 저장소 Adapter가 없거나
삭제가 실패하면 `COMPLETED` 상태와 Artifact Reference를 보존하며, Scheduler가 다음
주기에 다시 시도한다. 비활성 Writer가 삭제 성공을 가장하는 구현은 허용하지 않는다.
