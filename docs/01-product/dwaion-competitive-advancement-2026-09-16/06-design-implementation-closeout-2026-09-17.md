# DWAI·ON 디자인 구현 종결 기록

상태: **검증 진행 중**

이 문서는 `design-freezes/dwaion-2026-09-16`에 동결된 사용자 38개 프레임과 관리자 24개 프레임의 구현·검증 근거를 한곳에 기록한다. 화면이 렌더링된 사실만으로 완료 처리하지 않는다. 실제 API, DB, 권한, 감사 이벤트, 멱등성, 실패·복구 상태와 반응형·접근성 검증을 함께 통과해야 해당 항목을 완료로 변경한다.

## 판정 원칙

- 디자인의 샘플 수치나 공급자 상태를 제품 사실로 복사하지 않는다.
- 실제 연결된 기능은 현재 서버 상태와 영수증을 표시한다.
- 외부 공급자나 배포 환경 설정이 필요한 기능은 화면에서 제거하지 않고 `unavailable` 상태, 이유 코드, 복구 안내를 표시한다.
- `preview`, `accepted`, `queued`, `in progress`, `completed`를 구분하고 실제 도메인 영수증 전에는 완료로 표시하지 않는다.
- Desktop과 Mobile은 같은 리소스 ID, revision, 상태, 영수증을 사용한다.
- 로컬 브라우저 저장은 임시 세션 초안에만 사용하고 서버 완료나 감사 증거로 표현하지 않는다.

## 사용자 화면 추적

| 디자인 묶음 | 제품 화면 | 실제 계약 및 저장소 | 디자인에 정의된 핵심 동작 | 검증 상태 |
| --- | --- | --- | --- | --- |
| U-00 제안 기반 행동 검토 | AI 제안함, 제안 상세, 행동 검토 | `/v1/proposals`, `/v1/proposals/{proposalId}/decisions`, `/v1/proposals/{proposalId}/handoff`, `/v1/proposal-handoffs/{handoffId}` | 증거·영향 검토, preflight, 멱등 인계, 임시 초안, 원 앱 이동, 실제 완료 영수증 | 진행 중 |
| U-01 보안 파일·멀티모달 | 새 대화의 보안 첨부 트레이와 답변 인용 | `/v1/attachments`, `/complete`, `/evidence`, 삭제 API와 파일 저장소 | 업로드, checksum, AV, DLP, parser/OCR, 인용, 검사 증거, 보존·삭제 | 진행 중 |
| U-02 Deep Research | 계획, 실행, 보고서, delivery와 복구 | `/v1/research/plans`, `/runs`, `/commands`, `/execute`, `/deliveries`, `/downloads/*`, artifact/proposal/export/handoff/share/routine API | 계획, 범위, budget, pause/resume/cancel, 부분 실패, 충돌, 보고서, 원시 데이터·receipt·audit 다운로드, 후속 인계 | 진행 중 |
| U-03 AI 루틴 | 루틴 목록, 편집기, 실행·복구 패널 | `/v1/routines`, activation, dry-run, runs, commands, webhook-events, versions, rollback, health, telemetry | schedule/webhook trigger, source 경계, zero-write, 예산·retry, dry-run, 활성화, version·rollback, health·telemetry, compensation | 진행 중 |
| U-04 팀 산출물 | Artifact Studio의 개인·팀·검토 작업공간 | `/v1/artifact-collaboration/*`, comment/reply/resolve, workspace·member·preflight·conflict·share·revoke API | 풍부한 편집, source citation, autosave/version, 팀 ACL, inline comment, 사전검사, 충돌 복구, 만료 공유·철회, export | 진행 중 |
| U-05 개인 Memory·삭제 | 개인 AI 제어, Memory 상세, 삭제 작업·이력 | `/v1/ai-controls`, `/memories`, `/v1/personal-data/*`, retention·deletion·retry API | 명시적 Memory, scope·expiry·snooze·delete, 출처·실사용·암호화 근거, 단계별 삭제, legal hold, 완료 receipt | 진행 중 |

## 관리자 화면 추적

관리자 A-01~A-06은 공통 Control Plane 명령 모델을 사용한다. 고위험 명령은 `expectedVersion`, command UUID, idempotency key, 변경 사유, ticket/evidence, before/after diff, 영향 범위와 Maker-Checker 결정을 요구한다. 실행 중 명령에는 취소·재시도·rollback 상태와 receipt가 결속된다.

| 디자인 묶음 | 관리자 메뉴 | 조회 계약 | 명령 범위 | 검증 상태 |
| --- | --- | --- | --- | --- |
| A-01 | 모델 및 라우팅 | `/v1/admin/control-plane/models-routing` | provider/model publish, route simulation, canary, rollback, emergency stop/recovery | 코드 완료, 최종 회귀 대기 |
| A-02 | Agent Builder | Agent release snapshot | version, binding, evaluation evidence, promote, rollback, kill switch | 코드 완료, 최종 회귀 대기 |
| A-03 | 데이터 원천 | `/v1/admin/control-plane/connectors` | probe, ACL mapping, sync/reindex, credential rotation, scope 축소, revoke/delete, recovery | 코드 완료, 최종 회귀 대기 |
| A-04 | 평가 및 안전 | `/v1/admin/control-plane/evaluation-safety` | dataset mapping, PII review, comparison, evaluator recovery, regression·drift·safety gate | 코드 완료, 최종 회귀 대기 |
| A-05 | 사고 대응 | `/v1/admin/control-plane/incidents` | containment, quarantine, replay, compensation, validation, recovery approval, close/postmortem | 코드 완료, 최종 회귀 대기 |
| A-06 | 성과·비용 | `/v1/admin/control-plane/outcomes` | cohort/outcome, cost simulation, budget/spike/policy control, privacy threshold, export review | 코드 완료, 최종 회귀 대기 |

공통 명령 endpoint는 `/v1/admin/control-plane/commands`이며 조회, 생성, 결정, 취소, 재시도, rollback을 제공한다.

## 사실 기반 capability 처리

다음 영역은 디자인에 표시되지만 연결되지 않은 배포 환경에서 성공으로 표현하면 안 된다.

- PDF renderer, 전자결재, 외부 팀 공유, DLP/SIEM/KMS/WORM 공급자, backup destruction, legal-hold appeal
- 자동 Memory 추론, 신뢰도 점수, fact vector, 세부 사용 이벤트 trail
- OAuth refresh, 외부 notification·delivery, provider escalation, 임시 budget 상향

각 항목은 API의 closed capability 객체로 제공하고 UI는 `available`, `reasonCode`, `recoveryHint`를 그대로 표시한다. 수동 Memory 출처, 실제 사용 횟수·최근 사용 시각, 암호화 제공자·키 버전·키 참조 지문처럼 내부에서 검증 가능한 증거는 실제 값만 표시한다.

## 최종 검증 체크리스트

- [ ] Agent OpenAPI 생성물과 Frontend TypeScript snapshot checksum 일치
- [ ] Product authorization v24의 Frontend·Backend route key 완전 일치
- [ ] 새 PostgreSQL에서 V42·V43·V44 포함 전체 migration과 tenant/user/role/stale/idempotency/append-only test 통과
- [ ] Agent 전체 test, architecture test, OpenAPI check 통과
- [ ] Frontend typecheck, scoped lint, 관련 Vitest 통과
- [ ] 사용자 U-00~U-05와 관리자 A-01~A-06 Playwright 통과
- [ ] 새 대화·내 대화의 1920px fluid-width 회귀 통과
- [ ] 1440, 1280, 768, 390, 320, 200% 확대, forced-colors, keyboard, Axe 검증 통과
- [ ] dead button, `href="#"`, browser-only 가짜 다운로드, 성공으로 위장한 fixture 제거 확인
- [ ] Frontend, Agent, Backend의 DWAI·ON 변경만 분리 commit하고 `origin/dwp-dev` push

## 완료 보고에 포함할 증거

최종 판정 시 이 문서의 상태를 갱신하고 다음을 기록한다.

1. 세 저장소 commit SHA와 push 결과
2. endpoint·권한 matrix 및 OpenAPI checksum
3. 단위·통합·E2E·접근성·반응형 결과
4. 정상·부분 실패·복구·완료 screenshot 경로
5. 감사·도메인 receipt 예시
6. 실제 provider 연결이 필요한 제한과 recovery hint

