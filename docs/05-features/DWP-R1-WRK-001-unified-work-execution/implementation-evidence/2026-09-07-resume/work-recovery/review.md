# Work 업무 데이터·오류 복구 감사

2026-09-07 재개 요청에 따른 Work 소유 데이터와 비동기 실행 감사입니다. Approvals, Services, Calendar, Flow 소유 기능 및 Services 파일은 이번 감사에서 수정하지 않았습니다.

## 수정한 재현 결함

1. **다른 사용자 또는 새 권한 범위에 이전 업무가 남음:** runtime의 query key/controller/복구 snapshot이 원천 목록과 UPDATE 여부만 구분했습니다. 같은 권한의 사용자 전환 후 원천 전부503이면 이전 rows가 복원될 수 있었습니다. 이제 actor/tenant/identity plane 및 roles/groups/resourceRoles/permissions 범위에 controller, query, idempotency를 묶고 취소된/늦은GET을 버립니다.
2. **권한회수 후 나중에 이전 업무가 부활함:**403/404로 rows가 비워져도 lastUsable에 이전 성공 snapshot을 유지했습니다. 뒤이은503이 이를 복원했습니다. 이제 권한회수·소스 소실 결과를 포함한 최신 확인 결과를 다음 복구 기준으로 저장합니다.
3. **HTTP 오류를 모두 통신장애로 취급함:**404/409/422를503과 같은 방식으로 취급하면 원천에서 없어진 업무를 계속 노출했습니다. source snapshot의 optional failureStatus를 보존해4xx에는 rows를 복원하지 않습니다.401/403의 FORBIDDEN 분류는 유지하며5xx/transport만 동일 owner의 이전rows를 표시합니다.
4. **늦은 개인 업무 저장이 새 화면을 변경함:**capture/edit/409최신조회 후 현재 owner·controller·mount 검증 없이 dialog/URL/cache/계획을 수정했습니다. 후속 단계마다 유효성을 확인하고 owner전환·unmount 뒤의 결과를 폐기합니다. 생성 뒤 오늘계획의 연쇄POST도 새owner에서는 보내지 않습니다. 동기 잠금으로 이중 호출을 막고 완료 시 최신 URL 필터를 보존합니다.
5. **같은 사용자 권한회수 중 배치가 계속됨:**기존batch guard는 tenant/user/plane만 비교했습니다. 이제 보안범위 fingerprint도 비교하여 진행중 요청을 취소하고 남은 항목/늦은receipt를 실행·표시하지 않습니다.

## 경계와 회복 계약

`use-work-hub-operation-owner.ts`는 Work transient state의 수명만 구분합니다. 서버 권한을 새로 허용하거나 scope를 조작하는 기능은 없습니다. idempotency key는 원래 의도에 유지되며 새owner로 넘기지 않습니다. identity fingerprint는 React/query 메모리용이고 URL에 보내지 않습니다.

Root가 routes/work-routes.tsx에 동일 owner+pathname key의 WorkPageOwnerBoundary를 적용하여 Page의 계획·일반action·AI 관찰자도 새로운 owner/메뉴로 넘기지 않도록 했습니다. 이 변경이 적용된 상태에서 아래 브라우저 호환 검증을 통과했습니다.

## 검증

- 새/보강5개 단위파일30/30 PASS: actor/tenant 전환,같은actor범위변경,늦은GET,동일owner503보존,403/404뒤503재유출차단,늦은capture/409/cache/plan폐기,동기중복락,현재필터보존,배치범위회수,HTTP분류.
- 기존 Work foundation 브라우저 관련11/11 PASS: 개인시작·완료의version/UUID,부분·전체원천실패,배경갱신장애,앱복귀,읽기전용,배치영수증·선택해제·불명응답재시도,320px입력,키보드.
- 담당파일ESLint PASS. 전체TypeScript 결과는 validation.json에 기록합니다.
- 브라우저는 fixture API를 사용하는 실제 React 여정이며 운영 원천 mutation 성공을 주장하지 않습니다.
- 로그는 logs/, 캡처는 browser/에 저장했습니다. 자동시험 성공과 원본 디자인의 픽셀 동일성은 별도 판단입니다.
