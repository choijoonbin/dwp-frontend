# HRIS G1 통합 Lock 작업 패킷

> Packet ID: `HRIS-G1-INTEGRATION-LOCK-20261006-R1`
>
> 상태: `APPROVED_FOR_G2_INTEGRATION_ONLY`
>
> 권한 경계: 모듈 개발·고객 활성화·Production 배포 권한 없음

## 1. 목표와 단일 Writer

현재 `dwp-dev`를 Canonical Lineage로 유지하면서 Reconciled HRIS 기능을 의미 단위로 반입한다.
SYS/Common Integration Control이 공통 Authorization, OpenAPI, Migration과 생성 파일의 유일한
Writer다. Reconciled Branch는 immutable 입력이며 `ours`/`theirs` 일괄 선택을 금지한다.

## 2. 잠긴 입력과 Worktree

| 구분 | Branch | Commit | Worktree |
| --- | --- | --- | --- |
| Frontend Base | `codex/hris-g1-integration-frontend-20261006` | `08a05f764a7c6dec38cce2627b81bcb8ef87ee6c` | `.codex-worktrees/hris/g1-integration-20261006/frontend` |
| Frontend Reconciled | `codex/hris-reconciled-frontend-20261001` | `7f39d12cd10b8827c67355a7f445973d05373cc9` | `.codex-worktrees/hris/reconciled-20261001/frontend` |
| Backend Base | `codex/hris-g1-integration-backend-20261006` | `5612cc1a0b4a21a4d0b9107739579f23d165790f` | `.codex-worktrees/hris/g1-integration-20261006/backend` |
| Backend Reconciled | `codex/hris-reconciled-backend-20261001` | `0731f6df2d55cdeb4784a09ae6e28d4ae4b0c294` | `.codex-worktrees/hris/reconciled-20261001/backend` |
| Agent | `dwp-dev` 동결 | `1d46fc4ab49c604efb7464574c49d13ee453e059` | 이번 통합에서 변경하지 않음 |

두 새 Integration Branch는 원격에 게시되어 있으며 Base Commit과 정확히 일치한다. Pin, Upstream,
Clean 상태 중 하나라도 달라지면 이 패킷을 중단하고 Revision을 발급한다.

## 3. 충돌·보존 결정

[G1 Conflict Manifest](2026-10-06-g1-conflict-manifest.json)는 checkout을 변경하지 않는
`git merge-tree --write-tree` 결과와 양쪽 변경 경로 교집합을 고정한다.

| 저장소 | 양쪽 변경 검토 경로 | 실제 Text Conflict | 주요 Cluster |
| --- | ---: | ---: | --- |
| Frontend | 56 | 27 | Authorization 7, Assignment 4, Home/Shell 4, i18n 2, Visual 10 |
| Backend | 54 | 39 | Authorization 26, People 8, Gateway 3, OpenAPI 1, Platform/Home 1 |

Text conflict가 없어도 양쪽에서 변경된 110개 경로는 모두 explicit disposition 대상이다.
현재 Home/Admin/Assignment와 Visible Product Identity `HRIS`를 보존한다. 특히 현재 Home 번역은
`home.json`의 이름·축약명이 이미 `HRIS`이고 전용 identity test가 있으므로 Reconciled 값으로
되돌리지 않는다.

생성 파일은 직접 해결하지 않는다. Backend Canonical Source 결정 후 Authorization, OpenAPI,
Fixture와 Frontend Projection을 정확히 한 번 생성한다.

## 4. Migration 결정

[Migration Admission 및 Lease](2026-10-06-g1-migration-admission-and-lease.json)를 따른다.

- Auth `V242` 단일 Lease를 Payroll `SIMULATE/PUBLISH/REVERSE/RECONCILE` 효과 이식에 발급했다.
- Authorization successor seed `V243`은 미발급이다. G2 의미 Diff가 있을 때만 발급한다.
- Reconciled Auth `V234_1`과 현재 `V239`, Reconciled Platform `V320`과 현재 `V321`은 각각
  byte-identical이므로 중복 반입하지 않는다.
- People `V49..V52`, PAY `V1..V5`, TIM `V1..V7`은 해당 Owner DB의 immutable 입력이다.
- People `V53`이 선행 적용된 환경이 발견되면 통합을 중단하고 forward-only 보정을 설계한다.

## 5. Authorization Successor 결정

Reconciled v33의 route, capability, access policy, predicate와 entitlement expression은 현재 v34의
부분집합이다. 따라서 통합 표시만을 위한 v35는 만들지 않는다.

1. G2에서 Canonical Semantic Source를 합친다.
2. 현재 v34와 구조화된 의미 Diff를 계산한다.
3. Diff가 비어 있고 generator 출력도 byte-identical이면 v34를 유지한다.
4. Diff가 있을 때만 v35와 Auth `V243` Lease를 발급하고 Default-OFF successor를 생성한다.

## 6. G2 허용 범위와 순서

1. Backend Reconciled 변경을 conflict cluster별로 펼치되 Commit하지 않는다.
2. Authorization/Migration, People/Assignment, Gateway/OpenAPI, PAY/TIM owner runtime 순으로
   disposition을 기록한다.
3. 각 cluster의 실패를 한 번에 수집하고 영향 Test만 실행한다.
4. 현재 v32·v33·v34 bytes를 변경하지 않는다.
5. 생성 계약은 의미 결정 완료 후 한 번만 생성한다.
6. Backend Contract가 고정된 뒤 Frontend cluster를 해결한다.

## 7. 복구 정본 경계

역사 raw recovery는 증거로 보존한다. 부분복구 파일을 완전본으로 오인하지 않으며, sealed SYS
business-start checkpoint 검증에는 exact supplement만 같은 경로의 raw partial보다 우선한다.
G1 current-state overlay는 그 역사 입력 위에 현재/Reconciled disposition을 제공할 뿐 checkpoint
자체의 정본은 아니다. Supplement는 시작 pin과 pin 이후 accepted successor를 분리한다. HRM API/Event·source coverage
역사본과 final exact 복원이 끝나지 않은 ownership/modern 상세 계약은 현재/Reconciled Code에서
successor를 발행하기 전까지 G7 모듈 위임을 차단한다.

## 8. 중단 조건

- Base/Reconciled Pin 또는 Worktree가 drift/dirty 상태
- Conflict Manifest에 없는 공통 경로 변경
- Lease 밖 Migration 생성 또는 기존 Migration 수정
- People V53 선행 적용 이력
- Backend와 Frontend Contract Projection 불일치
- 102-slice current overlay 또는 critical recovery disposition의 미승인
- 고객 정책·고객 데이터·외부 Connector 결정 필요

## 9. 완료 증거

G1 완료는 코드 병합이 아니라 다음 Lock Artifact가 SHA로 봉인된 상태다.

- Integration Worktree/원격 Branch 2개
- Source Pin과 Worktree Receipt
- Conflict Manifest와 Cluster/Test Mapping
- 102-row Current Slice Integration Overlay
- Critical Recovery Gap Disposition
- Migration Admission/Lease
- 이 G1 Work Packet과 G1 Receipt

완료 판정과 산출물 digest는
[G1 Integration Lock Receipt](2026-10-06-g1-integration-lock-receipt.json)에 고정한다.

다음 단계는 G2 Backend 의미 통합이다. 전체 Runtime/W1은 실행하지 않으며, G2에서는 영향을 받은
cluster test만 수행한다.
