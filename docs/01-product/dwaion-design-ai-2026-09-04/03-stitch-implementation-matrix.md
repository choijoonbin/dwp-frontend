# DWAI·ON Stitch 구현 원장

## 목적

이 문서는 Stitch 프로젝트 `13391261371843159731`의 화면을 DWP의 실제 권한, API, 데이터,
감사 계약에 연결하는 구현 정본이다. 시각 구조와 상호작용 의도는 반영하되, 디자인 fixture의
고정 숫자, 제품 버전, `Live`, 성공률, 연결 정상, DLP 통과 같은 문구는 실제 서버 증거가 있을
때만 표시한다.

공통 원칙은 다음과 같다.

- 사용자 화면은 `TENANT / SELF / NORMAL` 범위이며 Provider 또는 SUPPORT 문맥에서 대신
  실행하지 않는다.
- 질문 원문과 업무 본문은 URL, 감사 로그, 실행 목록에 복제하지 않는다.
- 제안 수락, 실행 검토, 원본 앱 초안, 발송·제출 완료는 서로 다른 상태다.
- 자동화는 승인된 읽기와 제안 생성까지만 허용한다. 외부 쓰기는 사용자가 원본 앱에서
  최종 확인한다.
- 모든 변경은 `commandId`, 예상 revision, 목적 또는 사유를 결속하고 동일 요청은 canonical
  receipt를 재생한다.
- 콘텐츠는 DWP2 envelope encryption, 요청 지문은 tenant·purpose 분리 keyed HMAC을 사용한다.
- 카드 반경, 색, 포커스, 간격, 상태 컴포넌트는 DWP design-system 토큰을 사용한다.
- 320/390/768/1440px, 200% 확대, 키보드, 고대비, dark, reduced motion을 수용한다.

## 화면별 구현 매핑

| ID  | 사용자 목적                           | 제품 경로                       | 구현 정본                                          | 서버 정본                                                      | 수용 기준                                                                    |
| --- | ------------------------------------- | ------------------------------- | -------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| U01 | 지금 처리할 업무 확인                 | `/dwaion/home`                  | `dwaion-home*`                                     | 업무 큐, 대화, 제안, Agent, Action                             | 부분 실패와 0건 구분, opaque 질문 전달                                       |
| U02 | 질문 작성과 범위 선택                 | `/dwaion/new`                   | `dwaion-workspace-start`, composer                 | Ask stream                                                     | 최소 1개 소스, 취소 후 초안 보존                                             |
| U03 | 답변·근거·후속 행동                   | 대화 상세                       | workspace answer/context/action shelf              | Conversation, Plan preview                                     | 완료 알림, 근거 회수, 403/503 구분                                           |
| U04 | 이전 대화 탐색                        | `/dwaion/conversations`         | archive list/insights                              | Conversation list/detail                                       | 조회 범위 고지, 삭제 404/409                                                 |
| U05 | 검토할 AI 제안 확인                   | `/dwaion/proposals`             | proposals/list/controls                            | Proposal + analysis                                            | proposal-only, paging, 429/503                                               |
| U06 | 제안 근거와 결정                      | U05 inspector                   | proposal detail                                    | Proposal decision                                              | revision·만료·보류·기각 검증                                                 |
| U07 | 허용된 Agent 선택                     | `/dwaion/agents`                | agents                                             | Runtime registry                                               | 게시와 health 분리, 한계 표시                                                |
| U08 | 실행 입력 검토와 인계                 | `/dwaion/actions` 및 답변 shelf | actions/action shelf                               | Plan preview + handoff                                         | 실제 입력, planHash, 원본 receipt 구분                                       |
| U09 | AI 처리 이력 확인                     | `/dwaion/activity`              | activity 전용 모듈                                 | User runs/activity                                             | 질문 원문 비노출, 실행과 업무 완료 분리                                      |
| U10 | 전역 도움·음성                        | global host/launcher            | assistant 전용 모듈                                | Voice + support routes                                         | 업로드 전 동의, 폐기, 수동 전송                                              |
| X01 | 반복 확인 업무 정의·검증              | `/dwaion/routines`              | `dwaion-routines` + `routines/*`                   | Routine/consent/dry-run 원장                                   | 동의 기본 OFF, `DRY_RUN_ONLY`, 예약 실행·자동 제안·외부 쓰기 비활성          |
| X02 | 개인 AI 데이터 경계 관리              | `/dwaion/personal-controls`     | `dwaion-personal-controls` + `personal-controls/*` | Source preference, explicit memory, retention/deletion request | MEMORY·PRIVACY 권한 독립, opt-out과 삭제 요청 분리, 원본 시스템 불변         |
| X03 | 대화 결과를 검토 가능한 산출물로 편집 | `/dwaion/artifacts`             | `dwaion-artifacts` + `artifact-studio/*`           | Draft/version/reference/preflight/export request               | 직렬 autosave, 불변 version, 최신 preflight, 개인 게시, 내보내기 요청 영수증 |
| A01 | 운영 영향 파악                        | `/dwaion/admin/overview`        | admin overview                                     | Operations overview                                            | 실패를 0으로 표시하지 않음                                                   |
| A02 | Agent 게시·중지 관리                  | `/dwaion/admin/agents`          | admin agents                                       | Registry                                                       | 설정, 게시, health를 분리                                                    |
| A03 | 근거 소스 정책 관리                   | `/dwaion/admin/sources`         | admin sources                                      | Source policy                                                  | `설정됨`과 live connectivity 분리                                            |
| A04 | Action 정책 관리                      | `/dwaion/admin/actions`         | admin actions                                      | Action policy                                                  | 소유 앱·필요 권한·위험·실행 모드 표시                                        |
| A05 | 안전 정책 관리                        | `/dwaion/admin/safety`          | admin safety                                       | Safety policy                                                  | 불변 원칙과 편집 설정 분리                                                   |
| A06 | 품질 평가                             | `/dwaion/admin/evaluation`      | admin evaluation                                   | Evaluation set/run                                             | 표본·분모·조건 없는 정확도 금지                                              |
| A07 | 운영 Gate 승인                        | `/dwaion/admin/gates`           | admin gates                                        | Operational gates                                              | 증거 만료·자기 승인·stale revision 차단                                      |
| A08 | 감사와 보존                           | `/dwaion/admin/audit`           | admin audit/retention                              | Audit + retention                                              | export 상한, legal hold, 권한 분리                                           |

## 신규 데이터 경계

### 개인 루틴

- 루틴, 소스 범위, 사용자 동의, 명령 영수증, 검증 실행, 실행 사건을 분리한다.
- 현재 lifecycle은 `DRAFT`, `PAUSED`, `ARCHIVED`다. 재동의 필요 여부는 lifecycle을 가장하지
  않고 consent 상태와 화면 경고로 별도 표시한다.
- 새 루틴의 `SOURCE_ACCESS`, `AI_ANALYSIS`, `PROPOSAL_DELIVERY` 동의는 모두 기본 OFF이며
  명시적 동의 없이는 저장할 수 없다.
- 현재 실행 모드는 `DRY_RUN_ONLY`다. 일정 문자열과 다음 실행 시각은 미리보기일 뿐 실제
  scheduler, 백그라운드 위임 토큰, 자동 제안 전송, 알림, 외부 쓰기를 실행하지 않는다.
- 브라우저 세션이나 bearer token을 저장하지 않고, 권한·tenant·user·session 경계를 매
  명령에서 다시 검증한다.

### 개인 AI 제어

- 소스별 참조 허용, 명시적 메모리, 보존 정책 조회, 삭제 요청을 각각 분리한다.
- 메모리는 사용자가 직접 입력한 선호만 저장하며 추론한 민감 속성은 금지한다.
- 개인 메모리와 개인정보 제어는 각각 `APP.DWAION_MEMORY`, `APP.DWAION_PRIVACY` 권한으로
  독립 접근한다. 개인정보 권한만 위임된 사용자도 메모리 내용을 노출하지 않은 채 보존·삭제
  요청을 사용할 수 있다.
- 저장된 선호와 명시적 메모리를 답변 생성에 자동 적용하는 runtime은 아직 연결되지 않았다.
  화면은 이 제한을 항상 표시한다.
- AI 캐시 삭제는 Mail, Calendar, Approval 등 원본 업무 레코드를 삭제하지 않는다.
- 삭제는 실행 완료가 아니라 삭제 작업 요청 영수증을 생성한다. legal hold, 실행기 미연결,
  부분 실패가 있으면 `완료` 대신 실제 상태와 차단 범위를 표시한다.

### 결과물 스튜디오

- mutable draft와 immutable version을 분리한다.
- source는 본문 복제가 아니라 현재 사용자가 다시 권한 검사할 수 있는 reference로 저장한다.
- autosave는 `expectedDraftRevision`으로 충돌을 반환하고, 과거 버전 복원은 새 버전을 만든다.
- 개인 게시 상태 전환과 내보내기 요청은 최신 artifact revision에 결속된 preflight가 없거나
  서버 판정이 차단이면 수행하지 않는다. 편집 후에는 기존 preflight를 즉시 무효화한다.
- 현재 preflight는 결정적 로컬 정책 검사다. connector 기반 원본 진위·최신성 검증이나 조직
  DLP 연동 완료를 주장하지 않는다.
- 수신자 공유, 익명 링크, 원본 시스템 쓰기는 제공하지 않는다. 내보내기는 파일 다운로드가
  아니라 비동기 실행기 연결 전의 요청 영수증만 반환한다.

## 적용된 권한과 데이터 원장

- Auth migration `V210__authorize_dwaion_personal_intelligence.sql`이
  `APP.DWAION_ROUTINES`, `APP.DWAION_MEMORY`, `APP.DWAION_PRIVACY`,
  `APP.DWAION_ARTIFACTS`와 `ai.agent-runtime` entitlement를 등록한다.
- Agent migration `V23`은 도메인 보존 정책, 삭제 작업·대상·사건, transactional outbox를
  만든다.
- `V24`, `V29`는 개인 루틴·소스·명령·동의·검증 실행·사건과 동의 정합성 제약을 만든다.
- `V25`, `V28`은 메모리 preference·명시적 memory·명령·사건과 소스별 preference를 만든다.
- `V26`, `V28`, `V30`은 artifact, mutable draft, draft reference, immutable version·reference,
  preflight, export request, command/event 원장과 append-only 증거 제약을 만든다.
- 개인 콘텐츠는 DWP2 envelope encryption을 사용하고, 감사·명령 원장은 tenant/user/purpose,
  command id, expected revision에 결속한다.

## 출고 Gate

1. 신규 API 단위·권한·멱등·동시성·암호화·실 PostgreSQL migration 검증.
2. OpenAPI runtime snapshot과 frontend generated contract 단일 동기화.
3. 화면 단위 Vitest, lint, non-incremental typecheck, production build와 bundle budget.
4. 대표 여정 E2E: 루틴 조회 → dry-run → 동의 기본 OFF, 개인 AI 경계 → 삭제 요청,
   draft → 직렬 autosave → stale preflight 무효화 → 개인 게시·내보내기 요청 차단.
5. cross-tenant, cross-user, session drift, SUPPORT, stale authority, duplicate command를 각각 거부.
6. X01~X03의 desktop/mobile visual baseline과 320/390/768px, 200% text, dark,
   forced-colors, reduced-motion의 overflow·텍스트 잘림·serious/critical axe 회귀.

## 최종 검증 증거 (2026-09-04)

| 검증 범위                                  | 결과                                                                                                                    |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Agent 전체 PostgreSQL suite                | `352 passed, 23 skipped`; clean scratch DB에서 `V1`~`V30` 적용 후 DB 삭제                                               |
| Agent 정적 계약                            | `compileall`, OpenAPI runtime snapshot, 500줄 source-size architecture `PASS`                                           |
| Auth 권한 migration                        | `V210` 단위·PostgreSQL migration 테스트 `2 passed`                                                                      |
| Frontend 전체 단위 테스트                  | `426 files`, `2,834 tests passed`                                                                                       |
| DWAI·ON 변경 집중 단위 테스트              | `30 passed`                                                                                                             |
| X01~X03 기능·권한·반응형 E2E               | `22 passed`                                                                                                             |
| X01~X03 visual baseline                    | desktop/mobile `6 passed`                                                                                               |
| 최종 통합 화면 재검증                      | 홈·새 대화·내 대화·X01~X03의 desktop/mobile, dark, forced-colors, 200% text `62 passed`; fresh capture 육안 비교 `PASS` |
| 최종 브라우저 기능 수용                    | 브리핑·음성·활동·제안·런처·루틴·개인 제어·아티팩트의 Chromium/mobile `90 passed`; 모바일 상세 drawer 동작 회귀 보강     |
| 홈·새 대화·내 대화·활동·전역 런처 전체 E2E | Chromium/mobile `102 passed`                                                                                            |
| 전역 런처 edge 회귀                        | 320/390/768px·200%·홈/Activity/Apps `18 passed`                                                                         |
| Frontend 정적 Gate                         | Node 24 기준 typecheck, lint, format, architecture, OpenAPI `PASS`                                                      |
| Frontend production build                  | initial raw `1058.3/1074.2 KiB`, gzip `308.6/317.4 KiB`, request `5/5`; 전체 bundle budget `PASS`                       |

아키텍처 검사 기준 내부 exact product contract는 `12/12`, owner-service PEP cell은 `60/60`으로
완료되었고 내부 증거 미완료는 0건이다. 다만 production owner approval, managed KMS 운영 증거 등
코드가 생성할 수 없는 release evidence 37건은 의도적으로 `BLOCKED`다. 이 상태를 제품 기능의
성공 또는 운영 활성으로 치환하지 않는다.

운영 managed KMS, background scheduler와 delegated-token exchange, 실제 connector source verifier,
조직 DLP, 외부 파일 export worker, 물리 삭제 실행기와 승인 증거가 구성되지 않은 환경에서는 관련
상태를 활성으로 표시하지 않는다. 이는 미완료를 숨기는 조건이 아니라 안전하게 출시 범위를 구분하는
계약이다. Stitch의 시각 의도는 실제 기능에 100% 매핑하되, 존재하지 않는 운영 능력과 성공 상태는
시각적으로 복제하지 않는다.
