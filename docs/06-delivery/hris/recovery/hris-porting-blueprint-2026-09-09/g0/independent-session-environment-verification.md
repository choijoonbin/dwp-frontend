# HRIS 독립 세션 환경 검증 기록

기준시각: worktree identity 2026-09-11T02:38:44Z / command evidence 2026-09-10T14:12:34Z  
범위: `HRIS-HRM`, `HRIS-PER`, `HRIS-TIM`, `HRIS-PAY`, `HRIS-SYS`와 `Integration Control`  
판정 용도: G3 코딩을 시작하기 전 각 세션이 자기 작업공간에서 독립적으로 빌드·테스트할 수 있는지 확인하는 실행 기록

이 문서는 기능 구현 완료 증거가 아니다. 아래 명령 표는 이전 code-entry에서 얻은 역사적 실행 기록이고 current frontend successor의 기계 증거를 대신하지 않는다. 최종 Gate는 새 `session-environment-evidence.json`과 target command evidence를 캡처한 뒤 Integration Control의 `transition_g3_gate.py --open`이 전역 4단계 후보 검증과 최신 `COMMITTED_OPEN_AUTHORITATIVE_LIVE` 전환행을 한 번에 봉인하고 authority check가 PASS할 때만 열린다.

## 1. 작업공간 격리

- 모듈 5개와 Integration Control에 backend/frontend를 각각 분리해 총 12개 등록 worktree를 사용한다.
- 모듈 backend는 모두 code-entry SHA `6f1ed92d2610ace3df75f094297032e8b476ef5d`, tree `fab2e1441d2ab224ae93b14978c282eff93973be`로 일치하고 검증 시점에 clean이다.
- 모듈 frontend는 모두 current code-entry SHA `c2b3b951ccd2e1a1ce38797bbbfeedef2a897036`, tree `157fdc60d3c1c834d1f9388d68f3f1c973a2e66a`로 일치하고 검증 시점에 clean이다. characterization predecessor `7635ce4223000ed83cb4965f8374d8a8433f1a62`은 lineage에 별도 보존한다.
- 각 세션에는 backend agent evidence, official frontend contract, OpenAPI compatibility 용도의 read-only 고정 worktree 3개가 있다. Control을 포함해 총 18개이며 SHA/tree/clean 상태는 `session-support-worktree-register.csv`에 고정한다.
- 과거 `/hris/<module>/{backend,frontend}` 작업공간은 `SUPERSEDED_DO_NOT_USE`이며 코드, 증거, 병합에 사용하지 않는다.

## 2. 이전 baseline 세션별 실행 확인

| 세션 | Backend 이전 실행 | 결과 | Frontend 이전 실행 | 결과 |
|---|---|---|---|---|
| HRIS-HRM | `./gradlew check --no-daemon` | PASS, 90/90 tasks executed | immutable install, architecture, typecheck, full test | PASS, 570 files / 4,644 tests |
| HRIS-PER | `./gradlew :dwp-people-server:test --no-daemon` | PASS, 13/13 tasks executed | immutable install, architecture, typecheck, bounded full test | PASS, 570 files / 4,644 tests |
| HRIS-TIM | `./gradlew :dwp-time-server:bootJar :dwp-time-server:test --no-daemon` | PASS, executable jar and context smoke | immutable install, architecture, typecheck, bounded full test | PASS, 570 files / 4,644 tests |
| HRIS-PAY | `./gradlew :dwp-payroll-server:bootJar :dwp-payroll-server:test --no-daemon` | PASS, executable jar and context smoke | immutable install, architecture, typecheck, bounded full test | PASS, 570 files / 4,644 tests |
| HRIS-SYS | `./gradlew :dwp-auth-server:test :dwp-platform-server:test --no-daemon` | PASS, 23/23 tasks executed | immutable install, architecture, typecheck, bounded full test | PASS, 570 files / 4,644 tests |

Frontend bounded full test 명령은 다음과 같이 고정한다.

```text
/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  /opt/homebrew/opt/node@20/bin/yarn test --maxWorkers=4 --maxConcurrency=2
```

한 호스트에서 여러 full frontend suite를 동시에 실행하면 HRIS와 무관한 비동기 UI 테스트가 자원 경합으로 간헐 실패할 수 있음을 확인했다. 따라서 모듈 세션은 변경 영향 범위 테스트를 병렬 수행할 수 있지만, 전체 frontend suite·build·security audit·SBOM은 Integration Control의 단일 semaphore 아래 순차 실행한다.

## 3. 세션이 독립적으로 보유하는 것

각 모듈 세션은 다음 입력을 자기 경로에서 읽고 검증할 수 있다.

1. 동일한 backend/frontend code-entry baseline
2. immutable frontend dependency graph와 설치된 `node_modules`
3. 고정된 agent evidence, official contract, OpenAPI compatibility checkout
4. 모듈별 source coverage, G1 characterization, G2 schema/API/event/state/auth/golden 계약
5. 모듈별 allowed/forbidden path, exact migration allocation, G3 slice token과 검증 명령
6. G4 runbook, telemetry, migration, recovery, acceptance evidence 출력 경로
7. G4 완료 후 전체 화면 Design AI 프롬프트와 검증 ZIP을 만드는 G5A 출력 계약

## 4. 중앙 통합이 소유하는 것

독립 세션은 중앙 파일을 직접 수정하지 않는다. `Integration Control`만 root build 설정, gateway, shared contract, frontend navigation/manifest, architecture rule, 공통 i18n, migration allocation, 최종 전체 검증과 병합을 소유한다. 모듈이 중앙 변경을 요청할 때는 해당 모듈 checkpoint에 결박된 제안 artifact를 제출하며, Control은 다른 commit의 제안을 재사용할 수 없다.

## 5. 실행 전 필수 확인

각 세션은 첫 코드 변경 직전에 게시된 전역 seal과 자기 paired worktree만 확인하는 아래 scoped 3단계를 정확한 순서로 실행한다.

HRM:

```text
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-HRM
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-HRM
```

PER:

```text
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-PER
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-PER
```

PAY:

```text
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-PAY
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-PAY
```

TIM:

```text
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-TIM
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-TIM
```

SYS:

```text
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/gate_authority.py --check-open --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_published_gate_truth.py --verify-seal-only --compact
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/g0/validate_code_checkpoint.py --check-live --session HRIS-SYS
python3 /Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/validate_full_coding_readiness.py --check-live --session HRIS-SYS
```

모듈 세션은 unscoped 전역 `--check-live`를 실행하거나 scoped 검증에 `--write-report`를 결합하지 않는다. 네 단계 중 하나라도 실패하거나 해당 slice의 `G3-CODE-GO-<slice-id>`가 없으면 수정하지 않는다. 현재 구현 상태는 `NOT_STARTED_G3`, 운영 상태는 `NOT_AUTHORIZED_G6`를 유지한다.
