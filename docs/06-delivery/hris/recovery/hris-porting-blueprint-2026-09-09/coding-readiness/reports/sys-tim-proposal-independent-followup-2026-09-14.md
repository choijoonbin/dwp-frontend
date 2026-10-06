# SYS/TIM 제안 독립 재검토 — 2026-09-14

결론: **제안의 주요 의미 오류는 보완됐지만 G3는 계속 차단됩니다.** 검토 상태는 `INDEPENDENT_PROPOSAL_REVIEW_G3_BLOCKED`이며 구현·G4 실행·G6 승인 PASS가 아닙니다.

검토 기준: UTC 2026-09-14 01:10:38, ROOT 작성 SYS/TIM JSON SHA-256 `2f72d06ac4e17e7436ddb0a25d9ac9cdef5e81526f765b3cfdb770d751dc6d54`. 검토한 4개 파일의 전체 digest와 typed findings는 [JSON 보고서](sys-tim-proposal-independent-followup-2026-09-14.json)에 고정했습니다. 이후 원본 변경은 이 기준의 후속 변경이며 이 보고서가 자동 승인하지 않습니다.

## 제안 수준에서 보완된 지적

- WFM native demand/owner snapshot 및 AI ephemeral instruction/versioned template는 selector별 required/forbidden one-of로 분리됐습니다.
- WFM은 PER.Skill UUID + SKILL_TAXONOMY artifact version + 폐쇄 proficiency code/owner ordinal을 사용합니다. 임의 숫자 또는 lexical 순서 비교를 제거했습니다.
- 익명 submit은 principal-bound 일반 G2 receipt/인터셉터를 제외합니다. 정확한 토큰 소비·보호 receipt 테이블, 실제 listening_survey_id FK/resolution, 원자 admission, keyed HMAC·재시도 규칙이 있습니다. 누락 테이블이라는 이전 지적은 남기지 않습니다.
- 일반33 command receipt는 실제 TIM/SYS public_id와 6개 저장 상태(ACCEPTED/RUNNING/SUCCEEDED/REJECTED/FAILED/RESULT_UNKNOWN)의 identity projection을 명시합니다. 두 historical SQL source ref 모두 실제 존재합니다.
- 충분한 cohort도 정확한 participant count를 공개하지 않습니다. privileged role 결합·network timing·식별 free text 위험을 명시하며 절대 익명성을 주장하지 않습니다.

위 사항은 모두 `DESIGN_ONLY`입니다. 별도 owner-port·PEP·SQL·ACL·테스트 게시를 대신하지 않습니다.

## 남은 G3 차단 및 수용조건

| 지적 | 근거/남은 문제 | 닫는 조건 |
| --- | --- | --- |
| P0-STF-001 | 46 operation=34 command+12 query. 정확한 method/path 쌍0개, query field list12개 모두 빈 목록. commandReceiptSourceContract의 operation-specific result_ref/entity/source도 OPEN(제안JSON:41,3959). | exact successor에 API request/query/response/event·column write/read set·독립 typedSources·owner schema/refetch·PEP/dependency/slice 전수 게시. 실제 FK/column oracle로 검증. |
| P0-STF-002 | protected submit PEP/interceptor allocation 및 envelope/schema/role ACL/retention/privacy command가 명시적 OPEN(제안JSON:1737,2385). 테이블을 적었다고 경계가 구현되지는 않음. | issuer envelope 검증·no-principal ingestion·역할 분리·canonical HMAC bytes/key replay·retention/hold·동시중복·외부 tenant·telemetry·차분 재식별 검증을 exact owner/route/test로 봉인. |
| P0-STF-003 | erase write set는 responses/answer_values뿐인데 receipt retention은 ERASED를 요구함. submit receipt 공개 states는 ACCEPTED뿐, 저장 상태는 ACCEPTED/ERASED(제안JSON:2190,2340). | erase가 보호 receipt를 원자 갱신하고 token tombstone을 보존. erase/close/expiry 뒤 same-token replay는 새 응답0개, ERASED 또는 opaque expiry, content 재조회 불가. 동시정정·purge 순서까지 정의/fixture. |
| P0-STF-004 | integration plan:49의 common People47/48·Auth211/212·Platform231..237이 기존 module 예약과 충돌. 계획은 이를 정직하게 OPEN으로 기록함. | committed Git blob baseline inventory → 용량 검토 → successor reservation/SQL filename/instructions/validator 공동 게시. 역사 G2 예약·immutable SQL 보존. SYS configuration/insights stream/bootstrap 별도 명시. |
| P1-STF-005 | 기대값 검사는 fixture만 읽으며 typed proposal binding/HMAC/replay를 실행하지 않음(검사기:2,18). | 모든 case를 exact typed request/owner artifact/row/state/event/receipt/error에 결속. one-of·replay/erase/expiry·denied/correction expected mutation을 검사하고 G4에서 실제 수행. |

P0는 현재 제안/정본 통합의 준비 차단점입니다. 아직 배포되지 않은 구현에 실제 exploit 또는 실행 FAIL이 있다고 과장하지 않습니다. 개인정보 보호 주장도 privileged DBA/공모·네트워크·free text를 통제하는 절대 보장을 뜻하지 않습니다.

## 실행한 확인과 한계

`python3 semantic-remediation/validate_sys_tim_fixture_expectations.py --self-test`: exit0, **10/10**, failures0. 출력은 `SYNTHETIC_PROPOSAL_EXPECTATIONS=PASS; DOMAIN_EXECUTION=NOT_EXECUTED_G4; G3_AUTHORIZATION=NONE`입니다.

독립 read-only shape 확인34개는 errors0(입력 branch, skill entity/version/band, 익명 caller/HMAC 선언, public-count null). 런타임 streaming-schema·PEP·DB 테스트가 아닙니다.

파일을 변경하지 않은 두 기대값 제한 probe에서는 (1) same-token expected를 receipt 불일치/새 응답1개로 변경해도 (2) WFM inputs에 UNKNOWN sourceMode를 넣어도 검사 errors는 각각0이었습니다. 검사기는 스스로 산술·alias 범위라고 설명하며 이 PASS를 G3 또는 전체 acceptance 근거로 사용할 수 없습니다.

기존 [전체 제품 의미 감사](global-product-semantic-audit-2026-09-14.md)의 공식 benchmark와 전체16 capability/base scope 한계는 유지합니다. base86 의미 무결성, 실제8서비스/9stream·5세션 실행·메모리 doctor는 이 bounded review에서 인증하지 않았습니다. 검토자 자신의 PER 제안은 독립 PASS가 아니며 stable PER JSON digest `c81d9a69bf123c801e81953447e39c9529b47d4f572570a4372be4820df3ae56`를 변경하지 않았습니다.

정본·코드·historical seals는 수정하지 않고 이 MD/JSON 보고서만 생성했습니다.

