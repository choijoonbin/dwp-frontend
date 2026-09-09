# DWAI·ON 21개 화면 기능·API·권한 독립 감사 · 2026-09-09

## 정정 결론

이 문서는 2026-09-09의 독립 재검증 결과로 이전 초안을 대체한다. 현재 DWAI·ON을
**디자인 전달분과 기능·메뉴가 모두 개발 완료된 제품**으로 판정할 수 없다.

- 21개 Stitch 상태의 화면 진입점은 모두 존재하지만 엄격한 시각 판정은
  **PASS 0 / PARTIAL 21 / FAIL 0**이다.
- 구현된 대표 흐름은 **지원 범위 PASS 18 / capability PARTIAL 3**이다. Stitch가 표현한
  설계/API 전체 완결성은 **PASS 0 / PARTIAL 21**이다.
- v6 Product Authorization 계약은 DWAI·ON 95개 경로를 포함하고 테스트를 통과했지만
  bundle이 `DRAFT`이고 rollout flag가 비활성이라 production enforcement 완료가 아니다.
- 관리형 Gateway → Agent `:8010`의 실제 브라우저 조회·분석·결정 mutation은 확인했다.
  이는 local live integration 증거이며 production 배포 증거는 아니다.

화면별 시각·기능·API·권한·production 통합 판정은 다음 독립 감사가 정본이다.

- `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/independent-release-gate/audit.md`
- `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/independent-release-gate/manifest.json`

## 권한 계약의 현재 범위

| 계층             | DWAI·ON 소유 경로 | PAGE | DATA | ACTION | 현재 판정                                    |
| ---------------- | ----------------: | ---: | ---: | -----: | -------------------------------------------- |
| v6 제품 정본     |                95 |   14 |   24 |     57 | 계약·생성 검증 PASS, bundle `DRAFT`          |
| Agent owner PEP  |                88 |   13 |   23 |     52 | exact route/context/scope/revision 검증 PASS |
| Platform A02 PEP |                 7 |    1 |    1 |      5 | expected revision 포함 검증 PASS             |

- Frontend governed mutation binding은 **57/57**이다.
- 현재 UI에서 직접 호출하는 route key invoker는 **55/57**이다. 비스트리밍 Ask와
  domain-retention-update는 현재 UI 호출자가 없지만 OpenAPI와 owner PEP는 fail-closed다.
- checksum은
  `7cf8602aa2da5f7a0464b23cfd84a8f381e2d3eb85333ed8a8e483865b2b0abe`다.
- Gateway OpenAPI composer의 v6 반영과 Platform A02 mutation의 expected-revision header 누락을
  수정했다.

세부 경로와 생성 근거는 다음 산출물에 있다.

- `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/authorization-closure/README.md`
- `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/authorization-closure/route-coverage.md`
- `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/authorization-closure/verification.md`

## 화면별 기능·API 판정

| ID      | 화면                | 기능    | API           | 권한        | 현재 한계                                                                         |
| ------- | ------------------- | ------- | ------------- | ----------- | --------------------------------------------------------------------------------- |
| U01     | 홈                  | PASS    | PASS_CONTRACT | PASS_TESTED | 정본의 provenance·confidence·guardrail telemetry 일부 미제공                      |
| U02     | 새 대화             | PASS    | PASS_CONTRACT | PASS_TESTED | 정본 500자와 현재 4,000자 계약, source toggle·동기화 정보 차이                    |
| U03     | 답변·근거           | PASS    | PASS_CONTRACT | PASS_TESTED | citation match %, PII·보존 충돌, token·audit 상세 미제공                          |
| U04     | 내 대화             | PASS    | PASS_CONTRACT | PASS_TESTED | 실제 17건 list/detail·rename/delete는 동작, 정본 메타데이터 일부 미제공           |
| U05     | AI 제안함           | PASS    | PASS_CONTRACT | PASS_TESTED | analyze/list/preference/clear는 동작, engine version·continuous monitoring 미제공 |
| U06     | 제안 검토           | PASS    | PASS_CONTRACT | PASS_TESTED | decision·revision은 동작, mail excerpt·match %·readiness 일부 미제공              |
| U07     | 전문 에이전트       | PARTIAL | PARTIAL       | PASS_TESTED | registry metadata는 실제, model/provider runtime health 미제공                    |
| U08     | 업무 실행 및 연결   | PARTIAL | PARTIAL       | PASS_TESTED | preview·명시 인계는 실제, owning app 실제 mutation은 미검증                       |
| U09     | AI 실행 이력        | PASS    | PASS_CONTRACT | PASS_TESTED | run snapshot은 실제, immutable attempt history·완전한 audit linkage 미제공        |
| U10     | 전역·음성 Assistant | PARTIAL | PARTIAL       | PASS_TESTED | 계약은 실제, 장치·codec·운영 STT/TTS provider 미검증                              |
| X01     | 나의 AI 루틴        | PARTIAL | PARTIAL       | PASS_TESTED | CRUD·동의·validation-only dry-run만 실제, background 실행기 없음                  |
| X02     | 개인 AI 제어        | PARTIAL | PARTIAL       | PASS_TESTED | 활성 PostgreSQL 물리 purge는 실제, 외부 원천·백업·crypto-shred 미지원             |
| X03     | 결과물 스튜디오     | PARTIAL | PARTIAL       | PASS_TESTED | local/PostgreSQL export는 실제, enterprise DLP·외부 공유 미지원                   |
| A01–A08 | 관리자 8개 화면     | PARTIAL | PARTIAL       | PASS_TESTED | CRUD·결정 원장은 실제, 운영 probe·connector health·WORM/signature 등 미제공       |

## 실제 runtime 검증

- 관리형 Agent `:8010`: DWP Agent Runtime, database `READY`, V34 적용.
- `/dwaion/conversations`: 저장된 대화 17건과 선택 상세 inspector 표시.
- `/dwaion/proposals`: live API에서 신호 12건 분석, 근거 결속 제안 1건 생성.
- 제안 `ACCEPT`: revision `1 → 2`, processed count `0 → 1` 확인.
- 모바일 unavailable-source 누락을 수정했고 동일 agentic suite를 desktop 7/7,
  mobile 7/7로 다시 통과했다.
- `:8100`은 `/Users/a10697/Work/Dthub/Dthub_Agent`의 별도 DTHub 프로세스이며
  DWAI·ON release 판정 대상이 아니다.

runtime 폐쇄 범위와 외부 의존성은 다음 보고서가 정본이다.

- `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/runtime-gap-closure/verification.md`
- `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-09/runtime-gap-closure/manifest.json`

## 검증 결과와 release gate

- 권한/fixture/OpenAPI/route/design-system/i18n/TypeScript/architecture 검사: PASS.
- DWAI focused Vitest: 18 files, 84/84 PASS.
- 독립 메뉴 route browser smoke: 18/18 PASS.
- 독립 사용자·개인 화면 Playwright: 206/206 PASS.
- 독립 관리자 Playwright: 123/123 PASS.
- Agent clean PostgreSQL V1–V34: 499/499 PASS.
- X02/X03 targeted worker: 16/16 PASS.
- Node 24 production build와 bundle budget은 최종 수정 후 PASS했다. initial bundle은
  raw `1064.0/1074.2 KiB`, gzip `308.8/317.4 KiB`, request `4/5`다. 예산과 baseline은
  올리지 않았다.
- Product Surface production readiness evidence는 `BLOCKED`, complete `0/37`,
  release-approved product closure `0/12`이므로 출고 완료로 판정하지 않는다.

자동 테스트 PASS는 구현된 범위의 동작과 계약만 증명한다. Stitch 시각 일치나 production
provider·connector·rollout 완료를 대신 증명하지 않는다.
