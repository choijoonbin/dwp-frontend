# Activity 고도화 설계 기준

> 작성일: 2026-10-28
> 대상: DWP Activity 홈·타임라인·상세, Platform Activity API, DWAI/ON Agent 원장, 품질·운영 게이트
> 상태: 구현 기준선. 이 문서의 수용 조건을 통과해야 로컬 완료로 간주하며, 운영 배포 승인을 대신하지 않는다.

## 1. 결정 요약

Activity의 역할은 **검증 가능한 업무·AI 활동을 한곳에서 관찰하고, 이상 신호를 원본 화면의 복구 행동으로 연결하는 허브**다.

- 홈은 “지금 확인할 것”을 예외 우선으로 보여준다.
- 타임라인은 “무슨 일이 있었는가”를 시간순으로 탐색하게 한다.
- 상세는 “왜 믿을 수 있는가, 어디에서 후속 행동을 해야 하는가”를 설명한다.
- 승인·재시도·취소·업무 편집은 Activity 안에서 직접 실행하지 않는다. 권한과 상태의 원본인 도메인 화면으로 이동한다.
- 지원하지 않는 원천을 폭넓게 보이는 것보다, 권한과 감사 근거를 입증할 수 있는 원천만 정확하게 표시한다.

이번 고도화는 화면 개선만이 아니라 다음 네 축을 하나의 계약으로 다룬다.

1. 예외 발견 시간 단축과 부분 실패 복원력
2. Agent 상태 변경 시각과 감사 연결의 사실성
3. 검색·폴링·DB 연결의 성능 안전성
4. 자동화된 품질 게이트와 운영 준비 증적

## 2. 제품 경계

### 2.1 포함 범위

- Workspace/Personal Work/App usage의 권한 검증 가능한 활동
- DWAI/ON Agent의 현재 실행 snapshot과 안전하게 공개 가능한 상태
- Mail/Calendar 연결 상태 및 복구 경로
- Activity 홈, 타임라인, 상세, 저장 뷰, URL 필터 상태
- 소스별 부분 성공·실패·지연 표시
- 접근성, 반응형, 관측 지표, CI 및 운영 준비 절차

### 2.2 명시적 비범위

- Mail/Calendar의 원문·제목·참석자·본문 등 raw event를 새 공통 원장으로 복제
- Activity 안에서 원본 업무나 Agent 실행을 승인·수정·재시도·취소
- 원본 권한 검증 없이 외부 projection을 노출
- Agent snapshot에서 기록되지 않은 과거 lifecycle을 합성
- 사용자의 검색어, 활동 ID, 실행 ID, 제목을 제품 분석 이벤트에 적재
- 보존 정책과 legal hold 승인이 없는 운영 데이터 삭제

Mail/Calendar는 이번 단계에서 **연결 건강 상태와 복구 진입점**만 제공한다. 도메인 raw event 확장은 별도 데이터 최소화·권한·보존 설계를 통과한 뒤 독립 의사결정으로 진행한다.

## 3. 정보 구조와 화면 계약

### 3.1 공통 헤더

- 현재 조회 범위와 시간 범위를 사람이 읽을 수 있는 문장으로 표시한다.
- 전체 결과가 아니라 소스별 상태를 합성한 `정상`, `일부 지연`, `일부 실패` 상태를 표시한다.
- 한 소스의 실패가 다른 소스의 성공 결과를 가리지 않는다.
- 필터와 저장 뷰는 URL로 복원 가능해야 하며 뒤로 가기, 새로고침, 공유 링크에서 동일한 결과를 재현해야 한다.

### 3.2 홈: 지금 확인할 것

표시 순서는 다음과 같다.

1. 요약 및 합성 상태
2. 주의 필요 항목 목록
3. 최근 활동
4. 연결 상태

주의 필요 숫자는 반드시 동일 응답의 `attentionItems` 목록과 연결한다. 각 항목은 정확한 Activity 상세 또는 권한이 보장된 원본 경로로 이동한다. 단순 카운트만 보여주지 않는다.

연결 상태는 장애·인증 만료·동기화 지연을 먼저 펼치고, 건강한 연결은 압축해서 표시한다. Mail 복구는 `/mail/accounts`, Calendar 복구는 `/calendar/settings`로 연결하며 실제 라우트 가드와 권한 검사를 다시 통과한다.

### 3.3 타임라인: 있었던 일 탐색

- 최신순 keyset pagination을 유지한다.
- 검색은 300ms debounce 후 서버에 전달한다. 입력 중 매 키 입력마다 조회하지 않는다.
- 카드에는 사용자 판단에 필요한 제목, 유형, 상태, 시각, 원천을 우선한다.
- 긴 execution ID 같은 기술 식별자는 목록 카드에서 제거하고 상세의 기술 정보 영역에만 둔다.
- 결과 없음은 `원래 기록 없음`과 `현재 필터 결과 없음`을 구분한다. 필터 결과 없음에는 한 번에 초기화할 수 있는 동작을 제공한다.

### 3.4 상세: 사실·근거·원본 연결

- Activity ID를 통해 단건을 조회하고, 목록에서 받은 데이터를 진실의 원천으로 재사용하지 않는다.
- 제목·현재 상태·발생 시각·상태 변경 시각·소스·행위자·안전한 오류·근거·원본 링크를 논리적으로 분리한다.
- 사용자에게 의미 있는 근거와 기술 메타데이터를 시각적으로 구분한다.
- 원본 링크는 권한을 재검사하며, 링크가 없거나 권한이 없으면 행동을 추측해 만들지 않는다.
- Agent 상세의 live 상태만 짧게 갱신하고, terminal 실행과 불변 evidence는 반복 폴링하지 않는다.

## 4. 부분 성공·실패 계약

| 상황                 | 화면 동작                                                            | 금지 사항                            |
| -------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| 요약 성공, 피드 실패 | 요약과 연결 상태를 유지하고 최근 활동 영역에 재시도 가능한 오류 표시 | 전체 화면 오류로 성공 데이터를 숨김  |
| 요약 실패, 피드 성공 | 최근 활동을 유지하고 요약 영역만 오류 표시                           | 피드 제거                            |
| 한 원천 실패         | 성공 원천 결과와 실패 원천 이름·재시도 표시                          | 전체를 빈 상태로 표시                |
| 연결 상태 실패       | Activity 기록은 유지하고 연결 영역만 오류 표시                       | 기록 조회 차단                       |
| 필터 결과 0건        | 적용 필터와 초기화 동작 표시                                         | 최초 사용 빈 상태 문구 사용          |
| 전체 원천 0건        | 온보딩 성격의 정상 빈 상태 표시                                      | 장애처럼 경고                        |
| 인증·권한 오류       | 로그인/권한 경계에 맞는 안내, 민감 정보 없는 오류                    | 존재 여부를 추론할 수 있는 상세 노출 |

재시도는 실패한 query만 다시 실행한다. 성공한 섹션을 불필요하게 초기화하지 않는다.

## 5. 데이터 및 API 계약

### 5.1 시간 의미

- `createdAt`: 실행 또는 활동 record가 생성된 시각이며, Activity feed cursor의 불변 정렬 키다.
- `stateChangedAt`: 현재 상태로 마지막 전이된 시각이다.
- `completedAt`: 완료 계열 terminal 상태의 완료 시각이며 모든 상태에 존재한다고 가정하지 않는다.

Agent migration에서 기존 record는 `COALESCE(completed_at, created_at)`로 `state_changed_at`을 backfill한다. 이후 모든 유효 상태 전이는 같은 transaction에서 `state_changed_at`을 갱신한다. lease 만료로 유효 상태가 바뀌는 경우에도 응답의 `stateChangedAt`은 실제 효력 발생 시각을 반영한다.

Feed cursor는 mutable한 `stateChangedAt`으로 바꾸지 않는다. `createdAt` 기반 keyset 안정성을 유지하고, 홈의 주의 필요 항목만 유효 상태 변경 시각으로 우선순위를 계산한다.

### 5.2 안전한 오류와 복구 힌트

Agent 사용자 DTO는 raw exception, stack trace, prompt, tool input/output, provider payload를 반환하지 않는다.

- `safeErrorCode`: 닫힌 allowlist의 안정적 코드만 허용한다.
- `recoveryHint`: 코드에 대응하는 사전 정의 문구 또는 enum만 허용한다.
- 알 수 없는 오류는 일반 코드로 축약한다.
- tenant ID, 내부 host, SQL, 경로, token, 이메일, 실행 payload는 오류 문구에 포함하지 않는다.

### 5.3 감사 연결 상태

Agent 실행 완료와 Platform 감사 수집은 다음 상태 기계로 다룬다.

```text
실행 terminal 기록
  -> audit_link_state=PENDING
  -> 디스크 spool 기록
  -> Platform collector 2xx
  -> Agent DB에서 tenant + targetType=AGENT_RUN + targetId + eventId를 재검증해 LINKED
  -> 로컬 확인 성공 후 spool 제거
```

- Platform collector가 성공해도 Agent DB의 로컬 확인이 실패하면 spool을 보존하고 재전송한다.
- 재전송은 동일한 deterministic event ID로 멱등 처리한다.
- 다른 tenant, target type, target ID의 event로 실행을 연결할 수 없다.
- collector 실패·timeout·비정상 응답에서는 `PENDING`을 유지한다.
- V73 확장 이후 V79 backfill 전 ACK가 도착하면 현재 projection의 정확한 event를 먼저 세대별 원장에 기록한 뒤 ACK한다. 이 event를 legacy receipt로 오인해 spool을 삭제하지 않는다.
- 롤링 배포 중 generation이 바뀌면 DB trigger가 UPDATE의 이전 세대와 새 세대 audit identity를 모두 보존한다.
- 온라인 backfill은 중간 종료 후 재실행 가능해야 하며, 남아 있는 procedure와 부분 처리된 batch 때문에 영구 실패하지 않는다.
- 감사 ID나 과거 상태를 UI에서 합성하지 않는다.

### 5.4 연결 상태

연결 상태는 최소한 다음을 구분한다.

- `lastSuccessAt`: 마지막 성공 시각
- `lastAttemptAt`: 성공 여부와 무관한 마지막 시도 시각
- 현재 health/state
- 안전한 복구 경로

마지막 성공만으로 “최근 시도했지만 실패 중”인 연결을 건강하게 보이게 하지 않는다.

## 6. 조회·성능 정책

### 6.1 적응형 갱신

| 데이터              | 정책                                                 |
| ------------------- | ---------------------------------------------------- |
| 홈 요약·최근 활동   | 화면이 보일 때 주기 갱신, background에서는 중단      |
| 타임라인            | 탐색 중에는 캐시를 우선하고 낮은 빈도로 갱신         |
| live Agent 실행     | 짧은 주기로 갱신하고 terminal 전환 즉시 중단         |
| terminal Agent 실행 | 긴 stale time, 자동 반복 폴링 없음                   |
| evidence            | 불변으로 취급, 자동 반복 폴링 없음                   |
| DWAI 누적 페이지    | 이미 확정된 과거 페이지 전체를 계속 refetch하지 않음 |

누적 페이지에 아직 `RUNNING`인 실행이 있으면 해당 run ID만 15초 단위로 제한 조회한다. 각 실행이 terminal이 되면 그 ID의 polling을 즉시 멈춘다. `404`는 그 실행만 제거하고, `401/403`은 전체 Activity 캐시를 fail-closed하며, 일시적 네트워크·5xx 오류에서는 마지막으로 검증된 행을 유지하고 terminal 응답을 받을 때까지 해당 live ID의 polling을 계속한다.

브라우저 focus 복귀 시 필요한 query만 갱신한다. 숨겨진 탭에서 동일한 60초 polling을 무기한 수행하지 않는다.

### 6.2 검색

- 클라이언트는 300ms debounce와 이전 요청 취소/무효화를 적용한다.
- 서버는 사용자 입력을 parameter binding한다.
- 여러 텍스트 필드의 부분 검색 표현식과 동일한 trigram 인덱스를 migration으로 제공한다.
- tenant, ACL, 시간 범위 조건은 검색과 함께 항상 적용한다.
- migration 전후 `EXPLAIN`과 실제 tenant 규모의 p95를 운영 준비 단계에서 비교한다.

### 6.3 DB 연결

Agent Activity 단건과 목록 모두 DB 연결에 유한한 connect timeout을 적용한다. 외부 네트워크 또는 DB 장애가 요청 thread를 무기한 점유하지 않도록 한다.

## 7. 접근성·반응형·시각 원칙

- 1440px, 1280px, 390px, 320px 및 브라우저 200% 확대를 품질 게이트에 포함한다.
- 모바일 필터 drawer는 focus trap, Escape 닫기, 닫힌 뒤 trigger focus 복귀를 보장한다.
- 상태는 색상만으로 표현하지 않고 텍스트/아이콘을 함께 제공한다.
- heading 순서, landmark, accessible name, keyboard 순서를 자동·수동으로 확인한다.
- 긴 식별자와 번역 문자열은 레이아웃을 밀어내지 않도록 wrap/truncate 규칙과 상세 접근 경로를 함께 제공한다.
- 건강 상태보다 문제와 다음 행동이 먼저 보이는 차분한 예외 우선 시각 계층을 유지한다.

## 8. 관측과 제품 지표

### 8.1 사용자 경험 지표

현재 Platform의 Product Surface Telemetry runtime allowlist에는 Activity product/surface dimension이 등록되어 있지 않다. 따라서 `activity.*` 같은 미등록 dimension을 보내거나 다른 제품으로 오분류하지 않는다. 먼저 `activity.home`, `activity.timeline`, `activity.source-handoff` governed dimension을 제품 권한 registry와 telemetry projection에 정식 등록하고 서버·클라이언트 계약 테스트를 통과해야 한다.

등록이 완료된 뒤에만, 동의가 있는 경우 기존 Product Surface Telemetry의 닫힌 generic event를 사용한다.

- Activity 진입에서 주의 항목 상세 확인까지의 `time-to-find`
- Activity에서 Mail/Calendar/업무/Agent 원본으로 이동한 source handoff
- 필터 탐색의 완료·실패·중단

이벤트에는 검색어, Activity ID, 실행 ID, 제목, 원문, 사용자 입력을 넣지 않는다. 동의가 없거나 상태 확인이 실패하거나 governed dimension이 아직 없으면 기록하지 않는다. 정식 등록 전 경험 기준선은 식별자 없는 승인된 usability 측정과 집계 서비스 지표로만 수집한다.

### 8.2 서비스 지표

Micrometer 지표는 낮은 cardinality tag만 사용한다.

- Activity 요청 수와 결과 상태
- 소스별 성공·실패·timeout
- 부분 성공 응답 수
- 조회 latency
- 검색 요청과 결과 상태

tenant ID, user ID, record ID, query 문자열, 오류 원문은 tag로 사용하지 않는다.

초기 운영 기간에 다음 baseline을 수집한 뒤 SLO를 승인한다.

- API p50/p95/p99
- 부분 실패율과 원천별 실패율
- 빈 결과율과 필터 초기화율
- 주의 항목 상세 도달 시간
- 원본 handoff 성공률

## 9. 품질 및 운영 게이트

### 9.1 자동화 게이트

- Frontend Activity unit/integration test
- Activity E2E와 승인된 visual snapshot
- 320/390/1280/1440 및 200% 확대 접근성 시나리오
- Backend Activity repository/service/controller test와 migration 검증
- Agent Postgres 18.4 기반 Activity integration test
- 중단된 V76/V79 backfill 재시작과 V73→V79 사이 collector ACK 경쟁 조건 test
- 감사 collector 재전송, 멱등, tenant/target binding test
- OpenAPI/contract 생성물 drift 확인

DB가 필요한 테스트는 CI에서 DB 부재를 이유로 조용히 skip하지 않는다. 로컬 skip guard는 허용하되, 전용 CI job에는 Postgres service와 명시적 환경을 제공한다.

### 9.2 운영 준비

운영 runbook은 다음을 출시 전 증적으로 요구한다.

- migration 사전 점검, 적용, 검증, roll-forward/rollback 판단
- 실제 권한 계정으로 다중 tenant·ACL 음성 테스트
- Mail/Calendar 연결 실패와 복구 경로 canary
- Agent collector 장애·복구 및 `PENDING -> LINKED` 수렴 확인
- 검색 인덱스 사용과 latency baseline
- dashboard, alert, 담당자, 장애 triage 절차
- backup/restore rehearsal와 증적 위치
- 보존, archive, legal hold, 삭제 승인 정책

Activity 원장에 delete/update 방지 trigger가 있는 동안 임의 정리 SQL을 운영 절차로 제시하지 않는다. 보존·archive는 legal hold와 restore 검증을 포함한 별도 승인 설계가 먼저다.

## 10. 단계별 배포와 되돌림

1. **계약·migration 준비**: schema와 API를 선배포하되 구버전 UI/consumer와 호환한다.
2. **내부 검증**: 테스트 tenant에서 상태 변경 시각, 감사 수렴, 부분 실패를 확인한다.
3. **제한 canary**: 소수 tenant에서 지표와 로그를 관찰한다.
4. **점진 확대**: 실패율·latency·권한 이상이 기준 이내일 때만 확대한다.
5. **일반 공개**: runbook 증적과 운영 담당자 승인을 완료한다.

UI 기능은 feature flag 또는 독립 배포 단위로 되돌릴 수 있어야 한다. DB migration은 destructive rollback을 전제로 하지 않고, 호환 column/index를 유지한 채 application roll-forward를 우선한다.

## 11. 완료 수용 조건

- 홈에서 주의 건수가 실제 항목과 연결되고 정확한 상세로 이동한다.
- 홈의 한 query가 실패해도 성공한 섹션은 계속 사용할 수 있다.
- 정상 빈 상태와 필터 빈 상태가 구분되고 초기화 동작이 동작한다.
- 검색 입력은 debounce되며 tenant/ACL 조건을 우회하지 않는다.
- 건강한 연결은 압축되고, 실패 연결은 마지막 시도와 복구 경로를 제공한다.
- live/terminal/evidence 데이터의 갱신 빈도가 서로 다르고 불필요한 refetch가 중단된다.
- Agent의 모든 상태 전이가 `stateChangedAt`을 정확히 갱신하며 feed pagination은 안정적이다.
- collector 성공 후에만 감사 연결이 `LINKED`가 되고, 로컬 확인 실패 시 spool이 남는다. 재시도 세대별 audit event는 불변 행으로 보존되어 이전 ACK가 최신 시도의 상태를 덮지 않는다.
- raw 오류와 민감 payload가 사용자 DTO·telemetry·metrics에 노출되지 않는다.
- Activity E2E/visual, Backend test, Agent DB integration test가 CI의 필수 검증으로 실행된다.
- 검색 인덱스와 낮은 cardinality metrics가 migration/test로 검증된다.
- 운영 runbook에 실제 canary·복구·보존·증적 절차와 책임 경계가 명시된다.

## 12. 외부 실행 경계

저장소 안에서 구현·migration·자동 테스트·로컬 통합 검증·운영 절차 작성까지 완료할 수 있다. 다음 항목은 운영 권한과 실제 외부 환경이 필요하므로 코드 변경만으로 완료했다고 주장하지 않는다.

- 운영 또는 staging tenant에 migration 적용
- 실제 Mail/Calendar provider 인증 만료·복구 canary
- 실제 다중 tenant 계정으로 권한 음성 테스트
- 운영 dashboard/alert 배치와 on-call 승인
- backup/restore rehearsal 및 legal hold/보존 정책 승인

이 항목은 runbook의 체크리스트와 증적 형식까지 준비하고, 승인된 담당자가 실행한 결과를 첨부해야 운영 완료가 된다.

## 13. 구현 파일 지도

- Frontend: `apps/dwp/src/features/activity/**`, `apps/dwp/src/pages/activity.tsx`, `libs/shared-utils/src/api/**`, Activity E2E/visual specs
- Platform Backend: Activity controller/service/repository/DTO, Flyway migration, Micrometer instrumentation
- Agent: Activity route/model/store, run state transition, audit delivery spool, versioned SQL migration, OpenAPI·integration tests
- CI: Frontend quality workflow, Agent quality workflow, Backend test/migration jobs
- 운영: 동일 기능 폴더의 production readiness runbook

구현 세부 파일명은 코드 구조를 따르되, 위 제품·데이터·보안 계약을 우회하는 편의 구현은 허용하지 않는다.
