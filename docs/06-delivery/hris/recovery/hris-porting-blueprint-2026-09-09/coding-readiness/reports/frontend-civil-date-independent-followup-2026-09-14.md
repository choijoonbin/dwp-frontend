# Civil DATE 공통 API / PAY 지급일 독립 후속 검증

상태: `BOUNDED_INDEPENDENT_DATE_AND_PAGE_TESTS_PASS_NOT_G3_READY`. G3 CLOSED / readiness=false. 생산 및 기존 테스트 변경 0.

## 결과

동일 실제 PAY 테스트 59개와 전체 shared-i18n 테스트 56개를 독립 실행하여 총 115개 고유 Vitest case가 모두 통과했습니다. failure/error/pending/skip 0이며 source 선정 33개 SHA와 decimal-string mtimeNs가 모두 유지됐습니다. API/권한은 mock 경계로 유지하며 실제 페이지 렌더링과 native Intl만 검증한 결과입니다. payroll 계산·native backend·PEP·전체 HRIS Gate 승인이 아닙니다.

| 실행 | UTC 구간 | 결과 |
| --- | --- | --- |
| Node24.19 production public export + native RegExp/Date/Intl | 2026-09-14T10:22:47.157082+00:00 → 2026-09-14T10:22:47.435815+00:00 | exit0; invalid newline 거부4, valid control4 |
| 기존 동일 PAY59 | 2026-09-14T10:22:47.443468+00:00 → 2026-09-14T10:22:51.175029+00:00 | exit0 / 59 passed / pending0 |
| 전체 shared-i18n56 | 2026-09-14T10:22:51.182494+00:00 → 2026-09-14T10:22:55.122616+00:00 | exit0 / 56 passed / pending0 |

첫 short batch는 마지막 증거 조립에서 제 inline Python JSON boolean 삽입 오류(NameError true)로 harness exit1이었습니다. 그 batch의 subprocess exit0 로그만을 PASS 증거로 사용하지 않습니다. 실제 실패 원문을 JSON에 보존했고 json.loads 입력으로만 harness를 수정하여 동일 생산 source/기대값을 fresh 재실행했습니다.

## 기존 실패 및 고유 ID 보존

Root 보고서 3개의 stdout/stderr/source gzip을 실제 해제해 원문 SHA와 bytes를 대조했고 mismatch0입니다. 원래 58개 case ID가 before의 58 passed와 정확히 같으며 새 runtime case 하나만 before에 실제 FAIL이었습니다. before/after59의 ID가 동일하고 중복은 없습니다.

실패 이름: `HrisPayrollWorkspace runtime states keeps a civil pay date unchanged while localizing a publication instant`. before59는 58PASS/1FAIL, after59는 59PASS입니다. 원본 보고서와 원문 압축 archive는 변경하지 않았습니다. 각 원본 SHA/ns, 59/56 사례 전체, exact argv, 실행 시간 및 현재 source manifest는 [JSON 증거](frontend-civil-date-independent-followup-2026-09-14.json)에 있습니다.

## 반례 가설 정정

제가 읽기 단계에서 제시한 “JS $가 final newline을 허용해 raw invalid input을 echo한다”는 P1 가설은 틀렸습니다. 실제 Node24 no-flag RegExp와 실제 공개 index export를 통해 호출한 formatCivilDate 모두 LF/CR/U+2028/U+2029를 거부하고 generic RangeError를 냈습니다. Root도 LF/CR/CRLF/U+2028/U+2029의 native RegExp false를 별도로 확인했습니다.

`REJECTED_SUPERSEDED_SOURCE_ONLY_HYPOTHESIS`로 명시하며 length-check fix 또는 새 negative 파일을 제안하지 않습니다. Python/다른 언어의 regex 동작을 JavaScript native 결과로 대신하지 않습니다.

## DATE와 Instant 경계

payDate는 [페이지 지급일](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend/apps/dwp/src/features/hris/payroll/pages/hris-payroll-workspace.tsx:225) 한 곳만 formatCivilDate를 사용합니다. publicationInstant는 [명세 게시일](/Users/a10697/Work/DWP/.codex-worktrees/hris/integration/frontend/apps/dwp/src/features/hris/payroll/pages/hris-payroll-workspace.tsx:282)의 기존 formatDate로 사용자 timezone을 적용합니다. 실제 LA/iso runtime에서 지급일은 2026-09-25, 게시 Instant는 2026-08-24로 표시됩니다.

formatCivilDate의 UTC는 DATE 구성 요소를 흔들리지 않게 Intl에 전달하는 내부 carrier이지 회사/timezone 정책 하드코딩이 아닙니다. 공개 API는 1..9999 Gregorian year/세기 leap/invalid rollover를 검증하고 0..99 Date constructor shortcut을 피합니다. 현재 model은 civil date와 offset publicationInstant를 별도 검증하며 잘못된 API date를 render 전에 차단하고 회사별 지급일 순서 규칙을 만들지 않습니다.

타입은 time/zone 옵션10개를 제외하고 구현은 untyped 옵션10개를 검사합니다. 기존 실제 공개 테스트는 timeZone/timeStyle/hour 거부를 실행했습니다. 잘못된 civil-date 값은 generic 오류로 echo하지 않습니다. 모든 Intl option/locale의 임의 runtime 입력을 이 함수가 server decoder처럼 검사한다고 주장하지 않습니다. regional storage 읽기는 SSR window 부재/invalid storage에서 default로 복구합니다.

calendar:'islamic'는 현재 허용한 typed option으로 같은 DATE를 다른 calendar(실제 Rabiʻ II 14, 1448 AH)로 표시합니다. timezone 이동이 아니며 Gregorian-only 표시 요구가 없는 상태에서 결함이나 P1로 계산하지 않습니다. 그 요구가 생기면 public calendar 옵션 정책을 별도 결정해야 합니다.

## 현재 선정 source pin

- `apps/dwp/src/features/hris/payroll/index.ts`: SHA `c0dd36fb0eae9c6c098d7fee4cb76678fdb6ed82e024cc16a49a844f5ccd5711`; ns `1789376816340683289`.
- `apps/dwp/src/features/hris/payroll/pages/hris-payroll-workspace.tsx`: SHA `03e0ab5c5abb2b6e364c79e2f3a7d770762a96ddec35307521632bcdab2afae2`; ns `1789380679447311378`.
- `apps/dwp/src/features/hris/payroll/testing/hris-payroll-workspace.runtime.test.tsx`: SHA `d4ba8a900a3d387173ad260cf2b3dc23c9a30de04f470657eea7f7ae406b4fbe`; ns `1789380679476610476`.
- `libs/shared-i18n/src/index.ts`: SHA `cda506ccb5f55b57d2d1838461a1d771d0e42d0309b193e581869382175e0083`; ns `1789380679045561756`.
- `libs/shared-i18n/src/lib/civil-date-formatters.test.ts`: SHA `d491f5f0a712a9f764e7af365a2d753a1ef6c2e54d0f158156fd9744b9d019fc`; ns `1789380679411149174`.
- `libs/shared-i18n/src/lib/formatters.ts`: SHA `5ab3fda213e3b39db81b52314d3aa1d93e20b416ce344c5790e405324ddf0e15`; ns `1789380679399900700`.

## 미인증 및 다음 단계

본 검증은 새 API 후 whole TypeScript compile/browser layout/native owner HTTP를 실행하지 않았습니다. Root가 Harvey Control PG 배치와 host semaphore 순서를 조율하여 current whole `tsc --noEmit` 및 기존 unchanged quality rules를 추가 실행해야 합니다. 예외/skip/정책 완화는 없습니다.

S1 ABI/명령 fence 보완은 별도 Root 검토를 기다리며 생산 작성0입니다. 이 날짜 결과를 5모듈 독립 개발 READY나 native 권한·command commit permit 승인으로 승계하지 않습니다.

