# C1·C2·Transport final C0 전 독립 감사

판정은 `FAIL_CLOSED_FINDINGS_RECORDED_FINAL_C0_REEXECUTION_REQUIRED`다. 현재 C2 backend `fc8fbfd38103f7fb2b47adaea861e5327450a74e`는 깨끗하고 C1의 8개 migration subtree OID 및 444개 path/blob manifest가 모두 그대로다. 그러나 이것은 C3가 합쳐지기 전 intermediate 증거다. Gate는 `CLOSED_FAIL_SAFE`, 모듈 시작 권한은 `NONE`이며 정상 transport PASS를 주장하지 않는다.

## 핵심 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| C1 migration bytes at C2 | PASS, intermediate only | 8/8 subtree OID 일치, 444개 manifest `accbd9bf...` 일치 |
| C1 live same-checkpoint | FAIL, expected | C1은 아직 `b6d1f23e`를 pin하고 live HEAD는 `fc8fbfd3` |
| C2 authoritative invocation | PASS | checkpoint companion normal/self-test에 직접 연결; 잘못된 root 주입 시 두 companion failure 재현 |
| C2 immutable pin | **불완전 blocker** | final commit/tree 및 5개 consumer/purpose expected digest가 없고 root env override 가능, canonical snapshot에도 아직 없음 |
| Explicit `DWP_BACKEND@sha` resolver | PASS | live OpenAPI와 bytes가 다른데도 pinned Git object `bd28185d...`를 반환; wrong SHA/missing object 거부 |
| 모든 baseline ref immutable | **FAIL blocker** | SYS bundle의 unqualified `contracts/...` `$ref` 3건이 live OpenAPI로 해석됨 |
| Transport canonical/self-test | FAIL, expected/fail-closed | stale global baseline 때문에 normal 14 errors, self-test `canonicalStatus=FAIL`, cases 0, exit 1 |

## A. Final C0에서 원자적으로 재봉인할 C1 위치

다음은 동일한 final clean C0 commit/tree로 함께 바뀌어야 한다.

1. `g0/migration-successor-register.v1.json`
   - `/source/commit`
   - `/source/tree`
2. `g0/validate_migration_successor.py`
   - `EXPECTED_SOURCE["commit"]`
   - `EXPECTED_SOURCE["tree"]`
3. `g0/migration-allocation-register.csv`
   - 아래 14개 current C1 policy/allocation 행의 `baseline_commit`
   - `MIGPOL-PEOPLE`, `ALLOC-HRM-PEOPLE-G3`, `ALLOC-PER-PERFORMANCE-G3`
   - `MIGPOL-AUTH`, `ALLOC-SYS-AUTH-G3`
   - `MIGPOL-PLATFORM`, `ALLOC-SYS-PLATFORM-G3`
   - `MIGPOL-APPROVAL`, `MIGPOL-NOTIFICATION`, `MIGPOL-MEETING`
   - `MIGPOL-PAYROLL`, `ALLOC-PAY-PAYROLL-G3`
   - `MIGPOL-TIME`, `ALLOC-TIM-TIME-G3`
4. `g0/validate_code_checkpoint.py`
   - `MIGRATION_SUCCESSOR_BASELINE_SHA`
5. `coding-readiness/validate_full_coding_readiness.py`
   - `MIGRATION_SUCCESSOR_BASELINE_SHA`
6. `coding-readiness/03-backend-service-architecture.md`
   - 현 line 98의 `b6d1f23e`/`84345cd8`를 final pin으로 동기화하거나 intermediate와 final을 명확히 구분
7. `coding-readiness/reports/migration-successor-c1-final-2026-09-14.json`
   - `sourceCheckpoint.commit/tree`, top-level `status`, `sameCheckpointClosure.*`, final 재실행 증거
8. `coding-readiness/reports/migration-successor-c1-final-2026-09-14.md`
   - opening checkpoint, closure 결론, 재실행 결과
9. 모든 canonical 변경 완료 후 `g0/blueprint-central-snapshot-manifest.v1.json`을 generator로 한 번만 재생성

전체 C0 동일-checkpoint를 위해 `g0/integration-baseline-manifest.csv`의 DWP_BACKEND integration head/tree/dirty/captured 값과 `g0/code-entry-baseline-lineage.csv`의 code-entry head/tree 및 승인 commit/diff/allowlist도 final descendant로 갱신되어야 한다. `characterization_head_sha=5670877d...`는 transport의 역사 pin이므로 유지한다.

반대로 다음 값은 기계적으로 덮어쓰면 안 된다.

- C2 final report의 `backend.baseHead=b6d1f23e...`: C2가 어느 base 위에서 생성됐는지 나타내는 역사 provenance다.
- migration allocation의 historical G2/EXT-WIP 행 commit.
- 역사 G2 proposal blob/pointer.
- 별도 승인된 successor 작업 없는 `checkpoint-register.csv`의 역사 entry `base_sha`.

8개 subtree OID, 444개 manifest digest, People V47..50, 11개 exact rename, 6개 allocation range와 8개 high-water는 final C0에서 재검사 후 동일한 경우에만 그대로 유지한다.

## B. C2 authoritative Gate 연결과 pin 감사

호출 연결은 실제다.

- `g0/validate_code_checkpoint.py:439`가 normal C2 validator를 실행한다.
- 같은 파일 line 440이 C2 self-test를 실행한다.
- `coding-readiness/validate_full_coding_readiness.py:7090`은 full pipeline에서 authoritative checkpoint를 호출한다.
- `DWP_BACKEND_C2_ROOT=/__c2_authoritative_probe_missing__`를 사용한 읽기 전용 probe에서 두 개의 named C2 companion failure가 발생했다. 즉 파일 존재만 확인하는 연결이 아니다.

현재 `validate_identity_c2_consumers.py` normal과 self-test는 각각 PASS했고 5개 consumer 및 7개 owner pin, 5/5 mutation rejection을 확인했다. 다만 immutable authoritative pin은 아직 닫히지 않았다.

- 7개 owner 파일만 expected SHA로 고정되어 있다.
- 5개 consumer와 `SelfContextPurposeV1`의 digest는 출력될 뿐 expected 값과 비교되지 않는다.
- final backend commit/tree/clean pin이 validator 자체에는 없다.
- inherited `DWP_BACKEND_C2_ROOT`로 검사 대상을 다른 tree로 돌릴 수 있다.
- validator SHA `8687bb5b...`는 full artifact inventory에는 있으나 현재 canonical snapshot에는 아직 포함되지 않았다.

Final C0 전에는 authoritative baseline이 지정한 backend root 외의 env override를 거부하거나 정확히 같은 경로임을 확인하고, final commit/tree/clean 상태와 5개 consumer/purpose의 blob 또는 SHA를 봉인해야 한다. 그 뒤 canonical snapshot을 재생성하고 checkpoint normal/self-test 및 full live 경로에서 다시 실행해야 한다.

## C. Transport immutable Git-object 감사

새 explicit resolver 자체는 올바르게 fail-closed다.

- Pinned object: `5670877d...:contracts/openapi/gateway-public.json`
- Pinned SHA-256: `bd28185de73fa6018c4293b0d2a48353b78dcf789123be7e67216fa45f7999e0`
- 현재 live SHA-256: `a16a3709857e3c074c6cb4cb18357b9e33fecdcbbcabdd54585e6cdffffa7482`
- 두 bytes가 다른 상태에서도 `DWP_BACKEND@5670877d:...`는 virtual Git-object path에서 `platform_getSurface`를 해석했다.
- wrong SHA와 존재하지 않는 pinned path는 모두 거부됐다.

그러나 immutable closure 전체는 아직 불완전하다. `session-evidence/sys/g2-transport-schemas.v1.json`에는 다음 unqualified `$ref`가 총 3번 남아 있다.

- `contracts/openapi/gateway-public.json#/components/schemas/platform_ApiResponseHomePreferenceResponse`
- `contracts/openapi/gateway-public.json#/components/schemas/platform_UpdateHomePreferenceRequest`

`resolve_reference()`의 `contracts/` branch는 이를 integration worktree의 live 파일로 조합하며, 실제 probe도 `/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend/contracts/openapi/gateway-public.json`을 반환했다. 이 경로는 local SYS operation schema와 whole-bundle `walk_schema_refs()`에서 도달한다. 따라서 “모든 HomePreference baseline schema가 immutable Git object에서 왔다”는 주장은 아직 할 수 없다.

해결 방법은 해당 ref를 모두 `DWP_BACKEND@5670877d...`로 명시하거나, pinned SYS bundle context의 `contracts/` 상대 ref를 같은 immutable Git object로만 해석하고 live fallback을 거부하는 것이다. live OpenAPI bytes를 의도적으로 다르게 둔 fixture에서 pinned bytes만 읽는 self-test도 추가해야 한다.

현재 정상 transport 실행은 global integration manifest/lineage가 `6f1ed92d...`를 가리키고 backend가 `fc8fbfd3...`여서 14 errors로 FAIL한다. Self-test 역시 canonical validation이 FAIL하자 mutation case를 하나도 실행하지 않고 `status=FAIL`, `canonicalStatus=FAIL`, exit 1을 반환했다. 이것은 거짓 PASS가 아닌 올바른 fail-closed 동작이다.

## Final C0 재실행 조건

- C2/C3를 하나의 clean final backend HEAD/tree로 통합한다.
- C1 8개 subtree/444 manifest가 그대로인지 다시 증명한다.
- 위 C1 위치와 global baseline/lineage를 동일 checkpoint로 원자 갱신한다.
- C2의 root, commit/tree, consumer/purpose bytes를 authoritative context에 봉인한다.
- SYS unqualified baseline schema ref의 live fallback을 제거하고 divergent-live self-test를 추가한다.
- 모든 canonical 변경 후 snapshot을 재생성한다.
- migration normal/self-test/check-live, C2 normal/self-test, transport normal/self-test, checkpoint live, full live를 재실행한다.
- 별도 권한 결정 전까지 Gate와 module start는 계속 닫아 둔다.
