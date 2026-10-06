# G3 checkpoint evidence contract

`worktree-branch-register.csv`의 HEAD는 변경하지 않는 entry seal이다. 실제 코딩이 시작되면 각 clean commit range를 `g3-checkpoint-register.csv`에 한 행씩 순서대로 추가하고, live validator가 현재 worktree HEAD와 최신 `VERIFIED` 행을 정확히 대조한다. register가 header-only인 현재 상태는 `NOT_STARTED_G3`와 일치한다.

## Touch manifest

CSV header는 다음과 정확히 같아야 한다.

```text
touch_id,slice_id,session_id,repository,allocation_id,changed_path,operation_refs,migration_filename,evidence_ref,evidence_sha256
```

한 Git diff 경로당 정확히 한 행을 둔다. diff는 `git diff --name-status --no-renames` 정본이므로 rename은 원래 경로 `DELETE`와 새 경로 `CREATE` 두 touch로 분해한다. `CREATE/MODIFY/DELETE`는 `file-ownership-register.csv`의 exact operation과 일치해야 하며, delete 외 경로의 Git object mode는 regular blob(`100644/100755`)이어야 한다. symlink와 submodule은 금지한다. 모든 행은 동일 checkpoint의 named slice·owner·repository와 일치하고, `allocation_id`는 대상 경로에 열린 exact allocation이어야 한다. `operation_refs`는 비어 있지 않으며 slice가 봉인한 API/event의 부분집합이어야 한다. `evidence_ref`는 blueprint 내부의 실제 typed JSON이고 `evidence_sha256`과 일치해야 한다. JSON은 `dwp.hris.g3.touch-evidence.v1` schema, slice/session/repository/allocation/changedPath/operationRefs, central proposal reference/digest 또는 null, verification command·output SHA-256, exitCode 0, PASS를 정확히 담는다. 모듈 writer의 manifest는 `validate_g3_slice_code_go.py --touch-manifest`를 통과해야 한다. 등록된 Flyway path는 owner `MODULE_COMMIT`에서만 CREATE할 수 있고 stream·service·prefix·range·direct-child·slice reservation 및 numeric version 유일성을 모두 만족해야 한다. 기존 파일의 MODIFY/DELETE/rename과 symlink는 금지한다. modern exact SQL과 `BASE-TFR-PAY-016`은 exact path만 허용하고 다른 suffix로 같은 numeric version을 선점하는 것도 차단한다. Control은 같은 path/blob의 `INTEGRATION_MERGE`와 typed DBA workflow review/global replay만 수행하며 shared/on-demand 중앙 migration은 proposal-bound `CENTRAL_MATERIALIZATION`으로 분리한다.

CONTROL allocation을 쓰는 모든 중앙 touch evidence는 `session-evidence/<module>/g3/module-evidence/control-proposals/` 아래의 `dwp.hris.g3.owner-control-proposal.v3` JSON과 SHA-256을 참조하고, 같은 digest가 append-only `g3-control-proposal-register.csv`에 먼저 봉인되어야 한다. 이 두 append는 `append_g3_control_proposal.py --proposal <blueprint-밖-regular-json>`만 수행한다. helper는 exact JSON bytes를 owner repository object database의 regular Git blob으로 기록하고 owner shard manifest에 CREATE_NEW한 뒤 공통 host lock 안에서 register sequence를 할당·CAS한다. register와 JSON은 owner가 writer인 앞선 동일 slice·repository `MODULE_COMMIT`의 checkpoint ID·HEAD·tree·touch-manifest digest, owner-declared engineering/product-owner 역할과 시각, 중앙 allocation 목록·sorted publishedPaths·sorted operationRefs 및 `OWNER_APPROVED_FOR_CONTROL`을 정확히 결속한다. `approval_reference`는 `DWP-HRIS-OWNER-APPROVAL:<owner>:<proposal-id>:<payload-sha256>` 형식이며 `approvalReference` 자신을 제외한 JSON 전체 canonical payload digest에 결속되는 G3 workflow integrity/idempotency seal이다. proposal blob과 workflow seal은 재사용할 수 없고, 선언 시각은 source checkpoint보다 뒤이며 Control checkpoint보다 앞이어야 한다. status 문자열만 있는 구 proposal, Control-authored proposal, 다른 owner/slice/repository/head/tree/touch에 재사용한 proposal은 무효다. 실제 변경 경로가 선언 allocation의 glob과 목록에 있어야 하고 operation은 named slice 권한의 부분집합이어야 하며 modern slice는 추가로 `exact_change_paths` 범위와 일치해야 한다. 이 봉인은 동일 파일시스템 write 권한자의 실제 신원이나 외부 Product 승인을 암호학적으로 증명하지 않으며, Product/G6 승인과 production 활성화는 별도 외부 승인·감사 경계에서 수행한다.

Control-authored checkpoint 세 종류는 module helper나 수기 CSV append로 만들지 않는다. `prepare_g3_control_checkpoint.py prepare`가 Control integration 또는 owner baseline-sync worktree의 clean forward diff에서 `g0/control-evidence-intake/<module>/g3-control-checkpoints/<id>` 아래 blank operation/source-link template를 CREATE_NEW한다. 선택 map과 migration DBA review map은 blueprint 밖 regular non-symlink 파일에서만 stable-read하며, `finalize`는 proposal, identical source blob, backend contract dependency와 closed-catalog command receipt를 검증해 exact `0600` bundle manifest/finalization을 만든다. `append_g3_control_checkpoint.py --finalization ...`은 bundle의 exact path/file/mode/digest closure와 Git replay를 다시 확인하고 Gate를 공통 `hris-verification` lock 획득 직후와 register CAS 직전에 재확인한다. checkpoint row와 optional cross-repository dependency row는 PREPARED transaction marker에 preimage/candidate digest를 먼저 기록한 후 각각 file·parent-directory fsync하고 COMMITTED marker를 마지막에 쓴다. 일반 예외는 두 register와 marker를 모두 동기 rollback한다. process interruption으로 PREPARED가 남으면 다른 module/Control append는 fail-closed하며, 동일 immutable bundle과 prior/candidate digest가 재검증된 `--recover commit` 또는 `--recover rollback`만 허용한다.

Control artifact release와 consumer sync receipt는 개별 수기 append가 아니라 `append_g3_control_delivery.py`에 release row 1개와 해당 release의 허용 consumer 전체 receipt row를 한 batch로 입력해 기록한다. helper는 공통 `hris-verification` lock, 현재 Gate OPEN, 기존 release/receipt digest marker, replay·sequence·UTC timestamp CAS와 `validate_central_artifact_delivery.py`의 Git blob·exact path closure·compile receipt 검증을 모두 통과한 뒤 두 register를 교체하고 `g3-control-delivery-state.json`을 마지막에 기록한다. 중간 실패나 외부 수기 변경은 다음 검증에서 marker split-brain으로 거부된다.

`INTEGRATION_MERGE`는 아래 exact header의 source-link manifest를 추가로 봉인한다.

```text
link_id,source_checkpoint_id,source_touch_id,source_path,source_operation,source_allocation_id,source_blob_oid,publication_kind,target_touch_id,target_path,target_operation,target_allocation_id,target_blob_oid,equivalence_rule,dba_review_ref,dba_review_sha256
```

source는 앞선 동일 owner·slice·repository의 `MODULE_COMMIT`이다. source/target touch를 각각 정확히 한 번 모두 덮는 1:1 mapping이므로 module commit과 CONTROL commit의 경로 digest와 manifest digest는 같을 필요가 없다. 일반 `INTEGRATION_MERGE`는 source/target path와 allocation이 정확히 같고 regular blob OID가 같은 `IDENTICAL_REGULAR_BLOB`, 삭제는 두 parent의 regular preimage OID가 같은 `IDENTICAL_PREIMAGE_DELETE`만 허용한다. module-owned migration merge는 추가로 `dba_review_ref`와 digest가 가리키는 typed G3 DBA workflow review를 요구한다. 서로 다른 경로·allocation·내용으로 변환 게시하는 작업은 이 merge로 가장하지 않고 owner proposal을 결속한 별도 `CENTRAL_MATERIALIZATION`으로 수행한다.

## Command-level test evidence

`test_evidence_ref`는 아래 exact JSON object를 가리킨다. 원시 출력은 저장하지 않고 명령과 출력의 SHA-256만 저장한다.

```json
{
  "schema": "dwp.hris.g3.checkpoint-test-evidence.v1",
  "checkpointId": "G3-...",
  "checkpointKind": "MODULE_COMMIT",
  "sliceId": "BASE-TFR-HRM-001",
  "ownerSessionId": "HRIS-HRM",
  "writerSessionId": "HRIS-HRM",
  "repository": "DWP_BACKEND",
  "parentHeadSha": "40-hex",
  "headSha": "40-hex",
  "sourceCheckpointId": null,
  "commands": [
    {
      "commandId": "targeted-contract-test",
      "commandSha256": "64-hex",
      "startedAt": "ISO-8601 UTC",
      "endedAt": "ISO-8601 UTC",
      "exitCode": 0,
      "outputSha256": "64-hex",
      "reproducibleResultSha256": "64-hex",
      "status": "PASS"
    }
  ],
  "overallStatus": "PASS"
}
```

Frontend의 `frontend-slice-test` command receipt에는 위 공통 필드와 함께 exact `typedResult` 한 개가 필수다. 그 값은 schema `dwp.hris.g3.frontend-slice-test-gate.v1`, 해당 `sliceId`와 register의 exact `testPath`, `testFileCount=1`, `executedTestCount>=1`, `passedTestCount=executedTestCount`, failed/skipped/todo/unrelated count 0, Vitest exit 0, JSON result/argv SHA-256, 빈 errors를 정확히 가진다. v1 호환 필드명 `jestExitCode`는 유지하되 실행기는 Vitest 4의 positional exact path, `--testNamePattern`, `--reporter=json`, `--outputFile` 계약이다. Backend receipt나 다른 frontend command에는 이 필드를 넣지 않는다. 단순 Vitest exit 0, 다른 파일 또는 다른 slice 태그, test 0건, skip/todo, unrelated assertion은 typed PASS가 아니며 checkpoint capture와 live replay가 모두 거부한다.

`checkpointKind`, `sourceCheckpointId`, source-link reference/digest는 CSV와 JSON의 1급 필드다. 종류는 module worktree의 `MODULE_COMMIT`, owner proposal 기반 중앙 생성의 `CENTRAL_MATERIALIZATION`, integration branch 반영의 `INTEGRATION_MERGE`, 검증된 중앙 scaffold를 소비자 기준선으로 전달하는 `CONTROL_BASELINE_SYNC` 중 하나다. `INTEGRATION_MERGE`는 같은 slice·owner·repository의 앞선 module checkpoint와 1:1 source-link를 지정한다. `CONTROL_BASELINE_SYNC`는 별도 중앙 release manifest·consumer receipt·direct-parent sync 규칙을 따르며 일반 module merge나 concrete producer-bound artifact 전달에 사용할 수 없다. source가 없는 종류에서는 source 필드가 비어 있고 JSON 값은 `null`이다.

required command는 `g3-slice-code-go-register.csv` 행의 `backend_verification_profile_id` 또는 `frontend_verification_profile_id`가 가리키는 `g3-verification-command-catalog.v1.json` profile exact argv다. 일반 SYS backend 명령은 `appliesToMigrationAllocationIds`로 Auth 또는 Platform service-local하게 선택하고, `MOD-SYS-LISTEN`은 configuration/protected/insights/issuer 네 backend profile 전부와 listening frontend profile을 사용한다. 모듈 backend에는 root `./gradlew check`, 전체 service suite, `bootJar`를 넣지 않는다. root `./gradlew check --no-daemon`은 `G3CMD-CONTROL-BE`에서 전체 통합 시 정확히 한 번만 실행한다. CONTROL checkpoint는 행의 owner profile과 CONTROL/repository profile의 합집합을 실행한다. 따라서 frontend checkpoint에 Gradle 명령을 증거로 넣을 수 없다. Control frontend build는 integration의 pinned `dwp_agent_contract` OpenAPI를 typed `env DWP_AGENT_OPENAPI=...` argv로 주입한다. `commandId` 집합은 누락·추가 없이 정확히 같아야 하고 `commandSha256`은 JSON argv 배열의 canonical SHA-256이다. capture 도구와 live validator는 free-form shell을 사용하지 않고 `shell=False`로 argv를 실행한다. `outputSha256`은 당시 raw combined stream을 보존하지 않고 봉인하는 digest이고, `reproducibleResultSha256`은 exact command digest·exit code·PASS/FAIL의 재현 가능한 결괏값이다. 각 touch JSON의 `verificationCommandSha256`과 `outputSha256` pair도 같은 checkpoint test evidence의 실제 PASS receipt 중 하나와 정확히 일치해야 한다. live Gate는 최신 checkpoint의 exact argv를 다시 실행해 exit 0과 frontend typed result를 함께 검증한다.

증거 생성은 free-form command를 받지 않는 `prepare_g3_checkpoint.py prepare/finalize`를 기본으로 사용한다. `prepare`는 commit diff에서 만든 blank operation template와 draft를 owner의 `session-evidence/<module>/g3/module-evidence/checkpoints/<checkpoint-id>/`에 shard manifest와 함께 `CREATE_NEW_ONLY`로 기록한다. 사용자는 template를 blueprint 밖의 regular file로 복사해 `selected_operation_refs`만 채우고 `finalize --selection-map <external-file>`로 넘긴다. `finalize`는 선택값을 검증해 immutable selected map을 먼저 append하고, closed command catalog 결과를 OS 임시 디렉터리에서 만든 다음 sealed touch/test bundle과 proposed row/finalization을 각각 manifest batch로 append한다. canonical shard 안에서 draft·sealed directory를 직접 생성·rename·overwrite하거나 mutable 작업 파일을 두지 않는다. 중간 실패 산출물은 삭제하거나 신뢰하지 않으며, 완전한 byte-identical phase retry만 허용하고 그 외에는 새 checkpoint ID로 다시 준비한다.

이 bundle과 module shard hash chain은 계속 `UNTRUSTED_SUBMISSION`이며 중앙 `g3-checkpoint-register.csv`를 수정하지 않는다. append는 Integration Control만 수행한다. `append_g3_checkpoint.py`는 exact owner module-evidence checkpoint root, shard manifest membership, regular `0600` file set, row/test/touch digest를 다시 읽고 Git diff·blob/mode·allocation closure를 독립 계산하며 closed-catalog 명령을 재실행한다. Control transaction marker가 COMMITTED인지 확인하고 Gate 재확인과 전체 검증·CAS를 공통 `hris-verification` lock 안에서 수행하며, 중앙 register 교체는 file 및 parent directory fsync와 동기 실패 rollback을 적용한다. 모두 PASS한 경우에만 sequence/time을 할당한다. 중앙 row의 test/touch digest가 신뢰 anchor이며 shard self-hash만으로는 Gate evidence가 아니다. 이 통제는 workflow integrity/idempotency seal이고 동일 파일시스템 사용자의 외부 신원 attestation은 아니다. 표준 finalized bundle과 충돌하지 않는 직접 capture가 필요하면 `capture_g3_checkpoint_evidence.py --output direct-captures/<checkpoint-id>/<file>.json`처럼 전용 owner-shard 상대 경로만 사용하며, helper도 `module-evidence` writer로 신규 append하고 기존 evidence를 덮어쓰지 않는다. 모듈별 짧은 shard publication과 scoped companion은 canonical 중앙 입력과 자기 shard만 preflight하므로 다른 모듈의 file→manifest 중간 상태를 읽지 않는다. 모든 `--check-live` static+live pipeline과 Control append는 동일한 `host_semaphore.py`의 `hris-verification` exclusive host lock을 사용하며 parent-held proof가 있는 child만 중첩 lock을 생략한다.

## Live closure

`validate_code_checkpoint.py --check-live`는 각 행의 parent/head commit 실재와 forward ancestry, 실제 `parent..head` name-status, touch manifest와 Git diff의 1:1 대응, operation별 writer/owner 소유권, 명령별 PASS와 최신 exact argv 재실행, 중앙 반영의 source checkpoint 연결, 현재 등록된 12개 worktree HEAD와 최신 seal을 검사한다. `git status --porcelain=v1 --untracked-files=all --ignore-submodules=none`가 비어야 한다. 누락된 행, dirty worktree, 미할당 경로, symlink/submodule, 허용되지 않은 migration operation 또는 source-link 없는 Control merge, 실패·빈 test evidence는 모두 Gate를 닫는다.
