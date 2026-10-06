# DWP HRIS 전체 코딩 준비 검증

- 생성시각: 2026-09-11T06:43:23.710121Z
- 검증 모드: LIVE
- 검증 결과: FAIL
- 유효 코드 Gate: BLOCKED
- 보고서 권위: AUTHORITATIVE_LIVE
- 구현 상태: NOT_STARTED_G3
- Production 상태: NOT_AUTHORIZED_G6
- G3 checkpoint digest: 875b3f8f9096bc4840e07a9d4a412f8342950bbad0c05e0312a4b9f703790cea

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
- API PEP proof: PASS / public operations 175 / service-only operations 11 / authorized receipt queries 6
- Transport schema proof: PASS / resolved public operations 175 / self-test PASS
- Cross-module typed schema proof: PASS / contracts 21 / consumer bindings 31 / self-test PASS
- Decimal/money proof: PASS / executable checks 133 / value types 5 / rounding modes 6 / large streams 2 / self-test PASS
- Command receipt proof: PASS / owners 6 / receipt queries 6 / mutation cases 10 / self-test PASS
- Country-pack boundary proof: PASS / rows 11 / Product Core rows 6 / deferred G6 rows 5 / self-test PASS
- Physical ownership proof: PASS / authoritative base+producer 219 / consumer materializations 2 / deploy objects 221 / owner-prefix bindings 10 / self-test PASS
- SYS service-local DDL proof: PASS / Auth tables 7 / Platform tables 25 / self-test PASS / PostgreSQL 16 PASS
- Base schema PostgreSQL proof: PASS / People V1..V46 46 migrations / base owner tables 131 / self-test PASS / PostgreSQL 16 PASS
- Modern exact proof: PASS / 16 capabilities / 100 planned operations / self-test PASS / PostgreSQL 16 PASS / implementation NOT_STARTED_G3
- Integrated IA proof: PASS / nodes 98 / unique routes 98 / self-test PASS
- Named G3 slice proof: PASS / slices 102 (base 86 + modern 16) / self-test PASS
- G5A Design-AI package plan: PASS / PLANNED_NOT_DUE_AFTER_G4 / IA nodes 98 / actual package NOT_RUN_NOT_DUE / self-test PASS
- Architecture: dependencies 19 / cross-cutting owners 23 / G3 allocations 39
- Dependency allocation proof: HRIS-HRM=PASS, HRIS-PER=PASS, HRIS-TIM=PASS, HRIS-PAY=PASS, HRIS-SYS=PASS
- G6 activation rows: 17 / NOT_AUTHORIZED_G6

| 모듈 | Parent | Child | Decision | Validator |
|---|---:|---:|---:|---|
| HRIS-HRM | 583 | 1654 | 15 | PASS |
| HRIS-PER | 349 | 1041 | 16 | PASS |
| HRIS-TIM | 568 | 3566 | 16 | PASS |
| HRIS-PAY | 580 | 3515 | 18 | PASS |
| HRIS-SYS | 189 | 225 | 13 | PASS |

## 검증 그룹

| 그룹 | Checks | Errors |
|---|---:|---:|
| api-pep-bindings | 9 | 0 |
| architecture-documents | 118 | 0 |
| architecture-registers | 526 | 0 |
| base-schema-postgres-feasibility | 14 | 0 |
| baseline-command-evidence | 497 | 66 |
| command-receipt-contracts | 20 | 0 |
| country-pack-boundaries | 12 | 0 |
| cross-module-contracts | 403 | 0 |
| cross-module-schema-contracts | 9 | 0 |
| decimal-money-contract | 15 | 0 |
| delivery-architecture | 558 | 0 |
| g0-code-checkpoint | 5 | 2 |
| g3-slice-code-go | 9 | 0 |
| g5a-design-ai-package-contract | 36 | 0 |
| gate-separation | 283 | 0 |
| information-architecture | 26 | 0 |
| migration-ranges | 40 | 0 |
| modern-capability-scope | 334 | 0 |
| modern-exact-contracts | 150 | 0 |
| module-validators | 15 | 0 |
| owners | 304 | 0 |
| physical-owner-prefixes | 5 | 0 |
| source-g1-g2 | 165671 | 0 |
| source-provenance | 5 | 0 |
| sys-service-local-migrations | 10 | 0 |
| target-family-resolution | 6 | 0 |
| trace-semantics | 7 | 0 |
| transport-schema-resolution | 12 | 0 |

## Blocker

- [baseline-command-evidence] DWP_BACKEND: integration worktree dirty
- [baseline-command-evidence] worktree line 2: live dirty state
- [baseline-command-evidence] backend: capture script or input registry attestation drift
- [baseline-command-evidence] frontend: capture script or input registry attestation drift
- [baseline-command-evidence] frontend: command evidence reports failure
- [baseline-command-evidence] CHK-FE-INSTALL: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-INSTALL: baseline tree drift
- [baseline-command-evidence] CHK-FE-INSTALL: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-INSTALL: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-INSTALL: declared summary drift
- [baseline-command-evidence] CHK-FE-PACKAGE-MANAGER: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-PACKAGE-MANAGER: baseline tree drift
- [baseline-command-evidence] CHK-FE-PACKAGE-MANAGER: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-PACKAGE-MANAGER: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-ARCH: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-ARCH: baseline tree drift
- [baseline-command-evidence] CHK-FE-ARCH: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-ARCH: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-ARCH: declared summary drift
- [baseline-command-evidence] CHK-FE-TYPE: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-TYPE: baseline tree drift
- [baseline-command-evidence] CHK-FE-TYPE: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-TYPE: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-TYPE: declared summary drift
- [baseline-command-evidence] CHK-FE-TEST: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-TEST: baseline tree drift
- [baseline-command-evidence] CHK-FE-TEST: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-TEST: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-TEST: declared summary drift
- [baseline-command-evidence] CHK-FE-BUILD: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-BUILD: baseline tree drift
- [baseline-command-evidence] CHK-FE-BUILD: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-BUILD: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-BUILD: declared summary drift
- [baseline-command-evidence] CHK-FE-LICENSE: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-LICENSE: baseline tree drift
- [baseline-command-evidence] CHK-FE-LICENSE: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-LICENSE: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-CONTRACT: exit code is not zero
- [baseline-command-evidence] CHK-FE-CONTRACT: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-CONTRACT: baseline tree drift
- [baseline-command-evidence] CHK-FE-CONTRACT: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-CONTRACT: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-CONTRACT: declared summary drift
- [baseline-command-evidence] CHK-FE-CLOSURE-TEST: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-CLOSURE-TEST: baseline tree drift
- [baseline-command-evidence] CHK-FE-CLOSURE-TEST: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-CLOSURE-TEST: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-RELEASE-CONTRACT-TEST: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-RELEASE-CONTRACT-TEST: baseline tree drift
- [baseline-command-evidence] CHK-FE-RELEASE-CONTRACT-TEST: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-RELEASE-CONTRACT-TEST: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-READINESS-TEST: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-READINESS-TEST: baseline tree drift
- [baseline-command-evidence] CHK-FE-READINESS-TEST: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-READINESS-TEST: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-SECURITY-AUDIT: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-SECURITY-AUDIT: baseline tree drift
- [baseline-command-evidence] CHK-FE-SECURITY-AUDIT: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-SECURITY-AUDIT: observed post Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-SBOM: baseline HEAD drift
- [baseline-command-evidence] CHK-FE-SBOM: baseline tree drift
- [baseline-command-evidence] CHK-FE-SBOM: observed pre Git identity differs from baseline
- [baseline-command-evidence] CHK-FE-SBOM: observed post Git identity differs from baseline
- [baseline-command-evidence] frontend: evidence predates baseline capture
- [baseline-command-evidence] CHK-BE-SBOM: actual canonical graph differs from attestation
- [g0-code-checkpoint] --static: authoritative code checkpoint failed rc=1
- [g0-code-checkpoint] --check-live: authoritative code checkpoint failed rc=1

## G6 분리 원칙

실명 운영 승인, 실제 ERP/은행/세무/보험/타각 계약, 실제 고객 golden/UAT, KR 법정팩/YEA, tenant 용량/SLO/DR과 production secret은 DEFERRED_G6_NOT_CORE_BLOCKER다. 각 capability 또는 tenant의 production 활성화는 계속 fail-closed다.
