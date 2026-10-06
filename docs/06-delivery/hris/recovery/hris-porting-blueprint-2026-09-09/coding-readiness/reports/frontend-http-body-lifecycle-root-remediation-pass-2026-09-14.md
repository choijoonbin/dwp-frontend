# HTTP 본문 취소 수명 보완

상태: 선택 47개 실제 PASS / 전체 G3 CLOSED.

원본 공통 client는 headers를 받은 직후 timeout/caller abort를 해제하여 본문 읽기 동안 취소를 전파하지 않았습니다. 수정 전 실제47개 중 기존41 PASS·새6 FAIL이며, 원문/선택 source snapshot 및251개 source/config 전후 SHA/ns를 `frontend-http-body-lifecycle-actual-fail-before-2026-09-14.json`에 보존했습니다.

Root는 `axios-instance.ts`에서 body parsing을 기존 try/catch/finally 내부로 옮기고 취소 후 늦게 성공한 payload도 거부하도록 최소 수정했습니다. 공개 client·HTTP status/세션 observer·CSRF 재시도·blob 계약은 그대로이며 body transport 오류를 기존 NETWORK/ABORT/TIMEOUT으로 분류합니다. 원 axios-instance.test.ts는 변경하지 않았고 새 lifecycle test의 기대값도 수정 전후 동일합니다.

동일47개를 실제 재실행해47 PASS/0fail·pending, UTC09:40:58.817 취득→09:41:00.558 해제/실행1.645초,251소스 SHA/ns 전후 동일입니다. 동명 JSON에 argv, 실제 case 목록, 원 stdout/stderr gzip, 전후 manifest 및 현재 selected source snapshot을 보존했습니다. mock fetch/body인 단위 회귀이며 실제 운영 API/서버 권한 인증이 아닙니다. 전체 shared-utils 회귀/현재 whole TypeScript는 별도 재실행이 필요합니다.

새6개는 JSON·blob body 중 caller abort, body 중 timeout, 취소 뒤 늦은 body 성공, body network failure의 typed error, 성공 이후 listener/timer 해제를 확인합니다. CSRF bootstrap의 공유 promise 취소와 SSE의 전체 transport 계약 개선을 이번 보완 완료로 확대하지 않습니다. Native download adapter/권한·receipt·effect cancellation은 아직 연결되지 않았습니다. module Gate·canonical·main·역사 증거 변경0입니다.
