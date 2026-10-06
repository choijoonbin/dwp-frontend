# Identity C2 immutable pin 보강 결과

구현은 완료됐으며 현재 판정은 `IMPLEMENTED_FAIL_CLOSED_AWAITING_FINAL_CANONICAL_SNAPSHOT_RESEAL`이다. Gate는 `CLOSED_FAIL_SAFE`, 모듈 시작 권한은 `NONE`이고 변경하지 않았다.

## 보강 내용

`coding-readiness/validate_identity_c2_consumers.py`가 이제 다음을 모두 강제한다.

- `g0/integration-baseline-manifest.csv`에서 DWP_BACKEND 행이 정확히 하나여야 한다.
- manifest의 integration worktree는 고정된 authoritative integration backend 경로와 같아야 한다.
- `DWP_BACKEND_C2_ROOT`가 다른 경로를 가리키거나 빈 문자열이면 거부한다.
- manifest head/tree/dirty=0 및 branch가 실제 Git top-level/branch/HEAD/tree/clean 상태와 정확히 같아야 한다.
- backend commit/tree를 validator에 하드코딩하지 않고 중앙 manifest 값을 사용한다.
- baseline manifest SHA/size/mode는 canonical snapshot entry와 일치해야 한다.
- 5개 consumer witness와 `SelfContextPurposeV1`의 expected SHA-256을 봉인했다.
- 기존 7개 owner/native/guard expected SHA pin은 유지했다.
- consumer pin key set은 configured 5개 consumer path와 정확히 같아야 한다.

Git 검사는 `/usr/bin/git`만 사용하며 inherited `GIT_*`, `DYLD_INSERT_LIBRARIES`, `LD_PRELOAD`를 제거한다. global/system Git config도 비활성화한다. Clean 검사는 `status --porcelain=v1 --untracked-files=all --ignore-submodules=none -z`의 raw output이 정확히 비어 있어야 한다. 파일 검사 전후로 manifest 및 root/branch/HEAD/tree/dirty를 다시 읽어 중간 변경도 거부한다.

파일/CSV/JSON/Git I/O 오류와 timeout은 traceback 대신 구조화된 JSON FAIL로 수집된다.

## 현재 final backend 일치 증거

| 항목 | Manifest | 실제 Git | 결과 |
|---|---|---|---|
| 경로 | `/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/backend` | 동일 | PASS |
| Branch | `codex/hris-integration-backend-20260909` | 동일 | PASS |
| HEAD | `787f25753a72dc5f0fbbb06783205c0bff6635a5` | 동일 | PASS |
| Tree | `00cf32bf78a46ad17f9482414806b8ffddf4e1d2` | 동일 | PASS |
| Dirty | `0` | `0` | PASS |
| Consumer pins | 5 | 5 exact digest | PASS |
| Purpose pins | 1 | 1 exact digest | PASS |
| Owner pins | 7 | 7 exact digest | PASS |

## Self-test

19개 반례가 모두 정확한 marker로 거부됐다.

- 기존 의미/경계 변조 5건
- alternate root 및 빈 root override 2건
- dirty/tree/head/branch/manifest-dirty 5건
- consumer pin-set 누락 1건
- HRM/PER/PAY/TIM/SYS consumer에 공백 1바이트만 추가한 digest drift 각각 5건
- purpose에 공백 1바이트만 추가한 digest drift 1건

각 text/digest mutation은 실제 값이 바뀌었는지 확인하고 해당 오류 marker만 인정하므로, no-op이나 기존 unrelated 오류로 self-test가 거짓 PASS하지 않는다.

## 현재 의도된 FAIL

Normal과 self-test의 유일한 오류는 `BASELINE_MANIFEST_SNAPSHOT_DIGEST_DRIFT`다.

- 새 final baseline manifest SHA: `ee0175e172ac873a0e415eaf30a150d696ae78559874206c7f2c5985c46f8967`
- 현재 snapshot에 봉인된 이전 SHA: `6e83aae4ffee6737dcbaa3acc20994f5165b4cea55c6f2c3577c81e1f853e311`
- 현재 snapshot의 `coding-readiness/validate_identity_c2_consumers.py` entry: `0`건

Root가 다른 final C0 정본 변경을 아직 마무리하는 중이므로 이 작업에서는 snapshot을 중간 재생성하지 않았다. 모든 C0 변경이 끝난 뒤 snapshot generator를 한 번 실행해 refreshed baseline manifest와 C2 validator entry가 각각 정확히 봉인되었는지 확인하고, 다음 두 명령이 모두 PASS하는지 재검증해야 한다.

```text
python3 -B coding-readiness/validate_identity_c2_consumers.py --compact
python3 -B coding-readiness/validate_identity_c2_consumers.py --self-test --compact
```

그 전에는 C2 immutable pin closure나 전체 코딩 준비 완료를 선언할 수 없다.
