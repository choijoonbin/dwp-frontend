# 개발 백로그와 수용 기준

## 1. 구현 순서

화면을 한꺼번에 추가하지 않는다. 먼저 운영 기반을 닫고 사용자 기능을 올린다.

### Wave -1. 현행 릴리스 차단 해소

1. DRAFT인 DWAI·ON 5개 PAGE를 공식 product surface 계약으로 승격
2. 권한 bundle과 frontend authorization source 재생성
3. route/direct link/deep link/fail-closed 권한 회귀 test
4. AI 제안→governed action의 opaque context handoff
5. proposal evidence·target version·source permission 재검증과 receipt
6. ACL 없는 대화 `공유`를 `링크 복사`로 정정
7. action handoff와 원본 앱 완료 상태를 분리

### Wave 0. 계약과 운영 기반

1. Provider/model registry와 routing policy
2. Connector lifecycle과 ACL/freshness ledger
3. durable run·scheduler·lease·retry·cancel·compensation
4. versioned Agent release와 deployment ledger
5. evaluation version pinning과 production sample
6. incident·kill switch·recovery ledger
7. 공통 execution receipt와 trace correlation

### Wave 1. 사용자 대표 기능

1. 파일 upload/preflight/parsing/citation
2. Deep Research plan과 durable execution
3. 실제 루틴 scheduler와 AI 제안함 전달
4. 산출물 source verifier·DLP·검증된 export

### Wave 2. 협업과 지속 개선

1. 팀 산출물·검토·승인·공유 취소
2. 위임형 Agent Studio
3. 업무 가치·비용 분석
4. memory provenance·expiry·end-to-end deletion receipt
5. 감사 무결성·legal hold·eDiscovery·destruction proof

## 2. 서비스별 최소 계약

### Gateway/권한

- tenant, user, session, plane, delegated identity 결속
- route 진입 권한과 각 resource/action 권한 재검증
- admin capability 세분화
- 사용자 원문·파일명·민감 metadata의 log 최소화

### Agent 서비스

- model route snapshot, prompt/config version, source/tool binding
- durable run state machine과 append-only event
- cancellation, timeout, retry, compensation
- evaluation link와 feedback correlation
- answer completion과 domain completion 분리

### 도메인 서비스

- 실제 변경 직전 PEP
- expectedVersion과 idempotency command UUID
- preview와 execute 분리
- domain result·rollback/compensation receipt
- 원본 resource deep link와 접근 재검증

### 파일·지식 처리

- upload session, checksum, malware scan, DLP/classification
- parser version, page/sheet/cell/image-region provenance
- ACL and freshness ledger
- retention, deletion, legal hold
- source revalidation before answer reuse and action

### 운영·감사

- provider/model/connector/tool/Agent health
- deployment, rollback, emergency stop ledger
- audit integrity proof와 export scope
- incident correlation과 recovery approval
- PII 최소화된 aggregate analytics

## 3. Epic과 완료 조건

| ID    | Epic                             | 핵심 API/데이터                                                           | UI 위치                  | 완료 조건                                                                       |
| ----- | -------------------------------- | ------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| R0-01 | Official DWAI PAGE authorization | product surface PAGE keys, entitlement projection, generated route source | 앱 route guard           | 5개 PAGE가 DRAFT에서 제거되고 bundle·direct/deep-link·deny test 통과            |
| R0-02 | Proposal→Action continuity       | proposal-to-draft lookup 또는 opaque launch, evidence binding, preview    | 제안함→업무 실행         | generic catalog 이동 없이 최신 권한으로 preview를 복원하고 handoff receipt 검증 |
| R0-03 | Honest share/action state        | link copy label, target handoff state, domain callback receipt            | 대화·업무 실행           | ACL 공유를 암시하지 않고 접수·인계·원본 완료를 서로 다른 상태로 검증            |
| P0-01 | Model & Routing                  | provider, model snapshot, route policy, budget, health, circuit, rollout  | 신규 관리자 메뉴         | version publish·simulation·canary·rollback·stop과 audit receipt가 실제 동작     |
| P0-02 | Secure Attachments               | upload, scan, DLP, parse, citation provenance, retention                  | 새 대화                  | 차단·부분 parsing·권한 변경·삭제를 포함한 E2E 통과                              |
| P0-03 | Durable Runs                     | run/step/event, lease, retry, cancel, compensation, receipt               | 실행 이력·루틴           | restart 후 재개, 중복 trigger 억제, 원본 결과 영수증 검증                       |
| P0-04 | Deep Research                    | plan, scope, source coverage, budget, report version                      | 새 대화·실행 이력·산출물 | pause/resume/cancel, 부분 실패, 인용 보고서 저장 E2E 통과                       |
| P0-05 | Connector Ops                    | connector, auth ref, sync/ACL ledger, probe, drift, revoke                | 관리자 데이터 원천       | ACL drift 탐지·격리·reindex·revoke와 영향 receipt 검증                          |
| P0-06 | Agent Release                    | config version, evaluation evidence, deployment, traffic, rollback        | 관리자 에이전트          | maker-checker, pilot, metric stop, rollback, history 검증                       |
| P0-07 | Continuous Eval                  | dataset version, pinned run, production sample, regression                | 평가·안전                | 동일 조건 비교, 실패 drill-down, Gate 연계, rollback 권고 검증                  |
| P0-08 | Incident Response                | alert, impact, containment, timeline, recovery                            | 운영 현황·Gate           | scoped kill switch, run 격리, recovery 승인, immutable timeline 검증            |
| P1-01 | Team Artifacts                   | workspace, role, review, DLP, share expiry, revoke                        | 산출물 탭                | 권한 재검증·conflict·승인·공유 취소·export E2E 통과                             |
| P1-02 | Personal Data Closure            | memory provenance, expiry, deletion job, destruction receipt              | 개인 AI 제어             | source/index/backup 상태와 legal hold를 정확히 표시                             |
| P1-03 | Outcome Analytics                | work outcome, cost, quality, privacy threshold                            | 운영 현황                | 개인 노출 없이 분모·freshness·업무 결과 drill-down 검증                         |

## 4. 공통 수용 기준

### 기능

- 화면의 모든 활성 행동이 실제 API와 연결된다.
- 비활성 기능은 지원하는 것처럼 표현하지 않는다.
- preview, approve, execute, complete를 다른 상태로 관리한다.
- 중복 클릭, timeout 후 재시도, 응답 유실이 중복 업무 변경을 만들지 않는다.
- 장기 작업은 앱 재시작과 worker 재배포 후에도 일관되게 재개하거나 종료된다.

### 권한과 개인정보

- route guard만으로 권한을 보장하지 않고 resource·source·action마다 서버가 다시 검사한다.
- source ACL이 바뀌면 cached answer, citation, export, share를 재검증한다.
- 관리자 기본 화면에 개인 질문·답변·파일 본문을 노출하지 않는다.
- memory·파일·산출물 삭제는 접수와 물리 완료를 구분한다.

### 신뢰와 증거

- 모든 중요한 상태에 확인 시각, source, policy/version을 표시한다.
- partial·stale·unavailable을 정상이나 0으로 바꾸지 않는다.
- 최종 업무 완료에는 domain receipt 또는 `원본 앱에서 확인 필요`가 있다.
- Agent/model/policy 변경과 사용자 결과를 trace로 연결할 수 있다.

### 접근성과 responsive

- 1440×900, 1280×800, 768px, 390×844, 320×568, 200% 확대에서 핵심 행동이 보인다.
- 키보드만으로 작성·검토·승인·취소·복구가 가능하다.
- focus 순서, screen reader name/role/state, live region, 44px touch target을 검증한다.
- reduced motion과 forced colors에서 상태 의미가 유지된다.

### 테스트

- 계약 test: OpenAPI/generated type과 서버 구현 일치
- 권한 test: cross-tenant, cross-user, revoked source, missing capability
- state machine test: retry, duplicate, stale version, cancel, compensation
- E2E: happy path보다 partial/error/recovery와 receipt까지 검증
- visual regression: Stitch 승인 프레임 기준 1440/1280/390/320
- 운영 drill: provider outage, ACL drift, bad rollout, kill switch, recovery
- 증거 분류: fixture E2E, API integration, 실제 provider smoke, staging E2E, production probe를 구분

## 5. 출시 Gate

| Gate        | 통과 조건                                                                |
| ----------- | ------------------------------------------------------------------------ |
| Contract    | API, 권한, 상태 기계, error taxonomy, audit event가 승인됨               |
| Security    | threat model, file scanning/DLP, secret handling, source ACL 재검증 통과 |
| Quality     | pin된 dataset에서 baseline 대비 회귀 없음, 실패 사례 검토 완료           |
| Reliability | restart·retry·cancel·compensation·idempotency 시험 통과                  |
| UX          | Stitch diff, responsive, 접근성, partial/error/recovery 상태 승인        |
| Operations  | dashboard, alert, runbook, kill switch, rollback, on-call owner 준비     |
| Privacy     | retention, deletion, legal hold, aggregate privacy threshold 검증        |
| Release     | maker-checker 승인, pilot scope, stop threshold, rollback version 확정   |

## 6. 완료 보고 형식

각 Epic은 다음 증거가 모두 있어야 `완료`로 보고한다.

1. 배포된 commit·artifact·환경
2. 실제 endpoint와 권한 matrix
3. E2E·계약·접근성·visual 결과
4. 정상·부분 실패·복구 screenshot 또는 trace
5. audit·domain receipt 예시
6. 운영 dashboard·alert·runbook
7. 알려진 제한과 비활성 capability

디자인 완료, UI 구현, API mock 성공, 테스트 fixture 성공을 운영 완료와 같은 의미로 사용하지 않는다.
