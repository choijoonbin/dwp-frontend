# Frontend current integration 최종 readiness 검증

판정: **HRIS 범위 검증 PASS / 전체 frontend integration FAIL-CLOSED / START-P0·Gate CLOSED**

프런트 integration `4e1333c66dfd9563ecbf321cfcda3b3f6b7f9778`(tree `27390487173ba41640e01f69704740f38f0da8e0`)에서 HRM·PER·TIM·PAY·shell/shared·HTTP·i18n·route와 타입·scoped lint·API-SoR·layer 검사는 통과했다. 그러나 전체 저장소에는 Approval 기준선 2건, Approval/shared HTTP 호환 계약 1건, Approval unreachable module 13개, IA BASE digest 76개 drift, 미동결 backend provenance가 남아 있다. 따라서 모듈 결함이 없다는 사실을 전체 통합 READY로 확대하지 않는다.

## Revision·merge 판정

- integration branch: `codex/hris-integration-frontend-20260909`; 검사 전후 clean, HEAD/tree 불변
- local `dwp-dev` = remote `origin/dwp-dev` = `495b6192605545587685b08fd3c4c716078048e2`
- `495b619`은 integration HEAD의 조상이며 과업 기준점과 동일하다. 새 upstream 변경이 없으므로 **merge하지 않았다**.
- branch 자체 configured upstream은 없다. 이 검사는 명시적 `dwp-dev`/`origin/dwp-dev` 비교를 썼다.
- 사용자 main frontend는 같은 `495b619` 위에 61개 porcelain entry(추적 34, 미추적 27)가 있는 dirty 상태다. 내용 복사·해결책 참조·정리·수정 없이 git status와 blob 관계만 read-only 확인했다.
- backend integration은 관찰 시점 `b01bd03066f4e249c3463e89ba1a64e4a33146f6` / tree `99380e236d119c071ae18cad9ec36c0614c961e2`, dirty 1,007 entries였다. 진행 중 revision이므로 공식 provenance는 **PENDING**이며 갱신하지 않았다.

## API-SoR와 계층 검증

Root가 갱신한 현재 canonical source는 다음 세 경로다.

- TIM: `apps/dwp/src/features/hris/time/api/hris-time-api.ts#readHrisTimeWorkspace`
- PAY: `apps/dwp/src/features/hris/payroll/api/payroll-api.ts#getHrisPayrollWorkspace`
- PER: `apps/dwp/src/features/hris/performance/api/performance-talent-api.ts#getScopedPerformanceTalent`

실행 결과:

- `python3 coding-readiness/validate_hris_api_sor_transitions.py --compact`: 23 transitions, 14 read variants, 9 mutations, 23 source operations, error 0 — PASS
- 같은 validator `--self-test --compact`: silent fallback·dual read/write·잘못된 primary slice·새 legacy callsite 등을 포함한 **18/18 고의 변조 차단** — PASS
- `node --test --test-reporter=tap scripts/verification/hris-layer-contract-v1.test.mjs`: **44/44 PASS**, fail/cancel/skip/todo 0
- layer actual scan: source 2,458, classified 60, layered 54, unclassified 0, structural PASS, error 0. `readinessPass=false`와 `g3StartAuthorized=false`는 이 validator가 Gate를 열지 않는 fail-safe 경계다.

재실행 pin은 JSON에 기록했다. 핵심 SHA-256은 API-SoR register `d76e81f8...`, validator `805f3bdf...`, layer validator `cbc0db0d...`, layer unit `68806958...`, structure register `52937682...`이다.

## Targeted frontend 결과

공통 명령은 `node node_modules/vitest/vitest.mjs run --reporter=json --maxWorkers=4 --maxConcurrency=2`이고 각 경로 인자는 동반 JSON에 완전 기록했다.

| 범위 | 결과 파일 | tests | pass | fail |
|---|---:|---:|---:|---:|
| HRM | 2 | 22 | 22 | 0 |
| PER | 3 | 62 | 62 | 0 |
| TIM | 3 | 43 | 43 | 0 |
| PAY | 3 | 59 | 59 | 0 |
| shell/shared | 5 | 20 | 20 | 0 |
| HTTP | 3 | 57 | 57 | 0 |
| i18n | 7 | 58 | 58 | 0 |
| routes | 27 | 269 | 269 | 0 |
| contracts | 110 | 1,391 | 1,390 | 1 |
| 합계 | **163** | **1,981** | **1,980** | **1** |

contracts의 단일 실패는 Approval `product-action-disclosure-contracts.test.ts:183`이다. 한 파일만 별도 재실행해 14 tests 중 13 pass/1 fail로 재현했다. 시험과 대상 overview 모두 integration과 committed `dwp-dev` blob이 동일하고 HRIS pre-merge parent에는 없었다. 사용자 dirty main의 overview 수정은 사용하지 않았다.

추가 품질:

- `node node_modules/typescript/bin/tsc --noEmit`: PASS
- HRIS/HCM/page/query-state/request-scope scoped ESLint: PASS
- source 변경 및 새 frontend commit: 없음

## 전체 Vitest — 정확히 1회

`yarn test --maxWorkers=4 --maxConcurrency=2 --reporter=json`을 현재 HEAD에서 정확히 한 번 실행했다.

- result files: **696 unique**
- Vitest JSON suite counters: total 1,475 / pass 1,469 / fail 6 / pending 0
- tests: **6,370 total / 6,367 pass / 3 fail / 0 pending / 0 todo / 0 skip**
- retry 또는 flaky marker 관찰: 0. 단일 실행은 보편적 non-flaky 증명은 아니다.
- 실행 전후 HEAD/tree/status 불변

실패 세 건의 분류:

1. `product-action-disclosure-contracts.test.ts` — committed `dwp-dev` Approval disclosure 기준선 불일치.
2. `approval-form-typed.test.ts` — typed V2 golden fixture 실제 SHA-256 `ce823a73...`가 pinned 기대값 `5867525...`와 불일치. 시험·fixture 모두 committed `dwp-dev`와 동일하며 HRIS pre-merge parent에는 없었다.
3. `approval-workflow-planning-controller.test.ts` — 안전 결과(취소된 late selection이 새 owner를 채우지 않음)는 유지되지만, Approval 시험은 `changed` 문구를 기대하고 현재 shared HTTP는 typed abort를 `HTTP transport failed: abort`로 반환한다. Approval 시험/controller는 committed `dwp-dev`와 동일하고, shared Axios만 integration에서 변경됐다. HTTP lifecycle/race 57/57가 통과하므로 transport 안전성을 되돌리지 않고 양 owner가 typed cancellation 계약을 합의해야 한다.

## Architecture·IA 차단

`yarn architecture:check`는 앞선 authorization/app/route/boundary/cycle 검사를 통과한 뒤 Approval production reachability에서 실패했다. 정확히 13개이며 동반 JSON에 전부 열거했다. **13/13 모두 integration HEAD와 committed `dwp-dev` blob이 동일**하다. 사용자 dirty main에서는 그중 inspector·overview 두 경로만 modified지만 사용하지 않았고 allowlist도 완화하지 않았다.

IA 결과:

- `validate_information_architecture.py --compact`: 98 nodes(76 BASE, 22 modern) 중 **BASE 76/76의 `source_digest_sha256` drift**로 FAIL. route·family·API·authorization coverage의 다른 의미 오류는 0이다.
- IA 고의 변조: **30/30 차단** — PASS
- IA node access: 98 nodes, 66 projections/operations/runtime contracts, 138 typed field groups, 202 actions, 5 personas, 31 packages, 128 duties — PASS
- access 고의 변조: **54/54 차단** — PASS
- shared presentation boundary: 1 binding PASS; 고의 변조 **5/5 차단**

IA drift는 계층화된 frontend catalog와 생성 register의 pin 차이다. backend/provenance 동결 전 성급히 regenerate하지 않았다. 최종 source freeze 뒤 canonical generator로 재생성하고 semantic diff와 30개 negative fixture를 다시 검사해야 한다.

## 닫혀 있는 항목

1. Approval shortcut disclosure의 committed source/test 계약 원자적 해소
2. Approval V2 golden fixture와 SHA pin 중 정본 결정 및 원자적 해소
3. Approval/shared HTTP typed cancellation 계약 합의 — HTTP 취소·timeout hardening 유지
4. Approval unreachable 13개를 실제 entry graph에 연결하거나 owner 결정으로 제거; allowlist 우회 금지
5. 최종 provenance freeze 후 IA BASE 76 digest 재생성·독립 재검증
6. backend clean final HEAD/tree 확정 후 frontend/backend provenance 갱신·검증

결론적으로 **HRIS frontend 모듈 자체의 수정 필요 결함은 발견되지 않았다.** 하지만 위 여섯 항목 때문에 전체 frontend integration은 아직 준비 완료가 아니며, START-P0와 모든 Gate는 닫힌 상태다.
