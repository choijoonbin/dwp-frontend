# HRIS G0 통합 cadence 및 복구 계약

## 단일 통합 원칙

`ROLE.INTEGRATION_CONTROL`만 integration branch, 중앙 파일, master coverage, migration allocation을 병합한다. 모듈 세션은 자신의 branch와 할당된 경로에서만 작업하며 공유 계약 변경은 proposal ID로 제출한다. 병합은 한 번에 하나의 checkpoint만 처리하고 의존 계약의 위상 순서를 지킨다.

한 파일이 둘 이상의 소유권 규칙에 걸리면 숫자가 가장 큰 `precedence` 규칙 하나만 적용한다. 같은 최고 우선순위에서 writer 또는 reviewer가 다른 규칙이 겹치면 변경을 시작하지 않고 Integration Control이 레지스트리를 먼저 수정한다. `DEFAULT_DENY`는 다른 허용 규칙이 없는 경우의 최종 fail-closed 규칙이다.

같은 host에서 frontend full suite·build·security audit·SBOM과 module checkpoint command capture는 `host_semaphore.py`의 공통 exclusive lock key `hris-verification` 실행 경계로 직렬화한다. 모듈 세션은 자기 HRIS feature 경로의 bounded test만 `--maxWorkers=2 --maxConcurrency=1`로 병렬 실행하고, Integration Control checkpoint가 전체 `yarn test --maxWorkers=4 --maxConcurrency=2`와 build를 정확히 한 번 실행한다. 자원 경합 실패를 성공으로 바꾸는 retry는 금지하며, 실패한 개별 test의 단독 재현은 진단 증거일 뿐 중앙 full-suite PASS를 대체하지 않는다.

## Cadence

| 시점 | 제출/실행 | 통과 조건 |
|---|---|---|
| 모든 push | changed-path ownership, 신규 파일 allocation, source mode, migration 번호, targeted compile/unit/contract 검사 | 미할당·중앙 파일 직접수정·source copy·migration 충돌 0 |
| 매 checkpoint | `checkpoint-register.csv` 형식의 evidence bundle | base/head, 변경 경로 digest, coverage 변화, 명령·결과·blocker가 모두 있음 |
| checkpoint 최대 간격 | 1 업무일 | 미제출 세션은 다음 병합 대상에서 제외 |
| 일일 integration window | 승인된 checkpoint를 의존순으로 1건씩 병합하고 master coverage 갱신 | duplicate/orphan 0, raw coverage floor 2,269 유지 |
| nightly | `build-matrix.csv`의 NIGHTLY 행 | backend/frontend full suite green |
| 공유 계약·Gate 요청 | 영향 소비자 contract, authorization, tenant-negative, migration, compatibility 검사 | 필요한 RACI의 단일 A가 승인하고 evidence URI가 기록됨 |

시간대나 실제 merge window가 바뀌어도 위 최소 빈도는 낮출 수 없다. 회의 참석을 완료 증거로 사용하지 않으며 자동 명령 결과와 decision record를 사용한다.

## Checkpoint 상태기계

`DRAFT → CHECKPOINT_READY → VALIDATED → APPROVED → MERGED → VERIFIED`

- 검증 실패는 `REWORK`로 이동한다.
- 외부 증거·결정이 없으면 `BLOCKED`로 이동한다.
- `BLOCKED`나 `REWORK`를 `MERGED`로 건너뛸 수 없다.
- 파일 수나 화면 수를 진척률로 사용하지 않는다.

## 공유 계약 변경

OpenAPI, AsyncAPI/event, product authorization, gateway, route/navigation, 공통 타입, schema registry 변경은 proposal에 다음을 포함한다.

- 변경 전후 schema와 version
- producer/consumer와 owner
- backward compatibility 및 deprecation 기간
- contract test와 negative test
- 데이터 분류·권한·tenant 영향
- migration/rollback이 아니라 forward-correction 계획

Breaking change는 기존 소비자가 모두 전환되기 전에 병합하지 않는다.

## 실패 및 복구

1. integration build가 red가 되면 후속 merge를 즉시 정지한다.
2. 마지막으로 병합한 checkpoint와 failing command를 연결한다.
3. 아직 배포되지 않은 코드 실패는 offending merge commit을 `git revert`하여 마지막 green commit으로 복원한다. 공유 이력 reset/rebase와 사용자 변경 삭제는 금지한다.
4. 적용된 Flyway migration은 수정·삭제하지 않는다. 새 번호를 할당한 forward correction으로 복구한다.
5. async 작업은 receipt·idempotency key·checkpoint·DLQ/replay 위치를 보존한다.
6. 복구 후 동일 full suite와 영향 contract/tenant-negative/golden test를 재실행한다.
7. 원인, 영향, 복구 commit, 재발방지와 미처리 항목을 checkpoint evidence에 남긴다.

## Coverage 병합

- 모듈 shard는 해당 모듈의 단일 writer만 수정한다.
- master는 `ROLE.INTEGRATION_CONTROL`만 갱신한다.
- raw 기준은 HRM 583, PER 349, PAY 580, TIM 568, SYS 189, 합계 2,269다.
- 추가 child trace는 raw 행의 parent key를 반드시 가진다.
- 행을 통합·폐기해도 삭제하지 않고 disposition·근거·decision owner를 유지한다.
- `UNKNOWN`은 누락이 아니라 명시 상태지만, owner·필요 증거·기한·차단 범위가 없으면 Gate 실패다.

## 승인 경계

사용자가 승인한 제품 방향과 stable operational role binding은 sealed G2 계약에 따른 **G3 범용 core engineering**을 승인할 수 있다. 단 authoritative live validator, named `G3-CODE-GO-*` token, slice touch manifest와 checkpoint evidence를 모두 통과해야 하며, SKKF source reuse 권리나 운영 승인을 부여하지 않는다. 실제 고객 설정·법정값·연계 endpoint/secret·production 활성화는 실명 책임자와 delegate ACK 및 G6 evidence가 있어야 한다. 침묵이나 SLA 초과는 어떤 Gate에서도 승인이 아니다.
