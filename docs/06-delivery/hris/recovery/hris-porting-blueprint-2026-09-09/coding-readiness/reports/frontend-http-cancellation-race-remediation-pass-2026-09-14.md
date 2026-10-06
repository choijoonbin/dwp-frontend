# HTTP 최초 취소 원인 보존 — 실제 반례와 작성자 수리

이 보고서는 신규 race 테스트의 실제 FAIL → 같은 기대의 PASS를 보존합니다. 역사적 Root47/whole991 독립 검토와 별도이며 전체 FE/G3/G4/G6 승인이 아닙니다.

## 실제 실행

before는 2026-09-14 UTC10:11:19.402243→10:11:20.772489, 1.370268584초, exit1, 7개 중 2 PASS/5 FAIL/pending0입니다. JSON/blob caller-first 늦은 body, 늦은 body network rejection, 이미 취소된 caller, 같은 deadline에서 caller timer가 먼저인 경우가 기대 ABORT를 위반했습니다. deadline-first 및 같은 deadline에서 timeout timer가 먼저인 2개 대조군은 TIMEOUT을 유지해 통과했습니다.

after는 UTC10:12:43.411594→10:12:46.286745, 2.875221541초, exit0, **원41 + Root body lifecycle6 + 신규 race7 = 실제54 PASS**, failure/pending0입니다. 최초 FAIL 이후 신규 테스트7/기존 테스트41/Root lifecycle6의 소스·기대는 변경하지 않았습니다. 두 실행 모두 current252 source SHA와 decimal ns pre/post가 안정적이며 두 namespace 사이 변경은 axios main 단1파일입니다. before/after의 8개 gzip 원문 길이/SHA와 gzip SHA를 저장 파일에서 다시 검증했습니다.

실제 argv는 각각 동명 JSON에 보존했습니다. Node는 /Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node, Vitest config는 libs/shared-utils/vitest.config.ts, --maxWorkers=1 --reporter=json입니다. before는 axios-cancellation-race.test.ts만, after는 axios-instance.test.ts/axios-response-lifecycle.test.ts/axios-cancellation-race.test.ts입니다. exclusive hris-verification semaphore는 각각 10:11:20.794Z, 10:12:46.324Z 해제됐습니다. Docker/native API 실행이나 다른 container 종료는 없습니다.

## 승인된 정확한 수리

Root의 실제 before 검토 후 승인 범위대로 timeout callback에 한 줄만 추가했습니다.

```ts
if (controller.signal.aborted) return;
```

caller가 이미 controller를 abort했다면 timeout은 timedOut 플래그를 바꾸지 않습니다. deadline이 최초인 경우에는 기존 timedOut=true와 abort('request-timeout')가 그대로 실행됩니다. 최초 signal.reason 유지, 늦은 JSON/blob payload 거부, JSON body network rejection 후 ABORT 우선, 이미 취소된 caller, 동시 시각의 최초 timer 순서가 같은 테스트에서 검증됐습니다. JSON/blob 두 테스트는 timer 수0과 caller listener remove1회도 확인합니다. 외부 API·parseBody·CSRF·SSE·세션 observer·Root41/6는 이 수리에서 변경0입니다.

main before SHA2d4c702b234ddf01d7de85ecc37156b43c6011cb25daf8f9afa39d5a82e22754/ns1789378714720758289 → after SHAf10a67a3ab118a3d45c8694afb7d1dcb13bf11dbe565714005560b5aa4a5837f/ns1789380737330437219입니다. 신규 race7 SHA는 bc446bba66590f430dfa1bedcda4cc8905d289bdeff342c7c5cf14fcdef8daac/ns1789380640821094568로 전후 동일합니다. 원41 SHA cc39a6395776979904a80c84c146d2a7907399df9440aaa8e27406c24a0485f3 및 Root lifecycle6의 cast 후 SHA d36f567a590eb25ed2f020a71a2064758ba9ff19107e603037c8f63f2c5cd0ae도 동일합니다.

## 판정과 한계

HTTP-IR-001의 caller-first/deadline-later **분류 오류는 작성자 실제 반례와 동일 기대의 bounded 수리로 닫았습니다**. 독립 재검증은 Root 후속 범위입니다. 이 테스트는 의도적으로 비협조적인 mock body를 늦게 해결/거부합니다. 무한 미해결 body의 prompt settlement, 브라우저 native JSON/blob abort, 서버 effect 소급 취소를 증명하지 않습니다. CSRF 공유 bootstrap의 caller-local deadline/cancellation·SSE reader/callback/error 표면·cause redaction은 기존 독립 보고서대로 OPEN입니다.

역사적 whole991 PASS는 main2d4c 및 lifecycle test cast 전 ba5a에 대한 실행입니다. 현재 mainf10a/cast 후 d36f의 전체991 재실행으로 치환하거나 54와 합산한 current whole PASS라고 선언하지 않습니다. 실제 current54는 focused mock-transport 증거이며 G3는 열지 않습니다.

## 원문 보존

before JSON SHA0efbac4cf2ce8e5ea601c5bad3737f4ef1b5a29faf0267ce00e236afb11d8306, after JSON SHAe48d70d3085fc93094c1c63e4559c1fd020408d86abe9dcddfe818633d602b46입니다. 각 파일에 stdout/stderr 원문 gzip, current252 pre/post manifest, 정확 source4 snapshot, 모든 assertion 기록, 실제 UTC/elapsed/exit/host lock를 보존했습니다. Root의 역사적3보고서와 독립 보고서2는 수정하지 않았습니다.
