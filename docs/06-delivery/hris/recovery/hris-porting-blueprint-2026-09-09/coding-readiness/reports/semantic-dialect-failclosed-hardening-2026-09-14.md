# Semantic dialect fail-closed 검증기 고도화

상태: VALIDATOR_HARDENING_VERIFIED_CURRENT_CONTRACTS_STILL_FAIL / G3_AUTHORIZATION_NONE.

**0개 operation을 검사한 결과가 readiness PASS로 표시되는 경로를 차단했습니다.** 정상 query·기존 business ID/타입/실제 컬럼/typed projection 검증은 유지했고, 정본의 기존 결함은 그대로 FAIL합니다.

## 변경 범위

- `validate_modern_semantic_field_lineage.py`: canonical graph 명시·nonempty·unique·closure·선언 count·독립 scope 검증, unsupported/mixed proposal 거부, 명시 READINESS/DIAGNOSTIC_ONLY status·readiness_pass, CLI 독립 registry scope.
- `test_modern_semantic_field_lineage.py`: 기존 35개 그대로 + 신규 25개 회귀.
- `validate_modern_capability_contracts.py`: capability registry에서 알려진 exact operation IDs/count를 전달하는 최소 hook.

정본 JSON·proposal·BE·FE·SQL·Control·Gate·봉인은 수정하지 않았습니다. 기존 WFM 독립 보고서의 최초 snapshot pin은 유지했습니다. 현재 WFM의 root 후속 수정 snapshot은 아래 검증 시점 값으로 별도 기록합니다.

## 최종 실제 검증

| 항목 | 결과 |
| --- | --- |
| Python 3.12.14 / SyntaxWarning-as-error unit | 60 PASS / 실패·오류·스킵 0 |
| 동일 최종 소스 Python 3.9.6 unit | 60 PASS / 실패·오류·스킵 0 |
| 기존 aggregate negative self-tests | 16 PASS |
| 정상 최소 readonly query | 1 operation / 7 field sources / 5 typed sources / writes 없음 / PASS |
| canonical semantic CLI + self-tests | unit PASS, 정본 FAIL / exit 1 |
| aggregate canonical + self-tests | unit PASS, 정본 FAIL / exit 1 |
| 현재 canonical | 100 operations / 2335 field sources / 2007 errors |
| actual WFM22+6 proposal | unsupported dialect FAIL / validated operations 0 / readiness_pass=false |
| explicit canonical []/[] diagnostic | DIAGNOSTIC_ONLY / readiness_pass=false |

실제 정본 issue counts는 `CORRELATION_AS_BUSINESS_ID=45`, `CORRELATION_OBJECT_REFERENCE=100`, `PROJECTION_SOURCE_SHAPE_MISMATCH=22`, `REQUEST_ENTITY_UNDECLARED=108`, `SEMANTIC_BINDING_MISSING=371`, `SOURCE_COLUMN_MISSING=413`, `SOURCE_TYPE_MISMATCH=82`, `SOURCE_UNRESOLVED=866`입니다. 현 오류수는 변경 전 CLI 관찰과 같으며 정책·테스트에 고정한 수량이 아닙니다. 현재 전체 issue fingerprint는 `bcff18a5bf25ad27f4d5e8152a4f8f95cd5e53584dc8b9c5e9bc8da6603e4e99`이고 이전 독립 capture와 동일합니다. `OperationValidator`의 실제 field/type/identity/source 검사 본문은 변경하지 않았습니다.

## 독립 범위와 diagnostic 경계

양쪽 graph를 같이 줄이고 document count도 맞추거나, 양쪽 operation IDs를 같이 바꾸면 자체 count만으로는 속일 수 있습니다. 이를 caller가 capability registry에서 전달하는 `expected_operation_ids`/`expected_operation_count`로 거부합니다. 고정 canonical CLI도 이 registry를 사용합니다. 해당 인자는 필터가 아니라 **입력 문서의 정확한 감사 범위**이며, 모듈 단위 문서는 독립 모듈 oracle와 일치하면 정상 통과합니다. 100개 상수 강제는 추가하지 않았고 legitimate scope 증가 회귀도 통과했습니다.

기존 의도적 zero-operation diagnostic 사용자는 찾지 못했습니다. 명시 library keyword `DIAGNOSTIC_ONLY`만 canonical []/[] 관찰을 허용하며 status를 DIAGNOSTIC_ONLY로, readiness_pass를 false로 고정합니다. unsupported/missing graphs는 여기서도 FAIL하며 실제 nonempty source 오류도 검사합니다. CLI/Gate에 diagnostic 옵션은 배선하지 않았습니다.

현재 actual WFM JSON SHA는 `2f95367ceb94b871833bce3b38406c08c770049fd41b0df94b720a5123898c40`입니다. 최초 독립 검토 pin `5c0af043947c007c9304edb29519a8176011fd46180cfa49d2d04d2f0107bd91`의 검토 보고서는 역사 snapshot으로 보존하며 새 버전의 제품·상태·source 승인을 주장하지 않습니다.

[JSON 증거](semantic-dialect-failclosed-hardening-2026-09-14.json)에 모든 60 case IDs, 실행 명령·exit·duration/output SHA, 3 source hashes, 정본 pins, 오류별 집계·fingerprint와 정상/diagnostic witness를 기록했습니다. 이 검증기 PASS는 proposal 변환·owner port/PEP/fixtures/common pilot·실제 HRIS native 업무 실행 또는 전체 준비 승인과 다릅니다. G3는 계속 CLOSED입니다.
