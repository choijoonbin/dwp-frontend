# DWP HRIS 전체 코딩 준비도 및 5개 세션 실행안

기준일: 2026-09-11  
현재 Gate: **`VALIDATOR_CONTROLLED` / 현재 `BLOCKED`**  
구현 상태: `NOT_STARTED_G3`  
Production 상태: `NOT_AUTHORIZED_G6`

이 문서는 과거 G1 준비 시점의 실행안을 대체한다. 현재 판독 순서는 [전체 코딩 준비 정본](./coding-readiness/README.md), [최신 live 리포트](./coding-readiness/reports/full-coding-readiness-latest.md), [G3 전체 코딩 실행 계약](./session-prompts/07-g3-full-coding-execution-contract.md) 순이다. `transition_g3_gate.py --open`이 두 live validator와 published-truth normal/self-test를 내부 실행하고 최신 전환행을 `COMMITTED_OPEN_AUTHORITATIVE_LIVE`로 커밋한 뒤 `gate_authority.py --check-open`이 PASS할 때만 해당 시점의 착수 권한이 유효하다. 네 후보 검증 결과나 보고서만으로는 권위가 생기지 않는다. 현재 재봉인 중에는 `BLOCKED`다.

## 1. 준비도 판정

범용 HRIS core의 설계·추적 G2 준비는 닫혔다. 실제 전체 기능 코딩 착수는 authoritative live Gate가 다시 PASS할 때까지 차단되며, 다음 상태를 동시에 검증한다.

- source parent 2,269건은 5개 모듈에 정확히 한 번씩 배정됐고 전부 disposition·owner·acceptance evidence가 결정됐다. `UNKNOWN / UNASSESSED=0`이다.
- source 행위를 해체한 child trace 10,001건이 target journey·API·event·data·test에 연결됐다.
- 모듈별 물리 schema blueprint, API/event, state/guard/recovery, 권한, synthetic golden, validator가 준비됐다.
- backend code-entry `787f25753a72dc5f0fbbb06783205c0bff6635a5`, frontend code-entry `c658679ef377f43ec4f9fec7e7433eb98f46970e`를 clean baseline으로 고정했다. backend `5670877de7a39e94e75021c7e23cbbb553296c90`과 frontend `7635ce4223000ed83cb4965f8374d8a8433f1a62`은 source-characterization predecessor로만 보존한다.
- 12개 control/module paired worktree, 소유 경로, 중앙 single-writer, Flyway 구간, build 및 회귀 조건이 사전 할당됐다.
- authoritative LIVE Gate가 PASS한 경우에도 그 의미는 코딩 착수 준비가 검증됐다는 것뿐이며 기능 구현·수용·디자인·운영 활성화 완료를 뜻하지 않는다.

## 2. 5개 세션과 target runtime

5개 세션은 SKKF source 분석·이관 책임 분할이며 SKKF의 서비스를 그대로 5벌 복제하는 구조가 아니다. target은 DWP bounded context와 현재 플랫폼 책임을 기준으로 나눈다.

| 세션 | Parent | Child | target runtime | Frontend feature root | Migration 구간 | Gate |
|---|---:|---:|---|---|---|---|
| HRIS-HRM | 583 | 1,654 | `dwp-people-server` | `features/hris/{people,organization,employee-services}` | 공통 People V47–V50 이후 HRM V51–V73 | `VALIDATOR_CONTROLLED` |
| HRIS-PER | 349 | 1,041 | `dwp-people-server/hris/performance` | `features/hris/performance` | 별도 Performance stream V1–V63 | `VALIDATOR_CONTROLLED` |
| HRIS-TIM | 568 | 3,566 | 신규 `dwp-time-server` | `features/hris/{time,leave}` | Time V1–V39 | `VALIDATOR_CONTROLLED` |
| HRIS-PAY | 580 | 3,515 | 신규 `dwp-payroll-server` | `features/hris/payroll` | Payroll V1–V49 | `VALIDATOR_CONTROLLED` |
| HRIS-SYS | 189 | 225 | Auth / Platform / Gateway / Audit 확장 | `features/hris/{shell,home,explorer,administration,integrations}` | Auth V217–V245, Platform V262–V290 | `VALIDATOR_CONTROLLED` |
| **합계** | **2,269** | **10,001** |  |  |  |  |

SYS 전용 `dwp-sys-server`는 만들지 않는다. PER는 People runtime 안에서 독립 `db/performance-migration` location, `hris_performance` schema와 별도 history table을 사용하며 package·contract 경계를 유지한다. 기존 migration은 수정하지 않고 owner가 등록된 stream·range·slice reservation에 create-only migration을 추가한다.

## 3. 구현 아키텍처

### Frontend

- `features/hris/<domain>/{routes,pages,components,api,model,forms,hooks,testing}`로 나누고 public API 밖의 타 도메인 내부 import를 금지한다.
- page/route가 transport를 직접 호출하지 않고 feature hook과 typed API adapter를 거친다. 정본 import edge는 `coding-readiness/module-structure-contract-register.csv`를 따른다.
- tenant, actor, context scope, field policy, as-of/effective date를 cache key와 요청에 포함하고 scope 변경 시 stale request와 민감 cache를 fail-closed 처리한다.
- loading, empty, validation, 401/403, 409, stale, partial failure, result-unknown, retry/receipt를 정상 상태로 모델링한다.
- HRIS 홈은 메뉴 목록이 아니라 권한·범위별 인사·근태·급여·성과 핵심 정보와 할 일 위젯으로 구성한다. 전체 기능 탐색은 `/hr/explore`로 분리한다.
- 사이드바는 권한별 기본 진입점과 모듈 workbench만 우선 노출하고 세부 기능은 검색·즐겨찾기·최근·진행 중·탭/드로어/스텝으로 점진 공개한다.

### Backend

- 서비스별 `domain`, `application`, `adapter/in`, `adapter/out`, `config`로 나누고 domain에 Spring/JPA/HTTP 타입을 넣지 않는다.
- 서비스 간 DB FK·join·repository import를 금지하고 public UUID, versioned API/event, outbox/inbox, projection으로 연결한다.
- 모든 command는 tenant, actor, purpose, idempotency key, expected version/CAS, correlation/causation을 받고 동기 결과 또는 비동기 receipt를 반환한다.
- 인사 효력일은 `[from,to)`로 처리하고 확정된 근태·휴가·급여 결과는 append-only ledger와 correction/reversal로만 변경한다.
- policy·formula·form·configuration은 draft→simulate→approve→publish→rollback 생명주기, effective date, version, four-eyes 통제를 갖는다.
- import/export/job/connector는 중앙 플랫폼의 타입 지정 handler 및 receipt 계약을 사용하고 임의 class/method·SQL 실행을 금지한다.

## 4. 권한·보안 경계

권한은 다음 교집으로 판정하며 UI 숨김을 보안 경계로 사용하지 않는다.

```text
APP.HCM canonical entitlement(APP.HRIS compatibility alias)
  ∩ 31 risk/duty access packages
  ∩ 128 atomic duties(base 67 + modern 48 + IA initial-read 13; resource/action)
  ∩ population scope
  ∩ field decision(VIEW/MASK/OMIT)
  ∩ purpose
  ∩ SoD·step-up 조건
```

직원·관리자·업무운영자·설정관리자·전사감사자의 5개 logical category는 UI와 권한 카탈로그를 이해하기 위한 분류이며 runtime role이나 허용 조건이 아니다.

각 slice는 다른 tenant, 범위 밖 직원, 자기승인, 만료 권한, 민감 field, export, 대량작업의 negative test를 포함한다. 급여·계좌·세무·건강·가족·장애·노무 정보는 최소수집, 암호화, 마스킹, 보존/파기, legal hold, 접근감사를 강제한다.

## 5. 통합 통제와 실행 순서

정확한 실행 구조는 **5개 모듈 세션 + 1개 Integration Control**이다. Integration Control만 backend `settings.gradle`, `contracts/**`, `dwp-gateway/**`, frontend 중앙 routes/navigation/manifest, `architecture/**`, `libs/api-contracts/**`, 공통 i18n을 병합한다. 모듈 세션은 자기 worktree·allowed glob·migration 구간만 수정한다.

```text
SYS + HRM 공통 계약
       ├─ PER consumer·기능 구현
       └─ TIM consumer·기능 구현
HRM compensation snapshot + TIM closed result
       └─ PAY mock-first consumer·기능 구현
모든 small vertical slice
       └─ Integration Control 계약·build·권한·보안·회귀 검증
```

1. SYS와 HRM이 app entitlement, access package, 공통 type/event envelope, Person/Worker/Employment/Assignment/Organization snapshot을 먼저 정의·구현한다.
2. PER와 TIM은 provider/consumer contract test를 먼저 고정한 뒤 병렬로 구현한다.
3. PAY는 HRM compensation snapshot과 TIM closed-result를 mock provider로 먼저 연결하고 생산자 slice 통합 후 실제 consumer로 전환한다.
4. 마지막 대형 merge를 만들지 않고 계약→수직 slice→즉시 통합→전체 matrix 순으로 반복한다.

## 6. 모듈별 구현 방향

| 모듈 | G3 핵심 범위 | 핵심 제약 |
|---|---|---|
| SYS | HRIS shell, 위젯 홈, `/hr/explore`, 권한 projection, 설정 lifecycle, 중앙 automation, connector control | 별도 SYS service 금지; 중앙 platform을 확장 |
| HRM | Person/Worker/Employment/Assignment/Org, 효력일·correction, 직원 서비스·case, public snapshot | DWP People SOR을 보존; 대체 인사 원장 중복 생성 금지 |
| PER | 목표, 평가 주기, review, calibration, 결과 공개/동결 | HRM snapshot 소비; 추후 추출 가능한 경계 |
| TIM | schedule, raw clock, interpretation, time/leave ledger, 마감/재개방, payroll handoff | 원시 타각과 해석결과 분리; 확정값 append-only |
| PAY | snapshot, versioned formula, calculation/ledger, statement, payment, GL/statutory provider | 실제 KR/YEA/은행/세무는 G6; G3는 provider-neutral SPI와 TEST_ONLY pack |

BENSK는 제외하고 ADDSK 식별 분기는 core에 넣지 않는다. 레거시 화면·테이블을 1:1로 복제하지 않고 같은 persona·aggregate·권한·상태전이를 가진 업무는 통합한다. 고객사 하드코딩, 중복·old/test route, client-side 우회, 수동 보정 프로세스는 제거하거나 통제된 예외 workbench로 재설계한다.

## 7. G3 core와 G6 activation의 분리

G3에서 구현하는 범위는 Product Core, provider-neutral country-pack/connector SPI, typed tenant configuration, signed extension framework, synthetic fixture다. 다음 실제 자료는 해당 어댑터·국가팩·테넌트의 G6 활성화 조건이며 core G3 blocker가 아니다.

- 운영 메뉴·프로그램·권한·접근 로그: 정확한 legacy parity나 특정 gap 조사에만 조건부 필요
- 레거시 DDL·batch 실행자료: 계약된 source data migration 또는 운영 대사에만 조건부 필요
- ERP·은행·세무·보험·타각·고객 legacy 계약·credential·SLA: 해당 connector 활성화 전 필수
- 실제 근무제·급여군·평가주기·고객 golden/UAT: 해당 tenant 전환 전 필수
- KR 법정값·시행일·반올림·신고포맷·YEA 소유경계: KR/YEA capability 활성화 전 필수
- 용량·SLO·RTO/RPO·DR·production secret과 Product/HR/급여/근태/성과/DBA/Security/Privacy/SRE/운영 실명 승인: production 활성화 전 필수
- 과거 V24-era 역할을 가진 기존 Approval 운영 DB: principal inventory, `rolinherit=false` 전환 또는 controlled role rebuild, membership·ownership·cluster/database ACL 전후 diff, schema-history/ownership digest, backup restore point, strict restart, rollback rehearsal와 실명 DBA·Security·SRE release 승인 후에만 해당 DB 활성화

이 자료가 없는 기간에도 mock transport, TEST_ONLY country pack, synthetic golden으로 core를 구현·검증할 수 있다. 단, 실제 endpoint·법정결과·고객 tenant·production은 fail-closed로 유지한다.

Approval legacy-role 조건도 같은 분리 원칙을 따른다. fresh/disposable DB에서 clean migration, `NOINHERIT` role invariant와 strict ACL negative test를 수행하는 G3는 차단하지 않는다. `ACT-G6-APPROVAL-LEGACY-ROLE-HARDENING` 증거가 없는 경우에는 영향을 받는 기존 Approval production DB만 fail-closed하며, 모듈 세션이나 application startup이 운영 역할/ACL을 임의 복구하지 않는다.

## 8. 코딩 착수 및 slice 종료 조건

전역 Gate의 최초 개방과 재봉인은 Integration Control의 `transition_g3_gate.py --open`만 수행한다. 각 모듈 세션은 코드를 수정하기 직전에 최신 권위 전환행과 게시된 전역 seal을 확인한 뒤 **자기 session ID가 지정된** 두 scoped live 검증만 실행한다. 다른 모듈의 정상적인 작업 중 변경 때문에 오차단되거나 전역 보고서를 덮어쓰지 않도록 아래 네 명령의 순서와 session ID를 바꾸지 않는다.

HRM:

```bash
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-HRM
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-HRM
```

PER:

```bash
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-PER
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-PER
```

PAY:

```bash
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-PAY
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-PAY
```

TIM:

```bash
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-TIM
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-TIM
```

SYS:

```bash
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-SYS
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-SYS
```

모듈 세션은 scoped 검증에 `--write-report`를 결합하거나 unscoped `--check-live`를 대신 실행하지 않는다. 네 명령 중 하나라도 실패하면 코딩을 시작하지 않고 Integration Control이 baseline·계약·worktree drift를 해결한다. 각 vertical slice는 다음을 모두 만족해야 닫힌다.

- 관련 parent/child trace가 구현·테스트·retire 증거에 연결됨
- schema/API/event/state/authorization/golden 계약과 코드가 일치함
- unit, integration, contract, property, tenant-negative, security, reconciliation 테스트가 통과함
- telemetry, audit, receipt, runbook, rollback 또는 forward-correction 경로가 존재함
- 중앙 build matrix와 architecture/security 검증이 통과함
- 완료·부분완료·활성화 차단을 구분하고 화면/파일 수로 완료율을 주장하지 않음

신규·변경 dependency가 있는 slice에만 SBOM diff, 취약점, license/notice/source-offer, transitive 영향 검토를 조건부로 실행한다. dependency를 바꾸지 않는 slice의 상시 blocker로 두지 않는다.

## 9. 화면 디자인 후속 Gate

G3/G4에서는 기능, 정보구조, 상태, 권한, 접근성, 반응형을 검증할 최소 semantic UI를 구현하고 최종 시각 디자인은 확정하지 않는다. 각 모듈이 G4를 통과하면 [Design AI 전달 계약](./session-prompts/90-design-ai-handoff-output-contract.md)에 따라 모듈 전체 메뉴·화면·상태·persona·권한 variant를 포함한 프롬프트 설계서와 검증 ZIP을 만든다.

- `G5A DESIGN_REQUEST_READY`: 전체 화면 프롬프트 패키지 완료
- `G5B DESIGN_ACCEPTED`: editable 원본과 프레임·컴포넌트·토큰·상호작용 수령 후 사용자·제품 owner 승인
- `G5C VISUAL_REPLACEMENT_COMPLETE`: 승인 디자인 교체 후 기능·권한·상태·접근성·반응형·시각 회귀 통과

## 10. 최종 결론

설계·추적·실행 계약은 준비됐지만 현재 live 재봉인이 끝나지 않아 5개 세션의 코드 착수는 `BLOCKED`다. `transition_g3_gate.py --open`이 후보 검증과 publication digest를 한 전환으로 봉인하고 최신 전환행이 `COMMITTED_OPEN_AUTHORITATIVE_LIVE`, `gate_authority.py --check-open`이 PASS인 경우에만 등록 baseline과 소유 범위 안에서 G3를 시작한다. 구현은 아직 시작되지 않았고, G4 기능 수용·G5 디자인·G6 실제 국가팩/연계/고객/production 활성화는 서로 다른 후속 Gate다.
