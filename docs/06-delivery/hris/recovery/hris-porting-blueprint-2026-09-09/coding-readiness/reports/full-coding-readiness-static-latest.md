# DWP HRIS 전체 코딩 준비 검증

- 생성시각: 2026-09-10T11:42:00.531438Z
- 검증 모드: STATIC
- 검증 결과: FAIL
- 유효 코드 Gate: BLOCKED
- 보고서 권위: DIAGNOSTIC_STATIC
- 구현 상태: NOT_STARTED_G3
- Production 상태: NOT_AUTHORIZED_G6
- G3 checkpoint digest: a81f8155b0c217d8729872c3192cf3cd02e0eaeee6d51cb9e5898e2b4d51f1d9

이 판정은 범용 core의 G3 코딩 시작 가능 여부만 뜻한다. 기능 구현 완료, G4 수용, G5 디자인 수용, G6 국가팩/연계/고객/production 활성화를 뜻하지 않는다.

## 추적성 집계

- Source parents: 2269
- Child traces: 10001
- Decisions: 78
- Child trace는 source→target 추적 링크 수이며 고유 제품 기능 수나 구현 완료 건수가 아니다.
- 최신 HRIS capability 16건은 전체 개발 범위이나 현재 PLANNED_REQUIRED_SCOPE / NOT_STARTED_G3다.
- Semantic trace proof: PASS / rows 10001 / risk samples 58
- Target-family proof: PASS / parents 2269 / children 10001 / families 86
- Child target_api_event_candidate는 characterization 기록이며 구현 정본이 아니다. 정본 연결은 child.parent_artifact_id → source parent family → target-family resolution_refs다.
- API PEP proof: PASS / public operations 140 / service-only operations 11 / authorized receipt queries 6
- Transport schema proof: PASS / resolved public operations 140 / self-test PASS
- Cross-module typed schema proof: PASS / contracts 21 / consumer bindings 31 / self-test PASS
- Decimal/money proof: PASS / executable checks 133 / value types 5 / rounding modes 6 / large streams 2 / self-test PASS
- Physical ownership proof: FAIL / authoritative base+producer 217 / consumer materializations 2 / deploy objects 219 / owner-prefix bindings 10 / self-test FAIL
- SYS service-local DDL proof: PASS / Auth tables 6 / Platform tables 24 / self-test PASS / PostgreSQL 16 LIVE_ONLY
- Base schema PostgreSQL proof: FAIL / People V1..V46 46 migrations / base owner tables 131 / self-test FAIL / PostgreSQL 16 LIVE_ONLY
- Modern exact proof: FAIL / 0 capabilities / 0 planned operations / self-test FAIL / PostgreSQL 16 LIVE_ONLY / implementation NOT_STARTED_G3
- Integrated IA proof: PASS / nodes 98 / unique routes 98 / self-test PASS
- Named G3 slice proof: FAIL / slices 102 (base 86 + modern 16) / self-test PASS
- G5A Design-AI package plan: PASS / PLANNED_NOT_DUE_AFTER_G4 / IA nodes 98 / actual package NOT_RUN_NOT_DUE / self-test PASS
- Architecture: dependencies 19 / cross-cutting owners 23 / G3 allocations 31
- Dependency allocation proof: HRIS-HRM=PASS, HRIS-PER=PASS, HRIS-TIM=PASS, HRIS-PAY=PASS, HRIS-SYS=PASS
- G6 activation rows: 15 / NOT_AUTHORIZED_G6

| 모듈 | Parent | Child | Decision | Validator |
|---|---:|---:|---:|---|
| HRIS-HRM | 583 | 1654 | 15 | PASS |
| HRIS-PER | 349 | 1041 | 16 | PASS |
| HRIS-TIM | 568 | 3566 | 16 | FAIL |
| HRIS-PAY | 580 | 3515 | 18 | FAIL |
| HRIS-SYS | 189 | 225 | 13 | PASS |

## 검증 그룹

| 그룹 | Checks | Errors |
|---|---:|---:|
| api-pep-bindings | 9 | 0 |
| architecture-documents | 118 | 0 |
| architecture-registers | 526 | 0 |
| base-schema-postgres-feasibility | 11 | 3 |
| baseline-command-evidence | 403 | 0 |
| cross-module-contracts | 403 | 0 |
| cross-module-schema-contracts | 9 | 0 |
| decimal-money-contract | 15 | 0 |
| delivery-architecture | 484 | 0 |
| g0-code-checkpoint | 3 | 1 |
| g3-slice-code-go | 8 | 2 |
| g5a-design-ai-package-contract | 36 | 0 |
| gate-separation | 265 | 0 |
| information-architecture | 11 | 0 |
| migration-ranges | 41 | 0 |
| modern-capability-scope | 334 | 0 |
| modern-exact-contracts | 146 | 2 |
| module-validators | 15 | 2 |
| owners | 304 | 0 |
| physical-owner-prefixes | 5 | 2 |
| source-g1-g2 | 165671 | 0 |
| source-provenance | 5 | 0 |
| sys-service-local-migrations | 8 | 2 |
| target-family-resolution | 6 | 0 |
| trace-semantics | 7 | 0 |
| transport-schema-resolution | 12 | 0 |

## Blocker

- [physical-owner-prefixes] physical owner/prefix closure did not close exact base153 + producer56 + PAY consumer2 = deploy211 ownership: ["physical table category counts drifted expected={'base': 153, 'producer_modern': 56, 'authoritative': 209, 'consumer_materialization': 2, 'deployment': 211} actual={'base': 161, 'producer_modern': 56, 'authoritative': 217, 'consumer_materialization': 2, 'deployment': 219}"]
- [physical-owner-prefixes] physical owner/prefix self-test did not close exact base153 + producer56 + PAY consumer2 = deploy211 ownership: ["physical table category counts drifted expected={'base': 153, 'producer_modern': 56, 'authoritative': 209, 'consumer_materialization': 2, 'deployment': 211} actual={'base': 161, 'producer_modern': 56, 'authoritative': 217, 'consumer_materialization': 2, 'deployment': 219}"]
- [sys-service-local-migrations] SYS service-local migration closure exact closure failed: []
- [sys-service-local-migrations] SYS service-local migration self-test exact closure failed: []
- [base-schema-postgres-feasibility] base schema static exact closure failed: ["TIM: static constraint/index stats drift expected={'tables': 31, 'primaryKeys': 31, 'uniqueConstraints': 57, 'foreignKeys': 11, 'checkConstraints': 85, 'exclusionConstraints': 4, 'explicitIndexes': 9, 'triggers': 7} actual={'tables': 31, 'primaryKeys': 31, 'uniqueConstraints': 57, 'foreignKeys': 11, 'checkConstraints': 87, 'exclusionConstraints': 4, 'explicitIndexes': 9, 'triggers': 8}", "PAY: static constraint/index stats drift expected={'tables': 42, 'primaryKeys': 42, 'uniqueConstraints': 82, 'foreignKeys': 21, 'checkConstraints': 114, 'exclusionConstraints': 4, 'explicitIndexes': 9, 'triggers': 9} actual={'tables': 42, 'primaryKeys': 42, 'uniqueConstraints': 82, 'foreignKeys': 21, 'checkConstraints': 116, 'exclusionConstraints': 4, 'explicitIndexes': 9, 'triggers': 10}"]
- [base-schema-postgres-feasibility] base schema self-test exact closure failed: ["TIM: static constraint/index stats drift expected={'tables': 31, 'primaryKeys': 31, 'uniqueConstraints': 57, 'foreignKeys': 11, 'checkConstraints': 85, 'exclusionConstraints': 4, 'explicitIndexes': 9, 'triggers': 7} actual={'tables': 31, 'primaryKeys': 31, 'uniqueConstraints': 57, 'foreignKeys': 11, 'checkConstraints': 87, 'exclusionConstraints': 4, 'explicitIndexes': 9, 'triggers': 8}", "PAY: static constraint/index stats drift expected={'tables': 42, 'primaryKeys': 42, 'uniqueConstraints': 82, 'foreignKeys': 21, 'checkConstraints': 114, 'exclusionConstraints': 4, 'explicitIndexes': 9, 'triggers': 9} actual={'tables': 42, 'primaryKeys': 42, 'uniqueConstraints': 82, 'foreignKeys': 21, 'checkConstraints': 116, 'exclusionConstraints': 4, 'explicitIndexes': 9, 'triggers': 10}"]
- [base-schema-postgres-feasibility] base schema mutation suite did not reject all seven drift classes
- [modern-exact-contracts] modern exact capability/schema validator did not close 16 capabilities / 100 requests / 38 responses / 32 events / base153+modern56=planned209 overlap0 / 22 menus / 48 auth bindings
- [modern-exact-contracts] modern exact schema mutation suite must reject all 13 drift classes
- [g3-slice-code-go] G3 slice code-go closure failed: ['upstream pay did not pass', 'upstream tim did not pass']
- [g3-slice-code-go] G3 slice code-go must close 86 base and 16 modern named slices
- [module-validators] HRIS-TIM: module validator failed rc=1
- [module-validators] HRIS-PAY: module validator failed rc=1
- [g0-code-checkpoint] --static: authoritative code checkpoint failed rc=1

## G6 분리 원칙

실명 운영 승인, 실제 ERP/은행/세무/보험/타각 계약, 실제 고객 golden/UAT, KR 법정팩/YEA, tenant 용량/SLO/DR과 production secret은 DEFERRED_G6_NOT_CORE_BLOCKER다. 각 capability 또는 tenant의 production 활성화는 계속 fail-closed다.
