# Frontend layer 계약 검증 — 작성자 실행 증거 (2026-09-14)

신규 verification-only 패키지는 현재 고정 바이트에서 Node **44/44**, in-memory TypeScript compile과 12-edge AST 검사를 통과했다. 그러나 실제 저장소의 계획된 HRIS layer 소스는 **0개**이므로 저장소 준수 검사는 exit 1이다. 이 문서는 독립 승인이나 5모듈 G3 착수 승인이 아니다.

정확한 argv·UTC·elapsed·exit·TAP 원문·전후 SHA/decimal mtimeNs는 [JSON 증거](/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/reports/frontend-layer-verification-author-evidence-2026-09-14.json)에 보존했다. XML은 생성하지 않았다.

## 신규 파일 / 고정 입력

| 파일 | 줄 | SHA-256 |
|---|---:|---|
| [hris-layer-contract-v1.mjs](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend/scripts/verification/hris-layer-contract-v1.mjs) | 303 | cbc0db0d5cea0e43d900173f18e78887b9b412e753cafccbee22a45cb9fb2b30 |
| [hris-layer-contract-v1.test.mjs](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend/scripts/verification/hris-layer-contract-v1.test.mjs) | 162 | 688069582c6eb4f7ea2d85f60e346c6b47a0f96a30edcec6d9b0d918ecbc466f |
| [hris-layer-contract-v1.json](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend/scripts/verification/fixtures/hris-layer-contract-v1.json) | 238 | c5c218cd5450a72673708809ebf5d791fa14ee446478d05efef95b4a4862217d |

기존 check-*·package/tsconfig·apps/libs 제품 소스·정본 CSV/Gate/역사 봉인은 이 작성자가 수정하지 않았다. 신규 main/test는 실제 maintenance 검사에서 허용되는 1000줄 예산 안에 있으며 baseline 예외를 추가하지 않았다.

## 실제 결과

| 실행 | 실제 결과 | 의미 |
|---|---|---|
| 현재 고정 source Node TAP | 44 unique / 44 pass / fail·skip·cancel 0 | 작성자 unit/compile/AST 증거 |
| 7-file compile | TS 6.0.3, React 19.2.8, React Query 5.101.4; diagnostics 0 | 설치된 실제 타입 사용; emit·DOM·사업 실행 0 |
| 12-edge positive | compiled fixture 11 distinct + testing→public-api AST 1 | 누락되었던 orchestration 4edge 포함 DAG |
| fixture negatives | 27/27 기대 code로 거부 | 금지/reverse/alias/nested HRIS/type/re-export/dynamic/require/cycle/raw DTO·transport |
| CSV contract-only + fixture CLI | 각각 exit 0; CSV 5개 세션의 ordered 12edge/4금지 exact | 계약 문자열 + 작성자 fixture만 검사 |
| --require-readiness | exit 1, readinessPass=false | 구조 성공이어도 착수 승인 불가 |
| actual repository scan | 2034 sources; public barrel 2; layered 0; unclassified 38; diagnostics 59; exit 1 | NOT_VALIDATED; 0 coverage를 PASS로 처리하지 않음 |
| 기존 feature/API/relative-cycle 검사 | exit 0; relative production 1437 | 새 nested/layer 준수의 대체 증거 아님 |
| maintenance source-size | 316 files; 13 existing exact exceptions; exit 0 | 새 source/test 예산 1000; 예외 신설 0 |

현재 TAP 실행은 2026-09-14T08:03:19.271Z → 2026-09-14T08:03:20.710Z (1435.490042 ms), exit 0이다. 세 신규파일 및 기존 checker/package/tsconfig/CSV의 SHA·mtimeNs 전후와 apps/libs 2034개 파일 namespace SHA·mtimeNs digest가 모두 동일했다. CLI batch도 별도 전후 동일성 기록을 갖는다.

namespace content SHA-256: dbe97f36342843f98bb9f40ec6f63a0dc183321ec2820ef2ba47548a71a79a3b.

namespace decimal-mtimeNs digest: bf0e7c18c9b9dddbe2788af143440570fc05095404fd62426a62694bbf54086e.

## 최초 실패와 수정 경계

최초 2026-09-14T08:00:09.889Z → 2026-09-14T08:00:11.007Z 실행은 42 cases / 41 pass / 1 FAIL / skip 0 / exit 1이었다. hooks→model의 type/value import가 각각 한 진단을 만드는 정상 동작을 테스트가 고유 edge 목록과 비교한 오류였다. 테스트 기대만 distinct set으로 교정했고 두 import 진단이 계속 존재함을 별도 assertion으로 보존했다. 원 최초 TAP/당시 source pins는 JSON에 그대로 남겼다.

추가 작성자 정적 검토로 window.fetch/string-element fetch/qualified WebSocket/sendBeacon 및 HRIS-root 파일 누락 반례를 검사했고, namespace decimal mtimeNs digest를 추가했다. per-layer 정책 완화·legacy 예외·제품 수정은 없었다. 이전 바이트의 42/44 실행을 현재 바이트의 추가 unique 성공으로 합산하지 않았다.

## 경계와 남은 문제

- api-layer의 private wire DTO→pure model projection을 합성 예제로 컴파일했다. 실제 HTTP/사업 API/provider/schema binding, query cache/idempotency 행위는 실행하지 않았다.
- pages는 hooks/forms/components/model을 소비하고 hooks가 React Query와 form orchestration을 소유한다. forms는 React 없는 순수 입력/검증 계층이다. forms→hooks/reverse, page/component/form→api, model→React, production→testing은 허용하지 않는다.
- 실제 repo는 flat pilot 파일 구조여서 분류가 불가능하다. 59개 진단 전부를 독립적인 보안/업무 결함으로 과장하지 않으며, 이 검증기의 정식 layer 적용 또는 검토된 구조 승계가 별도 필요하다.
- nested hris/people와 hris/performance는 다른 기능이다. 공유 파일도 묵시 예외로 통과시키지 않는다. 현재 TIM→hris/shared 두 import는 정확 pointer를 JSON에 남겼으나 공유 계약 승계 여부는 독립 판단 대상이다.
- @hris-fixture alias는 합성 입력에만 존재한다. actual tsconfig의 @dwp-frontend/api-contracts alias도 실제 AST negative에 사용했다. 없는 @/features alias는 ignored가 아닌 unresolved FAIL이다.
- 정적 import graph/경로·generated header 검증이지 임의 eval/reflective API/third-party opaque re-export의 symbol-flow 전체 인증은 아니다.
- 실제 페이지 DOM/a11y/Playwright/네트워크, G4 전체 업무 동작, G6 고객/배포 활성화는 이 패키지 범위 밖이다. 새로운 package command 등록·전수 HRIS layer materialization도 미구현이다.
- 독립 재실행은 root 소유다. 작성자 검사로 자체 독립 PASS/G3 READY를 선언하지 않았다.

## 독립 재현 명령

cwd: /Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend

```sh
HRIS_STRUCTURE_REGISTER='/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/module-structure-contract-register.csv' '/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' --test --test-reporter=tap scripts/verification/hris-layer-contract-v1.test.mjs
'/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' scripts/verification/hris-layer-contract-v1.mjs --mode fixture --register '/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/module-structure-contract-register.csv'
'/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' scripts/verification/hris-layer-contract-v1.mjs --mode contract --register '/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/module-structure-contract-register.csv'
'/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' scripts/verification/hris-layer-contract-v1.mjs --mode scan --register '/Users/a10697/Work/DWP/output/hris-porting-blueprint-2026-09-09/coding-readiness/module-structure-contract-register.csv'
'/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' scripts/verification/hris-layer-contract-v1.mjs --mode fixture --require-readiness
'/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node' scripts/check-maintenance-source-size.mjs
```

scan/require-readiness 두 명령은 현 입력에서 exit 1이어야 한다. 실제 실행한 나머지 기존 check-* argv/원 출력과 8개 CLI 명령의 UTC/elapsed/full stdout SHA·byte count는 JSON에 있다. CLI JSON은 명시적 요약이며 TAP과 달리 원문 전체 보존을 주장하지 않는다.

