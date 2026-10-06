# HRIS blueprint evidence recovery report

## 결과

복구 대상은 `/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09`이며, 복구 세션의 `fileChange`와 캡처된 완전 파일 readback만 재생했다. 과거 생성 명령은 실행하지 않았고 SKKF를 다시 해석하거나 누락 내용을 새로 작성하지 않았다.

| 구분 | 수 |
|---|---:|
| 실제 복원 파일 | 757 |
| 이벤트 체인 무충돌 복원 | 722 |
| 부분 복원 | 31 |
| 번호행+최종 SHA로 추가 복원 | 4 |
| 경로 참조만 있고 미복원 | 337 |
| 이벤트상 삭제 | 6 |
| 참조 디렉터리 | 52 |
| 재생 실패 operation | 845 (90개 경로) |

`RECOVERED_EVENT_CHAIN_COMPLETE`는 마지막 `add`/완전 readback 이후의 수집된 fileChange가 모두 적용됐다는 뜻이다. 수집되지 않은 과거 shell 기반 재생성까지 보장하는 표현은 아니다. `RECOVERED_PARTIAL_EVENT_CHAIN`은 파일은 있으나 마지막 기준점 이후 하나 이상의 diff를 적용하지 못했다. `REFERENCE_ONLY`는 과거 목록 출력에서 존재가 입증됐지만 바이트를 복구할 증거가 없었던 항목이다.

## 검증

스테이징 replay + SHA 검증 추가복원 manifest와 정본 복사본의 파일 경로·크기·SHA-256 일치: **true**

| 검사 | 대상 | 통과 | 실패 |
|---|---:|---:|---:|
| json | 292 | 291 | 1 |
| jsonl | 0 | 0 | 0 |
| csv | 86 | 86 | 0 |
| pythonSyntax | 149 | 149 | 0 |
| javascriptSyntax | 23 | 23 | 0 |

전체 역사 validator는 실행하지 않았다. 부분/미복원 artifact가 있는 상태에서 실행하면 증거 복원과 새 결과 생성을 혼동할 수 있기 때문이다.

## Scoped authoring control

`validate_scoped_authoring_control.py --all --compact` 결과는 **FAIL**다. 역사 worktree 절대경로가 없으므로 backend/frontend exact-clean 검사는 모두 fail-closed다. 계약 binding은 별도로 다음과 같다.

| 세션 | contractBindings PASS | FAIL |
|---|---:|---:|
| HRIS-HRM | 9/10 | 1 |
| HRIS-PAY | 10/10 | 0 |
| HRIS-PER | 10/10 | 0 |
| HRIS-SYS | 10/10 | 0 |
| HRIS-TIM | 10/10 | 0 |

### contractBindings 실패

- `output/hris-porting-blueprint-2026-09-09/session-evidence/hrm/g2-readiness/api-event-contracts.v1.json` — expected `5390eac887c06d33e744252ddf013183f2f1e55198f8a28d341197b6a6336e65`, actual `0c3ec58b29dcf534d1b887fed5678e878e4a514cf3f943165e47dd7a486355bb`

위 HRM 계약 파일은 경로와 부분 바이트는 복원됐지만 packet의 최종 크기·SHA-256과 일치하는 완전 원문 증거를 확보하지 못한 **critical recovery blocker**다. 임의로 보완하지 않았다.

### JSON 구문 실패

- `coding-readiness/ia-entry-query-projection-schemas.v1.json` — Expecting value: line 1 column 1 (char 0)

### fileChange 이력도 있으나 복원하지 못한 파일

- `coding-readiness/g3-contract-primary-ownership-register.csv`
- `coding-readiness/modern-capability-operation-causal-contract-ssot.v2.json`
- `coding-readiness/modern-causal-independent-reviewed-finalization.v1.json`
- `coding-readiness/modern-independent-successor/global-hcm-table-expansion-acceptance-policy.v2.json`
- `coding-readiness/optional-capability-admission-contract.v1.json`
- `coding-readiness/validate_g3_slice_code_go.py`
- `coding-readiness/validate_g4_functional_gate.py`
- `g0/validate_code_checkpoint.py`
- `readiness-tools/generate_sys_g1.py`
- `session-evidence/sys/g2-physical-schema.sql`

## 산출물

- `recovery-inventory.csv`: 복원/부분복원/참조만 존재/삭제 전체 분류
- `referenced-but-not-restored.csv`: 경로 참조만 확인된 파일 또는 leaf 경로
- `referenced-directories.csv`: 파일 수에서 제외한 디렉터리 참조
- `verification.json`: 해시 비교, 재생 통계, 형식 검증 결과
- `staging-replay-report.json`: 원시 재생 이력과 모든 실패 operation

## 제한

- 재생 실패 operation 수는 누락 파일 수가 아니다. 동일 파일에 대한 병렬/후속 diff 실패가 반복 집계된다.
- 경로 목록은 파일 바이트 증거가 아니므로 해당 항목을 임의 생성하지 않았다.
- 복원 파일 안에 남은 truncation marker는 `coding-readiness/ia-entry-query-projection-schemas.v1.json`이다. 이는 readback 스냅샷에서 새로 유입한 것이 아니라 fileChange 증거 자체에 포함된 상태로 보존했다.
