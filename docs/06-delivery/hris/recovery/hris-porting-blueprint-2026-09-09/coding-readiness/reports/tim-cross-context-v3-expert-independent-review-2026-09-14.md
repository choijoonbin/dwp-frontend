# TIM cross-context v3 전문가 독립 검토

2026-09-14. 판정: **20개 구조 단위 테스트 PASS, 전체 업무 source 의미 승인 아님.** 후보는 AUTHOR_CANDIDATE이며 CURRENT_PUBLISHED=false, G3 CLOSED, SQL 실행 거부를 유지한다. 원본·root 후보·정본·BE/main·SQL·PAY14·HRM11 수정 및 보정 적용은 0이다.

## 실제 실행 증거

- Python 3.12.14, `-B`로 root의 [20개 단위 테스트](../semantic-remediation/test_tim_cross_context_successor_v3.py)를 실제 재실행했다.
- UTC 2026-09-14T08:39:23.549763+00:00 → 2026-09-14T08:39:24.198792+00:00, exit0, 20 unique cases, fail/error/skip0. 원시 출력 gzip/base64·SHA와 actual argv는 동명 JSON에 저장했다.
- 참조 17파일 SHA/mtimeNs decimal string은 실행 전→최종 읽기 후 동일하다. Root의 Python/test/MD/author receipt 4핀도 고정됐다.
- 기존 author unit/table archive를 실제 decode하여 digest·byte size 일치 및 20 case/52 table을 확인했다.
- 재생성한 full plan 1,070,750 bytes SHA `3550d5600c5acff8c3f6924584089909e21eab9c01aa498c1d93f9e3d8d669cc`은 author 저장 SHA와 같다. 잘린 과거 stdout을 전수 증거로 재사용하지 않았다.
- 별도 actual `--sql` 호출은 exit1, stdout0, “SQL export refused”였다. DB·PG·서버·container·domain DML 실행은 없다.

확인된 구조는 original13 → RFC 적용15 cross-context FK → 현재0, ABS-local 신규5, 전체52 tables/723 columns/108 FK, 116 operation IDs/order 보존, affected ABS45, 6테이블의 insert binding **이름**95다. 이 수량은 source 값·DTO·assembler·타입·권한·전이 또는 전체 G3 준비 PASS가 아니다.

## P0와 exact closing conditions

| ID | 실제 근거와 판정 | 필요한 다음 보완 |
|---|---|---|
| 001 | [root Python:80](../semantic-remediation/tim_cross_context_successor_v3.py:80), :83의 `STOP_ONLY`는 RFC 적용 `TIM.LeavePolicyContent.v1.terminationTreatment`의 `STOP_FUTURE_ONLY`와 불일치한다. PRORATE branch의 축약 표현도 exact enum이 아니다. | 새 pin에서 STOP_FUTURE_ONLY/PRORATE_FINAL_PERIOD/OWNER_APPROVED_SETTLEMENT 전이·source·fixture를 정확히 일치시키고 잘못된 enum을 실제 oracle negative로 거부한다. |
| 002 | [ABS schedule clone:191](../semantic-remediation/tim_cross_context_successor_v3.py:191)은 internal FK 3개를 제거했지만 `rule_digest` source가 “loaded tme_work_rule_set_versions”이고 `line_key`는 caller body/WFM 기원 표현을 계승한다. 새9열 source는 SQL column 이름을 owner segment 필드처럼 붙인 문자열이고 response bindings는 빈 배열이다(:203). | 모든 imported segment 필드를 실제 closed TIME owner-response header/segment field adapter로 연결한다. ABS가 TIME repository/body에서 재계산하지 않고 full immutable snapshot·native UUID membership·scope·revision·digest·purpose를 검증한다. |
| 003 | [build:231](../semantic-remediation/tim_cross_context_successor_v3.py:231)은 table/operation/query 일부만 remap한다. defs/state/procedure/owner command/event/field lineage/derivation/fixture/test allocation은 결과에 없다. 실제 ABS validate op에 다른 TIME business write 또는 이전 TIME read를 추가해도 validate()가 허용한다. | 모든 executable 참조를 전수 disposition하고 read/write/query/nested response/source/event/receipt/state를 재결합한다. neutral infrastructure와 business owner import를 구분한다. |
| 004 | [validate:268](../semantic-remediation/tim_cross_context_successor_v3.py:268)은 source **이름 집합**만 비교한다. 빈 tenant source와 actor+tenant-only input_payload도 실제 ACCEPTED다. | 실제 body·normalized mutation·CAS-loaded 부모·owner field·clock·allocator·RETURNING·guarded outcome dependency, SQL leaf type/nullability/parent-version/digest를 검증한다. filler source는 fatal이어야 한다. |
| 005 | 외부 부모3은 plan에서 미결이다. [validate:270](../semantic-remediation/tim_cross_context_successor_v3.py:270)은 알려진 외부 이름이면 child-column/arity/type 검증 전에 continue한다. 실제 없는 child+빈 parent tuple도 ACCEPTED다. | 아래 parent dependency를 exact source metadata로 import하고 알려진 외부 이름도 child/arity/type/tenant tuple 검증한다. 완결 전 SQL 거부 유지. |
| 006 | [create_sql:126](../semantic-remediation/tim_cross_context_successor_v3.py:126)은 metadata의 business CHECK106개를 SQL에 0개 출력한다. RLS WITH CHECK는 business constraint가 아니다. | SQL-checkable 조건과 owner-only semantic requirement를 분리하고 안전한 문법으로 전자를 생성·metadata와 대조한다. 현재 SQL은 native syntax 계획일 뿐 exact physical guard closure가 아니다. |
| 007 | 새 record/SqlBind refs, TIM.TerminationInstruction.v3 및 schedule owner-response는 닫힌 실제 schema/adapter가 없다. native opaque authority와 numeric business counter 정합도 OPEN이다. | 실제 owner operation/query/DTO/type/source/purpose/PEP·producer/consumer files/tests를 정의·결합한다. 사업 revision BIGINT를 auth-/policy-/psc-/psr- 권한 token으로 사용하거나 숫자로 변환하지 않는다. |

이는 미해결 설계·소스 범위다. full G4 CRUD를 먼저 만들라는 조건이 아니다. Root에게 exact enum 및 source/validator 반례를 메시지로 전달했고, root 후보 수정은 하지 않았다.

## External parent는 “모두 native 키 없음”이 아니다

현재 plan의 외부 FK는 다음 세 개다.

| Child | 실제 계획 edge | 현재 saved source 의미 |
|---|---|---|
| tme_schedule_publication_receipts | native_command_receipt_public_id → tme_command_receipts.public_id, tenant 포함 | [G2 SQL:709](../../session-evidence/tim/g2-physical-schema.sql:709)의 UNIQUE(tenant_id,public_id)는 존재한다. 내부 command_receipt_id는 global BIGSERIAL PK이고 tenant+internal UK는 없다. **현재 public edge 때문에 불필요한 internal UK 신설을 요구하지 않는다.** |
| tme_time_cards | close_period_public_id → tme_close_periods.public_id, tenant 포함 | G2에 public composite UK가 존재한다. dependency plan/import와 exact lifecycle/projection이 미완결이다. |
| tme_schedule_publication_receipts | wfm_candidate_id → tme_wfm_schedule_candidates.schedule_candidate_id, tenant 포함 | 현 WFM **미게시 제안**에 composite internal UK가 있다. 그 제안을 native 생산 테이블이나 실행 증거로 승계할 수 없다. |

향후 internal receipt FK가 실제 필요하면 명시적인 additive tenant+internal key 계획과 owner 검토가 필요하다. arbitrary migration 번호/임시 parent/공유 business FK 예외를 만들지 않는다. receipt/outbox/inbox를 neutral infrastructure로 쓸 경우에도 owner·권한·조회·transaction·visibility 책임의 exact 내부 설계가 필요하다.

## 공격 검사의 경계

동명 JSON은 각 in-memory 반례와 reject controls를 기록한다. ABS의 tme_time_cards write, stale TIME read, source filler가 ACCEPTED였고, local FK BIGINT→TEXT와 G3 open은 REJECTED였다.

추가 validate()-only 반례는 nativeExecution=true, fabricated15 boundary records, operation list와 candidate-owned oracle 동시 축소, required OPEN 목록 대체를 허용한다. 이것은 metadata/oracle blind spot(P1)이다. **동시 operation 축소는 현재20 단위 테스트의 reviewed length/order 비교까지 통과했다는 뜻이 아니다.** Gate/SQL 승인 flag의 실제 거부와 별도로 구분했다.

독립 helper 초기 command quoting SyntaxError와 tableName을 잘못 읽은 KeyError는 검사 실패로 기록했다. 이 출력은 성공 증거로 사용하지 않았으며 최종20개 replay를 raw archive로 보존했다. 기존 author initial probe의 default allowlist·external parent KeyError도 과거 실패 그대로 보존하며 미수집 pre/post metadata를 소급 인증하지 않는다.

## 유지할 좋은 경계와 남은 작업

ABS LeavePolicy의 validation/simulation/governance를 ABS-owned parent로, TIME work rule/shift/pattern을 TIME-owned parent로 분리한 방향은 정본 prefix 정책과 맞는다. ABS schedule에 TIME 내부키 대신 public projection을 도입하는 방향도 맞지만 DTO/source/adapter closure는 남아 있다.

RFC 적용 input document의 revision const1/table CHECK revision=1과 새 run correction 방향은 정합한다. reviewed116에서 input.edit/update/revise op는 발견하지 않았다. 따라서 “기존 input 수정과 충돌한다”는 새 버그를 만들지 않는다. immutable assembler/재조회/CAS·recovery 전이의 실제 의미는 여전히 검증되지 않았다.

다음 bounded successor는 (1) exact enum/strict validator 반례, (2) external3+neutral infrastructure dependency, (3) ABS owner projection closed DTO/zero-call adapters, (4) 6테이블 실제 source graph·unsigned canonical assembler/branch/hash·SQL guard, (5) 독립116 catalog와 **나머지112 op 및 상세4의 OPEN subtargets**를 순서대로 다룬다. 원 frozen source4 제안도 CLOSED가 아니다.

G3는 exact 계획과 공유 DTO/SPI/fail-closed adapter/consumer compile/current common·pilot 증거를 요구한다. 전체 domain DML/CRUD/native 여정은 G4, 실제 고객·country/provider 활성화는 G6다. 이 독립 구조 replay로 Gate를 열거나 canonical source 의미를 승인하지 않는다.
