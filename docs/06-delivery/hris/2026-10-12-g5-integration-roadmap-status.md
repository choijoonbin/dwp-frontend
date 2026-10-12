# 2026-10-12 HRIS G5 통합 로드맵 상태 Successor

> 상태: G5 complete and frozen; G6 authorized, not run
>
> 기준일: 2026-10-12
>
> 선행 정본: [G4 통합 로드맵 상태 Successor](2026-10-07-g4-integration-roadmap-status.md)
>
> G5 판정: [G5 Integrated Stabilization Freeze Receipt](2026-10-12-g5-integrated-stabilization-freeze-receipt.json)

G5는 Backend `c0d72ca8e26a6e2a0b3885b62c0aa0e3ad7b1329`, Frontend source result
`c05ffa3f9d647968fdcb224ec51f811c7d2cc538`, Agent
`1d46fc4ab49c604efb7464574c49d13ee453e059`를 clean·pushed 상태로 고정했다. Authorization은
v34 checksum `852d20e1e639e1a7170f02b5714d21d8c51a9eb8ff5ac32d8b7940b82d6be83b`이고,
Gateway OpenAPI는 1,664 paths, 1,904 operations, 3,682 schemas, SHA-256
`325fd7acfcf0ed42cd03db0105003c6a53d8434467e594e023d227c64b734856`로 Frontend와 Backend가
byte 동일하다. Home과 한글·영문 runtime에서 앱 이름은 모두 `HRIS`다.

## Gate 상태

| 단계                       | 상태                 | 다음 권한                                                                 |
| -------------------------- | -------------------- | ------------------------------------------------------------------------- |
| G4 Frontend 의미 통합      | `COMPLETE`           | G5 입력으로 고정됨                                                        |
| G5 통합 안정화·동결        | `COMPLETE_FROZEN`    | 최종 evidence-carrier commit에서 G6 W1 1회 실행 가능                      |
| G6 W1 Successor            | `AUTHORIZED_NOT_RUN` | full mode 1회 PASS 후 G7 promotion 검토 가능                              |
| G7 Evidence Promotion·위임 | `NOT_AUTHORIZED`     | G6 PASS, frozen evidence pin, packet·start token 발급 전 module work 금지 |

## G5 동결 결과

- Backend isolated Auth·Platform OpenAPI export, People·PAY·TIM enabled-owner parity, clean install,
  기존 DB upgrade, owner persistence와 restart acceptance가 PASS다.
- Backend code-contract audit는 170/170이며 runtime smoke, OpenAPI exact check, production/test
  source-size exact gate가 PASS다.
- Frontend immutable install, TypeScript, i18n, display contract, design-system adoption, main bundle
  budget와 product isolation을 닫았다.
- Frontend 전체 Vitest는 1,083 files / 8,367 tests PASS다. 제품 화면 browser 결과는 최종 합성
  152 PASS / 12 expected skip이며 최초 20개 실패는 모두 원인별 targeted closure로 닫았다.
- 16개 product build와 8개 built-product runtime artifact가 합성 PASS이며 performance budget은
  실제 비활성 SPA route 전환으로 1/1 PASS다.
- Agent는 source 또는 소비 contract pin 변경이 없어 clean baseline을 재사용한다. Agent에는 아직
  canonical HRIS module slice나 개발 권한이 없다.

## G5 Exit Gate 증거

최종 Gateway snapshot과 Authorization v34 bundle/index는 frozen Backend에서 재산출한 byte를
Frontend가 그대로 소비한다. Frontend main initial bundle은 raw 1,073.5/1,074.2 KiB,
gzip 310.1/317.4 KiB, 4/5 requests로 budget 안이다. production source inventory는 3,528개와
generated 4개, maintenance inventory는 516개와 legacy exception 12개로 exact gate를 통과했다.

G5 receipt는 source result를 pin한다. 이 문서와 receipt를 싣는 carrier commit은 자기 자신을
receipt 안에서 pin할 수 없으므로, G6 runner가 실제 최종 pushed frontend HEAD와 clean state를
직접 기록해야 한다. G6 이후 repository file을 수정하지 않고 그 실행 결과를 G7 promotion 입력으로
사용한다.

## 수정·재검증 효율화 기록

Broad gate는 candidate당 한 번만 실행했다. Backend의 approval readiness 4건, Frontend의 unused
export·design token, Approvals product isolation, Workspace chunk cycle, performance journey는 각각
동일 원인 cluster로 묶어 수정했다. 수정 뒤에는 해당 cluster와 필수 downstream compile/bundle만
재검증했고, 영향이 없는 전체 Backend·Vitest·product-surface browser suite는 다시 실행하지 않았다.

## G6 정확히 한 번 실행 경계

G6는 모든 저장소가 committed·pushed·clean이고 Docker가 준비된 뒤 Backend runner를 full mode로
정확히 한 번 실행한다. `--skip-build`, `--auth-only` 또는 부분 실행은 허용하지 않는다. 성공은
`BACKEND_RUNTIME_SUBGATE_PASS`, 15개 unique PASS assertion, v34 exact binding, v33 rollback,
clean teardown, secret scan PASS, synthetic-only, customer data 미사용과 production activation 미수행을
모두 만족해야 한다.

## G7 권한 경계

[G7 Module Delegation Preflight](2026-10-07-g7-module-delegation-preflight.json)는 102개 work row와
SYS-007, HRM-010, PER-006, TIM-006, PAY-016 후보를 정리한 read-only 준비물이다. 현재 모든 packet은
`WITHHELD`, start token은 비어 있고 module-parallel authority는 `false`다. G6가 PASS해도 곧바로
모듈 세션이 시작되는 것은 아니다. G7에서 frozen evidence, packet ID, owner/reviewer, base pin,
dependency/producer pin, exact touch set과 필요한 JIT migration lease를 별도 promotion receipt로
발급한 뒤에만 해당 모듈이 작업을 시작할 수 있다. PAY는 `MOD-PER-COMPPLAN` producer pin과 선행
의존성이 닫힐 때까지, Agent는 deterministic owner API/tool contract와 canonical slice가 생길 때까지
계속 보류한다.
