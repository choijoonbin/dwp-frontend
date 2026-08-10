# 05 API 권한 계약

## Resource

| Resource                  | 권한     | 허용 기능                                        |
| ------------------------- | -------- | ------------------------------------------------ |
| `ADMIN.AUDIT_VIEW`        | `VIEW`   | Overview, Event와 개인 저장 보기                 |
| `ADMIN.AUDIT_INVESTIGATE` | `UPDATE` | Finding 배정·상태 변경, Case 생성·수정·증적 연결 |
| `ADMIN.AUDIT_EXPORT`      | `EXPORT` | 사유 기반 CSV·JSONL 증적 반출                    |
| `ADMIN.AUDIT_CONFIGURE`   | `MANAGE` | 공유 보기, 보존·Risk 정책과 무결성 Checkpoint    |

`AUDITOR`는 조회·조사·반출, `AUDIT_ADMIN`은 정책까지 수행한다. 기존 `ADMIN`과
`PLATFORM_ADMIN`은 전체 권한을 갖는다. 커스텀 Role도 같은 Resource Permission을 부여하면
동일하게 동작한다. Gateway는 요청 경로에 필요한 `ADMIN.AUDIT_*` 권한만 Auth에서 실시간
계산하여 Spoof 방지된 `X-DWP-Permissions` 내부 Header로 전달한다. Platform은 Gateway
Service Identity, Tenant·User와 세부 권한을 모두 검증하며 URL ID는 Tenant 조건으로 다시
확인한다. 무제한 전체 권한 목록을 Header에 싣지 않아 Header 크기와 최소 공개 원칙을 지킨다.

## Endpoint

| Method            | Path                                            | 계약                                   |
| ----------------- | ----------------------------------------------- | -------------------------------------- |
| `GET`             | `/v1/admin/audit-control/overview`              | 기간 Summary·Trend·Finding·Source      |
| `GET`             | `/v1/admin/audit-control/events`                | 서버 Filter·Pagination Event 탐색      |
| `GET`             | `/v1/admin/audit-control/events/{id}`           | Tenant 범위 Event 상세                 |
| `GET/POST/DELETE` | `/v1/admin/audit-control/saved-searches`        | 개인·공유 저장 보기와 소유권 삭제      |
| `GET/PATCH`       | `/v1/admin/audit-control/findings`              | Queue 조회·담당·상태·Case 연결         |
| `GET/POST/PATCH`  | `/v1/admin/audit-control/cases`                 | Case Lifecycle·Event 연결              |
| `GET`             | `/v1/admin/audit-control/findings/{id}/context` | Finding·연관 Event·기존 Case 조사 맥락 |
| `GET`             | `/v1/admin/audit-control/cases/{id}/workspace`  | Case·증적·Entity·Task·저널 통합 조회   |
| `POST`            | `/v1/admin/audit-control/cases/{id}/notes`      | 변경 불가 조사 메모 추가               |
| `POST/PATCH`      | `/v1/admin/audit-control/cases/{id}/tasks`      | 조사 작업 생성·상태·담당·기한 관리     |
| `POST`            | `/v1/admin/audit-control/cases/{id}/events`     | 증적 Event 보존과 저널 연결            |
| `GET/PUT`         | `/v1/admin/audit-control/policy`                | 보존·반출·무결성 정책                  |
| `GET/POST`        | `/v1/admin/audit-control/integrity`             | Checkpoint 조회·생성                   |
| `POST/GET`        | `/v1/admin/audit-control/exports`               | 증적 생성·Content 다운로드             |

## 내부 수집

`POST /internal/audit/events`는 1~200 Event와 Trusted Source Header를 요구한다. 선언
Source와 Event Source가 다르거나 허용 목록 밖이면 거부한다. Local은 회전 가능한 공유
Token을 사용하고 Production은 Workload Identity 또는 mTLS로 교체한다.

## 조사 API 불변식

- 모든 상세·변경 API는 URL의 Finding·Case가 요청 Tenant 소유인지 재검증한다.
- Finding Context는 동일 Actor·Target·Correlation·Source의 시간 인접 Event를 묶되 원본
  Event를 변경하지 않는다.
- Workspace 조회는 Case 본문, 증적, Entity, Task, Activity를 하나의 읽기 모델로 반환한다.
- Note와 Activity는 생성만 허용하고 수정·삭제 Endpoint를 제공하지 않는다.
- Task 변경과 Case 상태 변경은 같은 Transaction 안에서 Activity를 추가한다.
