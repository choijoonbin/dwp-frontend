# 공유 HTTP body lifecycle 독립 검토

검토 시각: 2026-09-14 10:08:12 UTC. 역사적 실행·압축 원문·source/ns의 무결성 검토이며 G3 승인이나 현재 전체 테스트 재실행이 아닙니다.

## 판정

Root의 before47는 실제 41 PASS/6 FAIL, after47는 47 PASS, whole991은 991 PASS/실패·pending 0으로 원문과 일치합니다. 3개 보고서의 12개 gzip을 전부 해제해 원문 길이·SHA와 gzip SHA를 대조했습니다. 각 실행의 251개 source pre/post SHA와 decimal ns는 일치하며 before→after의 변경은 axios main 한 파일뿐입니다. 기존 41개 테스트의 소스와 assertion 결과/순서도 그대로 보존되었습니다.

whole991은 **991개 assertion 기록**, 94개 raw test 파일, Vitest suite count 192입니다. fullName 963종이며 기존 매개변수 테스트의 중복 이름을 별개 실행 기록으로 식별하기 위해 suiteIndex/assertionOrdinal을 사용했습니다. JSON 보고서에 완전 991개 압축 case manifest를 보존했습니다. 검사한 원문은 stdout 367858 bytes, SHA a9a525357e4bc69469647db8997c1ef8c31a1519de9d52789a134b54ccab213a입니다.

## 수리의 실제 범위

axios main은 payload 선언과 parseBody를 기존 try/catch/finally 안으로 옮기고 body 읽기 뒤 signal.aborted를 확인하는 최소 3개 hunk입니다. 공개 API·CSRF·SSE·세션 observer·HTTP status branch를 새로 바꾸지 않았습니다. 정상 body 처리 경로에서 기존 HTTP status/observer 분기는 보존됩니다. body 실패/abort는 그 분기보다 먼저 transport error로 종료하므로 헤더만 수신한 401/403에서도 동일 observer 통지가 보장된다는 의미는 아닙니다.

새 6개 테스트는 JSON/blob body 동안 caller abort 연결, body timeout, 취소 후 늦게 해결된 payload 거부, body NETWORK 분류, 성공 뒤 listener/timer 해제를 입증합니다. non-cooperative 테스트는 취소 뒤 body를 수동 해결합니다. 무한 대기 body의 즉시 종료나 브라우저 native reader 동작을 입증하지는 않습니다. abort는 클라이언트 결과 전달을 차단하며 서버 mutation의 소급 취소를 뜻하지 않습니다. HttpTransportError는 generic message에 native cause를 유지하므로 cause의 비밀값 제거를 인증하지 않습니다.

## 역사적 pin과 현재 타입 cast

whole991의 lifecycle test SHA는 ba5a5757d96c11015674aac3ed960efe4dcfc16f4521becb97863ac90254dbb6입니다. 이후 한 줄 `as Response` → `as unknown as Response` 수정으로 현재 SHA는 d36f567a590eb25ed2f020a71a2064758ba9ff19107e603037c8f63f2c5cd0ae입니다. TypeScript 6.0.3 in-memory transpile 결과 emitted JS SHA 1d3be9be6bed57b13ec5ce16a04f38e3572d156cc4be533d9ae7ac572d9bf3b6가 같습니다. 이는 type-erasure 대조일 뿐 현재 whole991/typecheck 재실행 PASS가 아닙니다. 기존 보고서의 source pin을 현재 값으로 바꾸지 않았습니다.

## 잔여 경계와 정확한 역회귀 제안

P1 후보 HTTP-IR-001: axios-instance.ts:303–334에서 caller가 T5에 먼저 abort한 뒤 body가 미종료 상태이면 T25 deadline이 timedOut=true를 덮어씁니다. T30 body resolve/reject 때 controller의 최초 reason은 scope-replaced인데 결과 분류는 TIMEOUT일 수 있습니다. **이 검토 시점에는 source-only 후보**이며 실제 반례는 별도 신규 owned test와 실행 archive로 기록해야 합니다. 기대 ABORT와 최초 signal reason 유지, 반대 순서 timeout-first는 TIMEOUT 유지, JSON/blob 및 늦은 resolve/reject, listener/timer cleanup을 같은 fake-timer 반례로 확인할 것을 권고합니다.

CSRF는 request controller 생성 전 공유 bootstrap을 기다리므로 caller-local cancellation/timeout과 공유 waiter 보존·typed bootstrap failure가 별도 OPEN입니다. SSE는 별도 streamRequest가 변경되지 않았고 native stream abort/timeout 분류, callback 실패 시 reader cancel/release, split-CRLF framing을 이 수리로 인증하지 않습니다. 실제 native fetch/browser/API·서버 side-effect/권한·production activation·G3/G4/G6는 검토 범위 밖입니다.

## 검증 산출물

동명 JSON에 Root3의 실제 argv/UTC/elapsed/exit status와 host lock, 12 archive 길이/SHA, source pins/ns, diff, 최초 6 FAIL 메시지, 991 complete manifest를 보존했습니다. 이 독립 검토 과정의 production source/SQL 변경과 heavy test 실행은 0입니다. 후속 실제 race 실행은 이 보고서와 분리해야 합니다.
