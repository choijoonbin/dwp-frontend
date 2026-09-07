# 회의 출처 Work 배정 계약

상태: 2026-09-04 공개 controller·service·원천 송신부의 코드 대조와 합의된 소유권 기준입니다. Work 배정 backend 42개(실제 PostgreSQL 15개 포함, 실패/skip 0)와 shared API 단위 11개 통과를 담당 작업이 확인했습니다. 공통 담당의 서비스 인터페이스 등록 후 Work 작업의 service-boundary 재실행도 통과했습니다. Meeting 수신 authority/nonce·대상자 적격성·실제 연결은 별도로 남아 있습니다.

## 1. 정본과 식별

| 객체             | 소유자  | 식별·의미                                                                                                           |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| 회의 후속 후보   | Meeting | `MEETING_FOLLOWUP` + meetingId/reportId/candidateId의 안정적인 UUID. AI 배열 위치나 텍스트 hash만으로 식별하지 않음 |
| 검토된 후보 버전 | Meeting | 생성자가 확인한 expectedSourceVersion. Work가 owner에게 동일 identity·현재 확정 상태·버전을 재검증                  |
| 배정 업무        | Work    | assignmentId. 통합업무함의 정본 identity는 `WORK_ASSIGNMENT` + assignmentId                                         |
| 현재 배정 차수   | Work    | assignmentRevision. 재배정마다 증가하며 이전 담당자의 명령을 차단                                                   |
| 업무 변경 버전   | Work    | version. 현재 배정 차수와 별도로 낙관적 동시성 검증                                                                 |
| 명령 결과        | Work    | commandId, appliedVersion, appliedAssignmentRevision, appliedAt, replayed. 과거 적용 증거와 현재 업무 view를 구분   |

확정 업무 제목·설명·우선순위·기한·담당자는 Work의 독립 조건입니다. Meeting 원문·회의 제목·전사·인용 본문·영구 원자료 URL을 별도 캐시로 복제하지 않습니다. source identity가 Meeting이라는 이유로 Work의 수행 상태를 Meeting DB에서 변경하지 않습니다.

## 2. 생성과 owner authority

공개 prefix: `/api/platform/v1/workspace/work-hub/assignments`.

아래 **13 operations = GET 5개 + POST 8개**를 공개 OpenAPI/Gateway/generated SDK 인계의 단위로 사용합니다. `V`는 `APP.WORK:VIEW`, `U`는 `APP.WORK:UPDATE`입니다. 객체 역할·현재 tenant 판정은 이 제품 권한에 추가하며, Gateway의 정확한 route/capability 등록은 별도 소유자가 검증합니다.

| #   | 메서드·suffix                 | 입력·결과                                                                    | 권한·객체 범위                                                                 |
| --- | ----------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 01  | GET 기본 경로                 | scope=ASSIGNED_TO_ME 기본 또는 ASSIGNED_BY_ME, page=0·size=50 기본, TaskPage | V, 현재 actor 범위. page 0~~10,000·size 1~~100. 원천 HTTP 없음                 |
| 02  | GET /by-source                | meetingId/reportId/candidateId → Task                                        | V + 현재 creator/assignee. 원천 inspect                                        |
| 03  | GET /commands/{commandId}     | MutationResult, 해당 명령 증거 + 현재 Task                                   | V + 현재 actor의 receipt + 현재 creator/assignee. 원천 inspect                 |
| 04  | GET /{assignmentId}           | Task                                                                         | V + 현재 creator/assignee. 원천 inspect                                        |
| 05  | GET /{assignmentId}/events    | afterVersion=-1·size=100 기본 → EventPage                                    | V + 현재 creator/assignee. 버전 오름차순, nextAfterVersion·hasMore             |
| 06  | POST 기본 경로                | CreateRequest → MutationResult                                               | V+U + owner의 확정 후보 승격 권한                                              |
| 07  | POST /{assignmentId}/accept   | VersionCommand → MutationResult                                              | V+U + 현재 담당자, 수락 대기                                                   |
| 08  | POST /{assignmentId}/decline  | VersionCommand → MutationResult                                              | V+U + 현재 담당자, 수락 대기, reasonCode 필수                                  |
| 09  | POST /{assignmentId}/start    | VersionCommand → MutationResult                                              | V+U + 현재 담당자, 수락한 활성 업무                                            |
| 10  | POST /{assignmentId}/wait     | VersionCommand → MutationResult                                              | V+U + 현재 담당자, 수락한 활성 업무                                            |
| 11  | POST /{assignmentId}/complete | VersionCommand → MutationResult                                              | V+U + 현재 담당자, 수락한 활성 업무                                            |
| 12  | POST /{assignmentId}/cancel   | VersionCommand → MutationResult                                              | V+U + 최초 creator, 활성 업무, reasonCode 필수                                 |
| 13  | POST /{assignmentId}/reassign | ReassignRequest → MutationResult                                             | V+U + 최초 creator + 현재 source 재배정 권한·새 담당자 적격성, reasonCode 필수 |

모든 POST는 UUID `Idempotency-Key`가 필수입니다. 모든 MutationResult의 Task는 commit 이후 현재 원천 inspect 결과를 포함합니다. 일반 변경의 Work 성공과 응답의 원천 공개 가능 여부는 별개입니다.

선택 X-Correlation-ID는 관찰용이며 명령 idempotency를 대체하지 않습니다. actor/tenant/permissions는 인증된 요청 맥락으로 서버가 판단하며 본문에 대리 주체를 입력하는 계약이 아닙니다.

확정 생성 DTO:

```json
{
  "source": {
    "sourceSystem": "MEETING_FOLLOWUP",
    "meetingId": "00000000-0000-4000-8000-000000000001",
    "reportId": "00000000-0000-4000-8000-000000000002",
    "candidateId": "00000000-0000-4000-8000-000000000003"
  },
  "expectedSourceVersion": 4
}
```

위 UUID와 버전은 **계약 설명 fixture**입니다. 운영 후보나 실제 검증된 source가 아닙니다. 생성 본문에 title/description/assigneeUserId/dueAt를 추가하여 AI 원문이나 담당자를 덮어쓸 수 없습니다. owner의 `ConfirmedTask`가 source/sourceVersion/assigneeUserId/title/description/priority/dueAt를 반환합니다. 확정 제목은 공백 불가·최대 500자, 설명은 선택·최대 4,000자입니다. 개인 할 일의 설명 길이 계약을 복제하지 않습니다.

| owner port                                          | 필수 책임                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| confirmCreate(actor, source, expectedSourceVersion) | 현재 actor의 권한, 정확한 tenant·회의·보고서·후보 관계, 사람의 확정, 후보 버전·담당자 적격성 확인 |
| requireReassignment(actor, source, assigneeUserId)  | 현재 배정자의 원천 권한과 같은 tenant의 적격한 새 담당자 확인                                     |
| inspect(actor, source, confirmedSourceVersion)      | 현재 source view와 canReassign 근거. 조회 결과를 명령 내부 재검증 대신 사용하지 않음              |

**새 생성·재배정은 owner 확인 실패 시 허용하지 않습니다.** timeout/서명 불일치/연결 미구성/권한 거부를 허용으로 처리하지 않습니다. Work는 서명된 원천 확인 요청의 송신부를, Meeting은 서명 검증·원자적 nonce 소비·현재 authority/ACL 판정 수신부를 소유합니다. 서비스 간 DB 직접 조회로 이 경계를 대신하지 않습니다.

원본 ACL에 더해 Meeting의 현재 product entitlement·authorityRevision·scope·identity plane·정확한 후속 업무 승격/재배정 capability를 확인해야 합니다. Work UPDATE나 Meeting host/membership은 이를 대체하지 않습니다. report/candidate의 retention_until 만료는 삭제 worker가 실행되기 전부터 접근 불가이며, CREATE/REASSIGN/READ 모두에 적용합니다. 미구성 governed authority는 허용으로 대체하지 않습니다.

signed workload는 검증 요청자의 증명이며 현재 `APP.MEETINGS` 권한을 대체하지 않습니다. 기존 Auth/People internal evaluate는 Gateway 전용이고 People는 HCM actor/scope 및 대상자 적격성의 경계입니다. Meeting이 이를 Gateway 신원으로 호출하지 않습니다. 동일 POST의 body.action READ/CREATE/REASSIGN별 권한은 현재 공통 schema로 표현되지 않으므로 **v1~v4는 변경하지 않고**, 차기 additive candidate에 internal-only binding·Meeting 전용 Auth 권한 평가 port·People target eligibility를 인계합니다. `sourceVersion`은 후보 버전, `authorityRevision`은 권한 판정 버전이며 Work version/assignmentRevision을 Meeting expected revision으로 재사용하지 않습니다.

합의된 신규 승격 방식은 Meeting U09의 **현재 인증된 사용자 브라우저가 Work SDK로 생성**하는 것입니다. 현재 U09는 기존 Work 배정의 목록·상세·수락/수행·명령 영수증을 실제 코드에서 소비하며 production 도달성 검사가 통과했습니다. 후보 CREATE/by-source 및 REASSIGN 흐름은 아직 활성화하지 않습니다. 향후 생성 시 사용자가 확인한 candidate identity/version과 같은 명령의 UUID를 유지하고, 응답 유실 시 `/commands/{commandId}`와 현재 접근 가능한 `/by-source`로 결과를 조정합니다. Meeting 서버 worker나 공용 서비스 토큰이 임의 사용자 헤더로 Work 생성을 대행하지 않습니다. 후보 확정·Work 생성·수락·완료는 각각 독립 결과입니다.

전송은 [source 프로토콜 v1](source-protocol-v1.md)을 따릅니다. 요청 bytes·HMAC·claims는 [공개 테스트 키 golden fixture](evidence/source-golden-v1.json)로 양쪽을 대조합니다. Work 송신부는 기본 HTTPS·redirect 금지, 본문 완료까지 5초 제한·16 KiB 제한, 중복 키/후행 JSON/알 수 없는 필드 거부, tenant/actor/source/action 응답 결속을 적용합니다. READ/REASSIGN/거절의 approvedTask는 null이며, 확정 업무 조건은 허용된 CREATE에서만 복사합니다. golden 일치는 현재 제품 권한이나 실제 source 접근 성공의 증거가 아닙니다.

원천 HTTP는 Work DB transaction/row lock 밖에서 실행합니다. CREATE/REASSIGN은 권한 확인 **시작부터 최대 10초** 검증 스냅샷을 사용하며, DB lock 획득 뒤 만료 여부와 해당 Work version/revision을 다시 확인합니다. 만료된 검증으로 쓰지 않으며 응답 source inspect도 commit 이후입니다. 두 서비스의 ACL 철회와 Work commit을 하나로 직렬화하는 분산 보장은 아닙니다. 이 보장이 필요한 운영 환경은 별도 source 승인 lease/취소 계약 없이 연결하면 안 됩니다.

## 3. 배정 상태와 수행 상태

확정 enum은 다음과 같습니다. 두 상태를 하나의 필드로 합치지 않습니다.

| 축              | 값                                                   | 사용자 의미                            |
| --------------- | ---------------------------------------------------- | -------------------------------------- |
| assignmentState | PENDING / ACCEPTED / DECLINED                        | 수락 대기 / 수락함 / 거절함            |
| workState       | OPEN / IN_PROGRESS / WAITING / COMPLETED / CANCELLED | 시작 전 / 진행 중 / 대기 / 완료 / 취소 |
| scope           | ASSIGNED_TO_ME / ASSIGNED_BY_ME                      | 내가 담당 / 내가 요청                  |

`PENDING + OPEN`은 아직 수락하지 않은 배정입니다. `DECLINED + OPEN`은 실행할 일이 아니라 요청자가 대응할 배정입니다. `ACCEPTED + WAITING`은 수락한 업무의 수행 대기이며 수락 대기와 다릅니다. `CANCELLED`는 terminal 상태로 수락·진행 행동을 제공하지 않습니다.

아래는 현재 service guard와 대조한 수용 기준입니다. 같은 수행 상태로의 새 start/wait, 완료/취소 후 새 변경 명령은 충돌입니다. 같은 idempotent 명령의 재전송은 별도로 기존 receipt와 현재 view에 수렴합니다.

| 행동           | 수행 주체·전제                                               | 결과 요구                                                                                                     |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 생성           | owner가 확정한 조건과 actor 권한                             | 새 배정은 PENDING/OPEN. 생성자가 수락을 대신하지 않음                                                         |
| 수락           | 현재 담당자, 수락 대기, 유효한 version/revision              | ACCEPTED. 수락만으로 진행/완료가 되지 않음                                                                    |
| 거절           | 현재 담당자, 수락 대기, 유효한 version/revision              | DECLINED. 업무 완료·원본 후보 삭제가 아님                                                                     |
| 시작/대기/완료 | 현재 담당자, 수락한 활성 업무, capability 허용               | 각각 IN_PROGRESS/WAITING/COMPLETED. Meeting 보고서 상태와 독립                                                |
| 취소           | 최초 생성자, 활성 업무, capability 허용                      | CANCELLED. 담당자의 거절과 구분                                                                               |
| 재배정         | 최초 생성자, 활성 업무, 현재 source 재배정 권한, 적격 담당자 | assignmentRevision 증가, 새 담당자의 PENDING/OPEN. 과거 수락·수행은 이력으로 남고 새 담당자에게 승계되지 않음 |

개인 할 일의 보관·재개·자유 편집을 배정 업무에 자동 적용하지 않습니다. 현재 Action enum은 ACCEPT/DECLINE/START/WAIT/COMPLETE/CANCEL/REASSIGN입니다. 범용 편집·완료 후 재개·보관 API는 이 DTO에 없습니다.

## 4. 권한과 명령

- 조회는 `APP.WORK:VIEW`와 **현재 creator 또는 현재 assignee** 조건을 모두 확인합니다. 이전 담당자는 과거에 담당했다는 이유만으로 현재 상세·목록·events·receipt를 계속 읽을 수 없습니다.
- 변경은 `APP.WORK:VIEW` + `APP.WORK:UPDATE`에 해당 action의 현재 객체 역할을 더해 검사합니다. cancel/reassign은 creator 전용입니다. Meeting host·관리자라는 사실은 Work 대리 권한이 아닙니다.
- 클라이언트는 서버 capability로 행동을 표시합니다. capability는 canAccept/canDecline/canStart/canWait/canComplete/canReassign/canCancel이며, 서버 명령에서 권한을 다시 검증합니다.
- 일반 명령은 version과 assignmentRevision을 함께 받습니다. **거절·취소·재배정은 reasonCode 필수**이고 나머지는 선택입니다. 재배정은 assigneeUserId도 받습니다. reasonCode는 `[A-Z][A-Z0-9_]{2,47}` 형식의 정책 코드이며 사용자 자유 입력 이유와 동일하지 않습니다. 허용 코드의 사용자용 선택 목록·라벨은 별도 UI 계약이 필요합니다.
- mutation result의 `assignment`는 **현재 권한에 맞는 현재 view**, `receipt`는 해당 명령이 적용된 시점의 증거입니다. 늦게 도착한 receipt의 appliedVersion으로 현재 화면을 과거 상태로 되돌리지 않습니다.
- 같은 tenant/actor/Idempotency-Key의 명령 재확인은 같은 operation/target/본문 fingerprint를 요구합니다. 다르면 충돌입니다. receipt는 현재 actor 범위로 조회하고 재배정으로 현재 참여자가 아니면 옛 성공 명령도 읽을 수 없습니다. 명령 receipt 보존 정책·실제 동시성은 실행 검증 항목입니다.

## 5. 출처 삭제·ACL·보존

이 배정 도메인의 SourceAvailability는 **AVAILABLE / UNAVAILABLE / NOT_REQUESTED**입니다. 개인 북마크의 REFERENCE_ONLY를 이 DTO에 추가하거나 문자열로 재해석하지 않습니다.

| 상태          | source 응답·UI                                                                                                                            | 독립 Work                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| AVAILABLE     | 현재 공개 가능한 reference/sourceVersion/sourceRoute만 표시. 본문·인용을 읽었다는 의미가 아님                                             | Work 권한·capability에 맞게 조회/수행                                             |
| UNAVAILABLE   | reference/sourceRoute/sourceVersion 모두 비노출. 이전 값·툴팁·DOM·AI 맥락·검색 결과로 남기지 않음                                         | 확정 Work 조건·배정·상태는 Work 권한과 보존 정책에 따라 유지                      |
| NOT_REQUESTED | 원천을 이번 응답에서 조회하지 않음. reference/sourceVersion/sourceRoute 모두 null, canReassign=false. ‘출처는 상세에서 확인’ 등 중립 안내 | 정상 Work 목록과 조회·수행 capability 제공. 권한 거부나 원천 장애로 집계하지 않음 |

`GET` 목록은 원본 HTTP를 호출하지 않습니다. 최대 100행의 source를 순차 확인하여 장애 시 각 요청의 제한 시간이 누적되는 경로를 만들지 않습니다. 프런트도 목록 완료 직후 모든 행을 자동으로 원천 조회하여 이 계약을 무효화하지 않습니다. 목록의 `NOT_REQUESTED`를 과거 상세 cache의 AVAILABLE/reference로 채워 넣지 않습니다. 상세 선택·by-source·mutation 응답·receipt는 원천 inspect 뒤 AVAILABLE/UNAVAILABLE을 판정하며, events는 source view를 반환하는 API가 아닙니다.

목록의 canReassign=false는 현재 원천 관리 권한을 아직 확인하지 않은 결과입니다. 요청자의 재배정 권한이 영구 거부됐다고 설명하지 않습니다. 상세의 현재 capability를 받은 뒤 행동을 판단하고 재배정 명령에서 owner를 다시 검증합니다. source 불가·미조회가 Work 수락/수행 capability를 일괄 취소하지 않습니다.

원본 삭제/ACL 철회/조회 불가는 Work 자동 삭제·취소·완료를 의미하지 않습니다. 현재 담당자는 Work가 허용한 수락·수행을 이어갈 수 있고, creator는 허용된 취소를 할 수 있습니다. 새 생성·재배정은 현재 owner 검증이 필요합니다. 원본을 볼 수 없다는 이유로 독립 업무의 모든 행동을 일괄 차단하거나, 반대로 업무 담당이라는 이유로 Meeting 인용을 공개하지 않습니다.

역전·중복 이벤트로 source metadata가 부활하거나 Work 상태가 과거로 돌아가면 안 됩니다. 각 원본의 버전·삭제 표식과 Work version/revision을 혼용하지 않습니다. 실제 이벤트 구독 구현이 없으면 실시간 반영 완료를 표시하지 않습니다.

`sourceVersion`은 생성할 때 사람이 확정했던 후보 버전입니다. 현재 원본 접근 조회가 Work 확정 조건을 새 Meeting 후보 버전으로 덮어쓰지 않습니다. 원본 링크는 AVAILABLE일 때만 Meeting follow-ups 경로로 생성하며, 이동 후 Meeting의 현재 ACL 검사가 다시 필요합니다. 내부 서명·nonce·응답 결속은 [프로토콜 v1](source-protocol-v1.md)을 따릅니다.

## 6. 연결 인계와 GO / NO-GO

아래 표는 연결 책임의 인계이며 이 문서 작업이 Gateway/Auth·generated SDK·Meeting 제품 코드를 수정했다는 의미가 아닙니다. 정확한 제품 capability 이름을 문서에서 임의 발명하거나 광범위 allow로 gate를 우회하지 않습니다.

| 연결 대상                          | 소유자·인계 내용                                                                                                                                                                 | 현재 상태·해제에 필요한 증거                                                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 공개 13 operations                 | Work backend → OpenAPI/Gateway/generated SDK 담당: 위 method/path·DTO·source 3상태·receipt·UUID 요청키·V/U 계약 전달                                                             | controller 코드 존재. 실제 Gateway 전달·생성 schema/SDK 일치·기존 gate 통과 결과 필요                                                                                                                                                   |
| Work 브라우저 소비                 | Work frontend SDK 담당 → Meeting U09 담당: 기존 배정 목록·상세·수락/수행·receipt와 향후 create/by-source 분리                                                                    | **기존 배정의 실제 코드 소비·도달성 통과.** pages/meetings.tsx→MeetingFollowUps→Work SDK 및 state의 detail/receipt/transition 확인. [증거](evidence/frontend-checks.json). 실제 Gateway/브라우저 종단 검증과 신규 후보 승격은 별도 대기 |
| Meeting 내부 source 수신           | Meeting 담당: exact internal method/path, assertion·현재 product authority/ACL·원자 JTI 소비·retention·golden 결속                                                               | governed S2S authority와 nonce 수신부 연결 미완료. 허용·거부·재사용·만료 실제 교차 서비스 증거 필요                                                                                                                                     |
| 공통 authority와 정확한 capability | common Auth/Gateway 소유 작업: 차기 additive candidate의 internal-only action binding, Meeting 전용 Auth port, People target eligibility, scope·identity plane·authorityRevision | v1~v4 무변경. 현 schema가 동일 POST의 body.action별 권한을 표현하지 못하므로 미해결. 기존 Gateway 전용 evaluate 가장 호출·임의 APP.MEETINGS context 금지                                                                                |
| 서비스 간 인터페이스 registry      | 공통 architecture 담당: 신규 MeetingFollowupSourceAuthority의 전용 signedWorkload와 protocol/signing/client 결속을 정식 등록                                                     | **정적 검사 통과.** 공통 담당이 registry/checker를 수정했고 Work 작업이 재실행 exit 0 확인. [증거](evidence/local-checks.json). 현재 제품 권한/적격성 및 실제 원천 연결을 활성화한 결과가 아님                                          |
| Work source 송신·DB 경계           | Work backend 담당: 크기/전체 timeout/엄격 JSON·fail closed·transaction 밖 HTTP·10초 스냅샷                                                                                       | backend 42개(실제 PostgreSQL 15개 포함, 실패/skip 0) 통과 보고. shared API 11개 통과. [검증 표](verification-matrix.md) 참조                                                                                                            |
| 새 배정 큐·상세·재배정 UI          | Work 디자인/화면 담당: [기존 시안 영향](design-impact.md) 적용                                                                                                                   | 디자인 추가 요구만 제공. 화면 제작·실제 브라우저 수락/수행 여정은 미완료                                                                                                                                                                |

**현재 실제 원천 승격은 NO-GO입니다.** governed authority/정확한 capability·대상자 적격성 및 양쪽 서명·nonce 연결, 신규 후보 확정→브라우저 Work 생성→복구의 실제 여정이 검증되기 전에는 승격 통합 성공으로 표시하지 않습니다. 기존 배정 목록/수행의 SDK 도달성 통과와 구분합니다. bounded source snapshot보다 강한 분산 직렬화가 필요한 운영 환경은 별도 승인 lease/취소 계약도 충족해야 합니다. 단독 Work 테스트 통과나 golden fixture 일치만으로 이 경계를 해제하지 않습니다.

근거: `dwp-backend/dwp-platform-server/src/main/java/com/dwp/services/platform/workhub/assignment/WorkAssignmentDtos.java`, `WorkAssignmentSourceAuthority.java`, Meeting [계약 6.6](../../DWP-R1-MTG-001-enterprise-video-meetings/05-meeting-design-contract-matrix.md#66-후속-업무와-work-정본).
