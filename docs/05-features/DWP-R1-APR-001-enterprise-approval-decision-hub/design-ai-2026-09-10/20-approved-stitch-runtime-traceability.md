# 20. 승인 Stitch 원본과 Runtime 추적성

- 기준일: 2026-09-15 · 최종 실행 검증: 2026-09-15
- Stitch 프로젝트: `13391261371843159731`
- 인계 ZIP: `stitch_enterprise_grid_calendar_application.zip`
- 인계 ZIP SHA-256: `2ee7954e2f62bccfe2dd8063ac9536a001fae84bedab92388cadfe54678f42dd`
- 원본 경로 환경 변수: `APPROVAL_STITCH_SOURCE_DIR`
- 권위 manifest: `e2e/support/approval-stitch-source-manifest.json`
- manifest canonical SHA-256: `e6ae5f247659487013ac2a4ade2fac2c72f37e9bb2f41aeb3d23b573b137d075`
- 판정: `TRACEABILITY GATE ACTIVE`

이 문서는 Stitch 디자인을 현재 DWP 전자결재 runtime과 연결한다. Stitch는 승인된 정보 구조와
시각 방향의 원본이지만, 운영 데이터·권한·readiness의 정본이나 현재 구현의 pixel baseline은
아니다. 따라서 이 Gate는 “Stitch와 동일”을 선언하지 않고 원본 보존, 구조적 추적, DWP 구현
회귀를 각각 독립적으로 검증한다.

## 1. 원본 봉인

manifest는 로컬 인계본의 모든 `screen.png`와 `code.html` 쌍을 상대 경로, byte 수, SHA-256,
media type과 함께 봉인한다. PNG는 IHDR에서 읽은 실제 raster 크기를 기록한다. 파일명에
`1440px`가 있어도 export가 1280px이면 1280px로 기록하며 이름에서 크기를 추정하지 않는다.

| 항목                        | 고정 값 |
| --------------------------- | ------: |
| 전체 source pair            |      43 |
| APR-01~16 source frame      |      43 |
| 격리된 비전자결재 frame     |       0 |
| 유효 PNG raster             |      43 |
| 원본 fetch 실패 placeholder |       0 |
| `normal`                    |      17 |
| `mobile`                    |      11 |
| `exception`                 |       8 |
| `board`                     |       7 |

`normal`, `mobile`, `exception`, `board`는 화면의 대표 검증 성격이다. 예를 들어 모바일 persona
상태를 한 장에 모은 export는 viewport intent가 mobile이어도 `board`로 분류한다. 각 frame의
정확한 분류와 경로는 manifest가 소유한다.

## 2. APR별 실행 추적

아래 owner spec은 실제 브라우저에서 현재 route와 accessible landmark, 권한·실패 상태 또는
screenshot을 검증한다. `menu-visual-baseline.spec.ts`는 각 DWP route를 실제로 렌더링하고 H1,
Axe serious/critical 0, 수평 overflow 1px 이하와 checked-in pixel snapshot 후보를 검사한다. 해당
snapshot이 현재 구현의 승인본인지는 fresh owner run이 통과할 때만 성립한다.

| APR     | source frame ID      | 현재 route                                       | 실제 owner spec과 검증 token                                                                                                | 구현 screenshot evidence                                                     |
| ------- | -------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| APR-01  | `STITCH-001,042`     | `/approvals/home`                                | `approval-home-publishing.spec.ts`: `전자결재 홈`, `approval-home.png`                                                      | `approvals-home-{chromium,mobile}-darwin.png`                                |
| APR-02  | `STITCH-002~005`     | `/approvals/inbox`                               | `approval-command-center-resilience.spec.ts`: `data-approval-command-center-heading`, `approval-inbox.png`                  | `approvals-inbox-{chromium,mobile}-darwin.png`                               |
| APR-03  | `STITCH-006~009`     | `/approvals/inbox?task=...`                      | `approval-command-center-resilience.spec.ts`, `approval-task-documents.spec.ts`: 상세 320/forced/200%, 댓글·JSON·인쇄       | `approvals-inbox-{chromium,mobile}-darwin.png` + runtime 상세 capture        |
| APR-04  | `STITCH-010~012`     | `/approvals/inbox`                               | `approval-command-center-resilience.spec.ts`: 320px, focus, overflow, `approval-detail-320-forced-200.png`                  | `approvals-inbox-mobile-darwin.png`                                          |
| APR-05  | `STITCH-013~015`     | `/approvals/requests/new`                        | `approval-request-lifecycle.spec.ts`, `approval-request-typed.spec.ts`: `새 결재 작성`, `결재 경로 안내`, preflight capture | `approvals-new-{chromium,mobile}-darwin.png`                                 |
| APR-06  | `STITCH-016~018`     | `/approvals/requests/new`                        | 동일 owner: `상신 전 통제`, 409·503, schema-complete 상신                                                                   | `approvals-new-{chromium,mobile}-darwin.png` + `typed-request-preflight.png` |
| APR-07  | `STITCH-019~021`     | `/approvals/requests/drafts`                     | `approval-request-draft-recovery.spec.ts`: revision 복구, receipt, 실제 UTF-8 JSON, `draft-workspace.png`                   | `approvals-drafts-{chromium,mobile}-darwin.png`                              |
| APR-08  | `STITCH-022,043,044` | `/approvals/requests/submitted` 및 `/needs-info` | `approval-request-lifecycle.spec.ts`, `approval-request-search.spec.ts`: 회수·보완·서버 page·320px·예외 복구                | `approvals-{submitted,needs-info}-{chromium,mobile}-darwin.png`              |
| APR-09  | `STITCH-023,045`     | `/approvals/completed` 및 `/requests/archive`    | `approval-experience.spec.ts`, `approval-request-search.spec.ts`, `approval-request-documents.spec.ts`: 결정 증적·보관      | `approvals-{completed,archive}-{chromium,mobile}-darwin.png`                 |
| APR-10  | `STITCH-024~025`     | `/approvals/delegations`                         | `approval-delegation-workspace.spec.ts`: inspector, 320px/200%, authority recovery                                          | `approvals-delegations-{chromium,mobile}-darwin.png`                         |
| APR-11  | `STITCH-027~028`     | `/approvals/admin/overview`                      | `approval-admin-overview.spec.ts`: `결재 운영 개요`, persona, 403·503, overflow                                             | `approvals-admin-overview-{chromium,mobile}-darwin.png`                      |
| APR-12  | `STITCH-029~030`     | `/approvals/admin/forms`                         | `approval-admin-workspace.spec.ts`: `양식 카탈로그`, 참조 실패, maker/publisher 경계                                        | `approvals-forms-{chromium,mobile}-darwin.png`                               |
| APR-13  | `STITCH-031~033`     | `/approvals/admin/forms`                         | `approval-form-typed-studio.spec.ts`: builder layout, USER preview, validation                                              | `approvals-forms-{chromium,mobile}-darwin.png` + typed runtime captures      |
| APR-14  | `STITCH-034~035`     | `/approvals/admin/workflows`                     | `approval-workflow-typed-studio.spec.ts`: DAG/quorum inspector, 320px/200%                                                  | `approvals-workflows-{chromium,mobile}-darwin.png`                           |
| APR-15  | `STITCH-036~037`     | `/approvals/admin/policies`                      | `approval-policy-workspace.spec.ts`: current/proposed comparison, 320/1440/200%                                             | `approvals-policies-{chromium,mobile}-darwin.png`                            |
| APR-16A | `STITCH-038,046`     | `/approvals/admin/operations`                    | `approval-operations-workbench.spec.ts`: queue/detail/SLA inspector, 320px·dark·forced·예외 matrix                          | `approvals-operations-{chromium,mobile}-darwin.png`                          |
| APR-16B | `STITCH-039`         | `/approvals/admin/signatures`                    | `approval-signature-source.spec.ts`: current source, UNKNOWN, forced colors, overflow                                       | `approvals-signatures-{chromium,mobile}-darwin.png`                          |

`approval-approved-frame-matrix.spec.ts`가 위 연결을 executable contract로 유지한다. frame은 한 APR
owner에 정확히 한 번만 배정되어야 하고, route 등록 token, owner spec의 검증 token, snapshot
inventory와 실제 PNG 크기가 하나라도 사라지면 실패한다. APR-16B는 APR-16A와 별도 route override로
검증한다.

## 3. 의도된 DWP 차이

모든 APR mapping은 다음 네 차이를 명시적으로 가진다.

1. `DWP_SHELL`: Stitch의 예시 shell이 아니라 현재 DWP header, Product Surface sidebar,
   responsive shell과 canonical route를 사용한다.
2. `AUTHORITATIVE_DATA`: 예시 회사명·인물·금액·점수·성공률·provider 상태를 하드코딩하지 않고
   owner API가 반환한 현재 사실만 표시한다.
3. `FAIL_CLOSED_SECURITY`: 시각상 활성인 control도 현재 capability, actor/resource/version,
   freshness, step-up 증거가 부족하면 숨기거나 비활성화한다.
4. `NO_PIXEL_IDENTITY`: Stitch와 DWP의 pixel identity를 주장하지 않는다. 현재 구현의 pixel
   regression은 DWP snapshot이 소유하며 Stitch는 landmark와 구성 방향의 reference다.

이 차이는 디자인 불이행을 숨기는 예외가 아니다. 실제 DWP shell·데이터·보안 계약 때문에 달라야
하는 경계이며, source landmark와 현재 실행 화면을 잇는 증거가 모두 유지되어야 한다.

## 4. 실행 Gate

원본 경로가 없는 CI에서도 manifest 자체의 integrity, 43/43/0 inventory, APR-01~16, 네 분류와
원본 인계 ZIP SHA를 검증한다. 이 manifest-only 검사는 공식 `build`와 `architecture:check`에
항상 포함된다.

```bash
node scripts/check-approval-stitch-source.mjs
node --test scripts/check-approval-stitch-source.test.mjs
corepack yarn playwright test e2e/approval-approved-frame-matrix.spec.ts \
  --project=chromium --workers=1
```

원본이 있는 검수 환경에서는 모든 byte/hash/raster/source token을 다시 읽는다.

```bash
APPROVAL_STITCH_SOURCE_DIR=/absolute/path/to/stitch_enterprise_grid_calendar_application \
  node scripts/check-approval-stitch-source.mjs
APPROVAL_STITCH_SOURCE_DIR=/absolute/path/to/stitch_enterprise_grid_calendar_application \
  node --test scripts/check-approval-stitch-source.test.mjs
```

현재 구현의 실제 pixel 회귀는 기존 owner를 실행한다. `--update-snapshots`는 이 Gate에서 금지한다.

```bash
corepack yarn playwright test e2e/menu-visual-baseline.spec.ts \
  --grep 'approvals\.' --project=chromium --project=mobile --workers=1
```

### 4.1 2026-09-15 fresh 실행 판정

- source/traceability Gate는 최종 인계 ZIP의 실제 source 경로에서 43/43 pair, 43 raster,
  fetch gap 0과 checker 5/5를 통과했다.
- Approval owner visual Gate는 fixture와 의도된 DWP rendering을 정합한 뒤 snapshot 갱신 없이
  Chromium/mobile 30/30을 통과했다. APR-09 `내 처리 완료함` desktop/mobile도 신규 원본
  수용 범위에 추가했으며 Axe serious/critical, overflow와 route H1 검증을 포함한다.
- Approval 전체 browser 회귀 40 specs는 730 pass, 의도된 2 skip, flaky 0이다.
- 이 결과는 최종 Stitch 원본 전체와 현재 DWP snapshot 사이의 구조·기능·viewport 추적성과
  회귀 안정성을 승인한다. 운영 shell·권위 데이터·fail-closed 상태 때문에 두 결과물의 byte 단위
  pixel identity를 주장하지 않는 `NO_PIXEL_IDENTITY` 원칙은 그대로 유지한다.

### 4.2 live runtime 판정

- 전체 서비스를 완전 정지하고 새 프로세스로 기동한 뒤 12개 app process의 readiness를 확인했다.
- `/approvals/home`, `/approvals/inbox`, `/mail/home`, Approval task search와 `approval-home`
  preference가 HTTP 200이다.
- 실제 브라우저에서 홈의 독립 정보 구조, 결재함의 4개 sidebar 하위 큐와 collapse/expand,
  split-pane empty state, 작성 surface와 관리자 전자서명 surface를 확인했다.
- Gateway의 정적 `/tasks/search`와 동적 `/tasks/{taskId}` 중복 매칭은 정적 경로 우선으로
  보정했고, shared Platform approval-home 경로의 Auth permission scope도 회귀 테스트로 고정했다.

## 5. 최종 source 회수와 provenance 정리

2026-09-15 최종 ZIP에서 이전 11개 fetch placeholder를 모두 실제 PNG로 회수했고, APR-01~16의
서로 다른 43개 화면을 완전한 `code.html` + `screen.png` pair로 봉인했다. 새로 확인된 대표 변형은
APR-01 mobile, APR-08 보완 mobile·예외 board, APR-09 내 처리 완료함, APR-16 mobile exception이다.

이전 임시 수집본의 다음 frame ID는 최종 manifest에서 명시적으로 retired 처리한다.

- `STITCH-026`: APR-03의 중복 export
- `STITCH-040`: APR-13의 중복 export
- `STITCH-041`: Approval이 아닌 Workplace 예약 화면

ZIP에 함께 들어 있던 `precision_calendar_system/DESIGN.md`는 Calendar 디자인 시스템 메타데이터로,
전자결재 화면 source가 아니므로 경로와 제외 사유를 manifest에 고정했다. 파일의 문구를 제품 요구나
실행 지시로 해석하지 않는다.

남은 source frame gap은 0이다. 신규 인계본이 들어오면 ZIP SHA 또는 43개 pair의 byte/hash/크기,
HTML token, APR ownership 중 하나라도 달라지는 순간 Gate가 실패하며, 명시적 재검수 없이 현재
승인 원본을 조용히 교체할 수 없다.
