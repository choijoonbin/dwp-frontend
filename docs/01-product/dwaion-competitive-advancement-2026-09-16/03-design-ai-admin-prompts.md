# 관리자 화면 디자인 AI 프롬프트

## 공통 지시문

```text
DWP 내부 DWAI·ON의 관리자 표면을 현재 Stitch 프로젝트 안에서 확장하라.
기존 공통 셸, 관리자 navigation, typography, spacing, density, color token을 유지한다.
새 관리 콘솔처럼 분리하거나 소비자용 AI 스타일을 사용하지 않는다.

관리 화면의 목표는 “보여주기”보다 안전한 운영 결정이다. 모든 중요한 변경에는
현재 상태, 영향 범위, 변경 전후 diff, 권한, 사유, evidence, expectedVersion,
command UUID, 승인, 진행 상태, 복구와 audit reference가 있어야 한다.

공통 원칙:
- tenant 관리자라는 이유만으로 모든 capability를 허용하지 않는다.
- VIEW, CREATE, UPDATE, APPROVE, DEPLOY, ROLLBACK, EMERGENCY_STOP을 분리한다.
- 사용자 질문·답변 원문을 운영 기본 화면에 표시하지 않는다.
- 등록됨, 구성됨, 검증됨, 현재 정상, 배포됨을 서로 다른 상태로 표시한다.
- partial/unavailable/stale을 0 또는 정상으로 바꾸지 않는다.
- 개인별 감시 점수보다 집계된 업무 결과와 위험을 제공한다.
- 현재 구현, 신규 UI, 신규 API, 운영 조건부 요소를 프레임 주석으로 구분한다.
- 예시 수치에는 “디자인용 가상 데이터”라고 표시한다.
- 1920px, 1440px, 1280px, 768px, 390px, 320px, 200% 확대를 설계한다.
- 초광폭에서는 내부 작업 grid를 최대 1600px까지 유연하게 사용해 과도한 좌우
  빈 여백을 피하고, 읽기 본문만 필요한 폭으로 제한한다.
- 긴 표를 모바일 카드로 단순 복제하지 말고 긴급 상태와 핵심 행동을 우선한다.
- loading, empty, first setup, permission, partial, stale, conflict, approval pending,
  rollout regression, service failure, emergency stop 상태를 포함한다.
```

## A-01. 신규 메뉴: 모델 및 라우팅

```text
경로 /dwaion/admin/models의 “모델 및 라우팅” 관리자 화면을 설계하라.

주 사용자: AI 플랫폼 관리자, 보안·개인정보 관리자, 모델 정책 승인자, 비용 책임자
운영 질문: 어떤 데이터와 업무에 어떤 모델이 왜 선택되며 장애·비용·위험을 어떻게 통제하는가?
1차 행동: 정책 변경 검토 후 승인 요청 또는 게시
화면 archetype: registry + routing policy matrix + simulation inspector + rollout timeline

1. 운영 요약
   - 허용 provider/model, 구성 필요, degraded, circuit open
   - 게시 정책 version과 마지막 검증 시각
   - budget 사용률과 warn/throttle/block 임계치
   - 진행 중 rollout과 긴급 중단 상태

2. Provider/Model registry
   - provider, immutable model snapshot, lifecycle, modality, context limit
   - 허용 목적과 데이터 등급
   - inference/storage region, retention, training use contract, residency
   - credential은 secret reference와 검증 상태만 표시
   - 계약 등록과 실제 호출 health를 분리

3. Routing policy
   - 업무 유형, Agent, 데이터 등급, modality별 primary route
   - 허용 fallback 순서와 fallback 금지 조건
   - quality, latency, cost, availability limit
   - 근거 부족, model refusal, provider 장애, budget 초과 시 행동

4. 정책 simulator
   - 사용자 role, Agent, source classification, modality, 예상 token 입력
   - 선택 route, allow/block, 적용 policy와 이유를 읽기 전용으로 표시
   - 실제 model 호출이나 정책 변경은 하지 않음

5. 변경과 rollout
   - 변경 전후 diff, 사유, ticket/evidence
   - maker-checker 승인
   - development→pilot→조직 subset→전체 rollout
   - canary metric, stop condition, rollback version

6. 비용과 제한
   - model·Agent·조직·업무 유형별 집계
   - daily/monthly/per-run budget
   - warn, throttle, block, approved exception

7. 사고 대응
   - provider, model, modality, Agent별 stop
   - 영향 범위, 실행 중 job 처리, fallback 여부
   - incident correlation ID, 조치자, 시각, 사유
   - 복구 validation과 재승인

필수 상태 프레임: 첫 구성, credential 필요, validation 중/실패, degraded,
budget 임계치, circuit open, stale version conflict, 승인 대기/반려,
canary 회귀, rollback, emergency stop, read-only, 403, 503, partial data.
```

## A-02. Agent Builder·평가·배포·롤백

```text
기존 /dwaion/admin/agents를 Builder, Versions, Evaluation, Rollout 탭으로 확장하라.

주 사용자: Agent maker, AI 운영자, 보안 검토자, 배포 승인자
운영 질문: 이 Agent version이 어떤 model/source/tool로 무엇을 할 수 있고 배포해도 되는가?
1차 행동: 평가 증거를 검토해 pilot 승인 또는 반려
화면 archetype: agent registry list-detail + version workspace + release pipeline

Builder:
- 역할, 허용 업무, 금지 업무, 입력·출력 schema
- model route reference, source binding, tool binding, memory policy
- 각 tool의 risk와 required approval
- secret은 참조만, 실제 값 미표시

Versions:
- prompt/config/source/tool diff
- 작성자, 변경 사유, dependency version, immutable hash
- draft, review, approved, deployed, retired

Evaluation:
- 고정 test set, adversarial case, permission boundary, injection, citation,
  abstention, action safety, latency, cost
- pass/fail 분모와 실패 사례
- 비교 가능한 version 조건을 명시

Rollout:
- environment, 대상 조직·group, traffic percentage
- canary metric과 stop threshold
- 진행 중 run 처리, rollback 대상, kill switch
- deployment·rollback receipt와 audit link

필수 상태 프레임: 새 draft, binding 누락, sandbox 실패, 평가 미달,
승인 대기/반려, pilot, canary 회귀, 자동 중단, rollback, retire,
dependency degraded, revision conflict, 권한별 read-only.
```

## A-03. Connector 수명주기와 ACL 건강도

```text
기존 /dwaion/admin/sources를 Connector 운영 화면으로 확장하라.

주 사용자: 데이터 관리자, 보안 관리자, AI 운영자
운영 질문: 어떤 조직 데이터가 누구의 권한으로 얼마나 최신 상태로 검색되는가?
1차 행동: Connector 검증 또는 sync/ACL 문제 조치
화면 archetype: connector registry + health queue + scope/policy inspector

Connector 생성 flow:
- provider/type, tenant scope, owner, region
- OAuth 또는 secret reference, 최소 scope 검토
- 포함·제외 repository와 data classification
- ACL mapping 방식과 group sync source
- sync cadence, freshness SLO, retention, deletion policy
- sample query와 permission probe를 포함한 dry-run

운영 목록:
- configured, authenticating, initial sync, healthy, delayed, ACL drift,
  partial, blocked, revoked를 구분
- last successful content sync와 ACL sync를 분리
- indexed object 수를 전체 coverage로 오해하지 않게 분모 표시
- freshness lag, error rate, permission probe, reindex progress

상세 행동:
- validate, pause, resume, reindex, rotate secret reference, reduce scope, revoke
- 영향 미리보기, 진행 상태, 취소·복구, receipt

필수 상태 프레임: 첫 Connector, OAuth 대기, scope 과다 경고, initial sync,
partial index, ACL lag/drift, credential expiry, rate limit, region mismatch,
reindex, revoke, source 삭제, 403/503.
```

## A-04. 지속 평가와 안전 시뮬레이션

```text
기존 /dwaion/admin/evaluation과 /dwaion/admin/safety를 연속 흐름으로 확장하라.

주 사용자: AI 품질 책임자, 보안 검토자, Agent owner
운영 질문: 동일 조건에서 새 version이 더 안전하고 유용하며 운영 배포 기준을 통과하는가?
1차 행동: 비교 run 시작 또는 release Gate에 증거 연결
화면 archetype: dataset registry + comparison workbench + failure inspector

Dataset:
- CSV/JSON import, schema mapping, PII 검사, owner, version, checksum
- 정상·edge·adversarial·permission boundary case 구분
- 정답이 없는 rubric과 사람 검토 기준

Comparison:
- dataset, model snapshot, Agent prompt, policy, tool, evaluator version을 pin
- baseline과 candidate side-by-side
- citation correctness, abstention, ACL leak, prompt injection, harmful action,
  bias, task completion, latency, cost
- 평균만 보여주지 말고 분모, confidence, 실패 사례와 regression cluster 제공

Production monitoring:
- 익명화·최소화된 sample, feedback linkage, threshold alert
- 원문 열람은 별도 승인과 목적 제한
- drift, repeated failure, policy block, rollback recommendation

Safety simulation:
- scenario와 예상 policy decision
- 실제 쓰기 action 없음
- 적용 rule, allow/review/block 이유
- 변경 전후 policy diff와 영향

필수 상태 프레임: 빈 dataset, import 검증 오류, PII review, run queue,
부분 evaluator 실패, 비교 불가, regression, threshold breach,
Gate 연결, 승인 대기, rollback 권고, 403/503.
```

## A-05. 운영 사고와 복구

```text
기존 /dwaion/admin/overview와 /dwaion/admin/gates 안에 사고 대응 surface를 추가하라.
새 상위 메뉴는 만들지 않는다.

주 사용자: AI 운영 담당자, incident commander, 보안 승인자
운영 질문: 지금 사용자와 업무에 어떤 영향이 있고 무엇을 중단·복구해야 하는가?
1차 행동: 영향 범위 확인 후 제한적 containment
화면 archetype: prioritized incident queue + impact inspector + response timeline

운영 현황 상단에는 사용자 영향과 즉시 대응이 필요한 사고만 우선한다.
- severity, started/verified time, affected model/Agent/tool/connector
- 영향 받은 run과 조직 범위의 집계
- data exposure 의심, wrong action, quality regression, provider outage 구분
- 확인되지 않은 영향은 추정값으로 명시

상세에는 다음을 포함한다.
- detection evidence와 correlation ID
- containment 선택: route stop, Agent stop, tool disable, Connector isolate
- 진행 중 run을 cancel/finish/quarantine할지 선택
- 담당자, comms 상태, linked ticket
- recovery checklist, validation run, maker-checker 재개 승인
- replay 가능한 run과 compensation 필요 action
- immutable timeline과 postmortem link

긴급 중단도 영향 미리보기와 사유를 요구하되, 실제 긴급 상황에서 불필요한
긴 form이 대응을 막지 않게 한다. 중단 후에는 반드시 audit receipt를 남긴다.

필수 상태 프레임: 신규 alert, 조사 중, false positive, containment 대기,
부분 격리, emergency stop, recovery validation, 재개 승인, replay,
compensation, 종료, postmortem 대기, 403/503/partial telemetry.
```

## A-06. 업무 가치와 비용

```text
기존 /dwaion/admin/overview의 분석 영역을 확장하라.

주 사용자: AI 제품 책임자, 운영 책임자, 비용 책임자
운영 질문: 어떤 AI 사용이 실제 업무 결과를 개선했고 어디서 비용·품질 문제가 반복되는가?
1차 행동: 문제 Agent/업무 유형을 drill-down해 개선 backlog 생성
화면 archetype: outcome scorecard + cohort trend + diagnostic table

지표 우선순위:
1. 제안 수락 후 실제 원본 업무 완료율
2. cycle time과 수동 단계 감소
3. 재작업, rollback, compensation
4. 답변 보류와 source coverage 부족
5. 품질·안전 threshold 통과율
6. 완료 업무당 비용과 latency
7. 사용자 feedback와 반복 실패 원인

집계 범위, 기간, 분모, freshness, privacy threshold를 항상 표시한다.
소규모 집단을 숨기고 개인 생산성 순위, 질문 원문, 답변 본문을 제공하지 않는다.
token·호출 수는 원인 분석용 보조 지표로 둔다.

필수 상태 프레임: 데이터 없음, privacy threshold 미달, partial source,
stale aggregate, 전월 비교 불가, 비용 급증, 품질 하락, drill-down,
export 범위 검토, 403/503.
```
