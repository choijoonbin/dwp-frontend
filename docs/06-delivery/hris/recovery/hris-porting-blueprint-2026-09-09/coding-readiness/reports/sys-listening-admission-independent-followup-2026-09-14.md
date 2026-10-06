# Listening successor 제한 독립 재검토

검토 상태: INDEPENDENT_BOUNDED_FOLLOWUP_G3_BLOCKED. G3 승인·전역 privacy 증명·실제 암호화/DB/도메인 실행 증거가 아니다.

검토 JSON SHA는 **418628cc19a789b22f0b03efea93df165eee5967cdd14dd906d9d24a5d346137**이다. MD SHA 4fb5e25032307f403255c6a9779cde5c30caed8d70c3816dae07be1d524edbe1, checker SHA 9969df4872606b3941f9daad902986f32d24d7c1b83146e4f2d7d0990952ad67을 함께 고정한다. 이전 ed13 검토 보고서는 수정하지 않았다. 이후 수정본은 이 SHA의 검토 결과를 그대로 승계할 수 없다.

## 확인된 수정과 실제 검사

Root checker를 실제 frontend 설치 Ajv 6.12.6으로 재실행했다: 15 schema compile, shape 97개, 선택 boundary 107개, exit 0. 별도 독립 검사에서는 4개 실제 schema에 113개 positive/negative 입력을 적용하여 모두 예상 결과와 일치했다.

| 제한 검토 영역 | 독립 재현 결과 | 아직 증명하지 않은 것 |
|---|---|---|
| AdmissionControl owner ref slot | Form/Privacy/Retention 교환 입력 3개 거부 | UUID/revision/digest의 실제 owner refetch |
| Cohort suppression | 전체 SUPPRESSED는 INSUFFICIENT+빈 measures; completed 값 null·suppressed 값 non-null 거부 | questionKey unique projection, 실제 질문별 distinct contributor 계산 |
| SCALE 및 nested Submit | 04/-0/+sign/exponent/whitespace/JSON number/초과 scale 거부 | 실제 canonical byte codec·HMAC·form별 precision/scale/bounds |
| Submit token | 마지막 base64url 문자 64종 중 canonical 16종 허용/48종 거부; 허용분 decode32byte/reencode 일치 | entropy·서명·보관/로그 정책·current token status |
| Response/receipt/consumption FK | 선언 FK 12개 target column/UK closure; 선택 3개 양성 tuple와 11개 key mutation 확인 | PostgreSQL deferred FK·원자 transaction 실행 |

response→receipt는 tenant+response+admission+receipt, receipt→response는 tenant+response+admission, consumption→receipt는 tenant+receipt+admission+token으로 묶인다. 제안의 선택된 tuple 혼동은 수정됐다. 이 결과는 SQL 실행이 아니라 실제 JSON의 composite tuple 비교다.

Parent UK가 tenant_id+admission_id로 바뀌었고 query digest는 child replay UK로 분리됐다. admission lifetime single complete release, CLOSED fixed cutoff, current-gated exact replay, source/erasure/privacy epoch로 cap 리셋 금지가 계획에 명시됐다. 실제 admission.source_revision BIGINT 컬럼도 존재하며 result source가 이를 참조한다. 작성된 규칙의 동시성·DB 강제·실제 increment는 실행하지 않았다.

## 남은 P0/P1

- **P0 — 전역 publication batch:** 같은 모집단을 다른 survey/admission/window로 다시 포장하는 전역 owner-stable budget은 여전히 OPEN이다. per-admission parent만으로 차분 노출이 차단됐다고 말할 수 없다.
- **P0 — projection/threshold 공유 guard:** 같은 questionKey에 mean 4와 5를 넣은 배열은 실제 schema에서 여전히 허용된다. 이는 uniqueItems의 한계로 보고서와 checker에 보존된 witness다. 고유 key·정확한 fixed package·질문별 실제 ACTIVE/unfenced distinct contributor threshold를 공유 owner guard와 negative pilot로 봉인해야 한다.
- **P0 — 공통 보안 scaffold:** 서명/entropy/current revocation·canonical byte HMAC·실제 key REVOKED ack·purpose PEP·logs redaction·distinct issuer/protected DS·composite stream/Control/native evidence는 미실행이다. 기존 9 scalar stream 증적은 새 13 stream/14 runtime purpose 승인이 아니다.
- **P0 — 전체 기능 정본 설계:** 이 fragment는 전체 Survey/Form/Audience/Action/IA 계약이 아니다. 실제 closed form/privacy/retention owner source, event/read/write/query lineage 및 acceptance 배정과 canonical 합성이 필요하다.
- **P1 — 새 좁은 결속 누락:** /tableSpecifications/6/foreignKeys는 result.admission_id와 result.epoch_budget_id를 별개 FK로 검사한다. 실제 제안 tuple에서 admission A=10의 result를 admission B=20의 budget에 붙여도 두 FK가 각각 성립했다. /tableSpecifications/9/columns/5의 sealed_result_public_id는 target FK가 없어 nonexistent result도 child의 선언 FK를 통과한다. 실제 PostgreSQL 공격을 실행한 것은 아니다.

P1 권고는 result→parent (tenant_id,epoch_budget_id,admission_id) composite FK와 child→동일 parent result (tenant_id,epoch_budget_id,sealed_result_public_id) FK이다. target UK, CONSUMED/non-null 및 RESERVED/DENIED/no-success 조건, release_count 0..1/first digest 일관성을 exact SQL+CAS 규칙으로 명시해야 한다. same-tenant wrong admission/wrong parent/nonexistent result 음성과 valid deferred atomic insert 양성을 배정한다.

G3는 **완전한 exact 설계·게시된 shared DTO/SPI·fail-closed shared guard/adapter·consumer compile·current common/pilot runtime** 조건이다. 전체 도메인 CRUD/DB acceptance 실행은 G4, full-screen Design AI는 G5, 고객 권한/키·운영 cutover 및 process isolation은 G6이다. 모든 업무 구현을 먼저 끝내야 G3를 열 수 있다는 순환 조건을 요구하지 않는다.

## 재현과 증적

작성자 checker 재현 명령:

```sh
node /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/semantic-remediation/validate_sys_listening_admission_proposal.cjs /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend
```

[Typed 독립 증적](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/sys-listening-admission-independent-followup-2026-09-14.json)에 113개 입력별 expected/actual, selected FK mutation, parent/result 추가 witness 및 그대로 node stdin에서 실행할 probe source를 저장했다. 서명·암호화·DDL·실제 사업 코드/공격 실험은 실행하지 않았고 정본·backend·이전 보고서도 변경하지 않았다.
