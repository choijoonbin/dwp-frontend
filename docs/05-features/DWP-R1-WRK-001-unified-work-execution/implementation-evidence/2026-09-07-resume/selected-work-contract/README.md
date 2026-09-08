# 선택 업무 DWAI·ON 계약 최종 검증

기준 시각: 2026-09-07 21:36 KST.

Work는 선택한 업무의 제목·요약·마감·목록 snapshot을 AI 요청에 넣지 않는다. 질문과 원천 유형·원천 ID·예상 버전·필요한 결재 의무 키만 typed stream 계약으로 전송한다. Gateway와 Agent가 현재 사용자·테넌트·원천 권한, 존재 여부, 버전을 다시 확인한다.

저장된 대화 ID가 응답에 있을 때만 DWAI·ON 이어보기를 활성화한다. 일반 업무는 canonical 기본 에이전트 경로를, 결재 업무는 `DWP_APPROVAL_EXPERT` 경로를 사용한다. 같은 패널의 후속 질문은 검증된 대화 ID를 재사용한다. 선택 변경, `APP.ASK`·`APP.WORK`·원천 앱 권한 회수, 패널 종료 시 진행 요청을 취소하고 늦은 응답을 폐기한다. 질문만으로 원천 업무 상태나 제출 결과를 바꾸지 않는다.

Agent의 단건 원천 조회가 없는 `WORKSPACE` 항목은 AI 진입을 표시하지 않는다. 서버가 실행 중 `FORBIDDEN`·`NOT_FOUND`·`STALE`·`INVALID_SOURCE`를 반환하면 현재 선택을 비우고 큐를 다시 조회한다. 일시 장애·인증 필요·제한·미지원 응답은 항목과 질문을 유지하고 다음 조치를 안내한다.

## 검증 결과

- Work 및 선택 업무 API 단위 테스트: **39개 파일, 244/244 PASS**
- 선택 업무 집중 단위 테스트: **4개 파일, 56/56 PASS**
- 선택 업무 계약 브라우저 테스트: **Chromium·Mobile 21 PASS, 데스크톱 전용 1 SKIP**
- 요청 최소화: 제목·요약·화면 URL query를 전송하지 않음
- 권한·소유자 경계: `APP.ASK`·`APP.EMPLOYEE_SERVICES`·`APP.APPROVALS`·`APP.WORK` 회수와 actor 전환 후 패널 종료 및 늦은 응답 폐기
- 서버 변경 경계: `SELECTED_WORK_FORBIDDEN`·`NOT_FOUND`·`STALE` 응답 후 패널 종료와 큐 재조회
- 대화 지속: 저장된 conversation ID만 사용하고 일반/결재 전문가 route를 구분함
- 모바일·접근성: 320px, 글자 200%, 가로 overflow 없음, 44px 조작 영역, IME 조합, 패널 종료 후 초점 복원 통과

브라우저 시험은 실제 React 화면과 통제한 API fixture를 사용했다. 최종 계약 캡처는 [browser-final-expanded](browser-final-expanded), 320px·200% 패널 캡처는 [browser-mobile-320-final](browser-mobile-320-final)에 있다. 실행 로그는 [browser.log](browser.log), 단위 결과는 [unit.log](unit.log)에 기록한다.

실제 Agent·Gateway·원천 API 왕복은 동일 conversation ID의 후속 질문, 실행 전 stale 차단, 출처 1개의 grounded fallback 응답, 원천 무변경과 후처리까지 통과했다. 외부 Azure 모델은 DNS/name-resolution 오류로 실제 생성을 확인하지 못했으며 fallback 성공을 Azure 성공으로 표현하지 않는다.
