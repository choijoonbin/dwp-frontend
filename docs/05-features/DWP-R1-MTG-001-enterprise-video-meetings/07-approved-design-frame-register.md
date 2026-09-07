# 승인 디자인 30프레임 추적표

원본: [사용자가 제공한 Stitch 프로젝트](https://stitch.withgoogle.com/projects/13391261371843159731).
기준일: 2026-09-04. 프레임 ID는 원본 canvas의 실제 node 식별자다. 아래 높이는 canvas에서 기록한 node 높이이며 구현 결과의 치수가 아니다.

**원본 provenance:** 2026-09-04에 사용자가 공유한 동일 Stitch 프로젝트를 대화형 브라우저로 직접 열고 U01–U15의 desktop/mobile node를 각각 선택해 canvas DOM의 node ID와 치수를 기록했다. 이후 사용자 다운로드 원본 `/Users/a10697/Downloads/stitch_enterprise_grid_calendar_application (10).zip`에서 정확히 30개의 `dwp_meetings*/screen.png`와 `code.html`을 확인했다. ZIP SHA-256은 `0a2fc4d7881a01f9b3ba0e6f164f3b9f980f8aa8afc53c29ea53afecb5d22787`이다. 각 화면/HTML의 SHA-256과 실제 raster 치수는 `e2e/support/meeting-approved-frame-contract.ts`에 고정했다. 원본 ZIP은 읽기 전용으로 사용하며 구현 golden을 원본 bitmap으로 간주하지 않는다.

**검증 구분:** 원본 bitmap/HTML의 불변성, 원본과 구현의 정보 위계 대조, 구현 visual regression, 실제 사용자 여정과 외부 운영 증거는 서로 다른 등급이다. U01–U15의 desktop/mobile 30개 node와 30개 export pair를 모두 검증했고, 30개 구현 화면을 실제 route/state에서 D/M으로 캡처해 no-update 회귀를 통과시켰다. 이는 공통 셸·실데이터·접근성·보안 차이를 포함한 구조/의미 대조이며, 원본과의 무차별 pixel equality 또는 외부 공급자 운영 GO를 뜻하지 않는다.

| 번호/화면     | Desktop node / canvas 높이                   | Mobile node / canvas 높이                    | 원본 검토 상태                |
| ------------- | -------------------------------------------- | -------------------------------------------- | ----------------------------- |
| 01 홈         | `93fe31e4744949689fd0ae3058a46f01` / 1362    | `ce1c05d6081447bba9bf892a230a84a9` / 1804    | 육안·DOM 실측, 04 §12         |
| 02 내 회의    | `22d9267b31984b23b60c27c4fcd51dc7` / 1493    | `1d0fca4227a946859858fb5d87940aa3` / 1385    | 육안·DOM 실측, 04 §15         |
| 03 예약·변경  | `d0965e69a9ab425cb301dcf64f8a2fc7` / 1915.5  | `8c42fc313fbc4edba6b7e1323f34cb99` / 1056    | 육안·DOM 실측, 04 §14         |
| 04 준비       | `caa5173800a042e99bda626122fbc25d` / 1549.38 | `9b19f244ce574b7597c49e49c7304391` / 1532.5  | 육안·DOM 실측, 04 §14         |
| 05 장치·대기  | `df576160dfbf46daa4f00eaf7835e972` / 1273.75 | `f10d82bb54f14557a53f65b35552dd4f` / 1240.62 | 육안·DOM 실측, 04 §14         |
| 06 실제 룸    | `62228a81174b4885a2e4c40a76596a72` / 1024.5  | `ac47af882bfb4932860e7a761c0660e0` / 884     | 육안·DOM 실측, 아래 기획 감사 |
| 07 라이브러리 | `7a44a131fac94aa688bb273a5cd8e382` / 1061.5  | `daef408970b64308a1c39acd8b1b0f27` / 884     | 육안·DOM 실측, 04 §15         |
| 08 결과·검토  | `98ac02d91bba48918bd6de2319996300` / 1632    | `caad2e4e4c924cf49043e2f93558da68` / 1330.12 | 육안·DOM 실측, 04 §15         |
| 09 후속 업무  | `b31bb30cad0846069c26db89046d171c` / 1251.5  | `9eb3bdd9cd0e451fb5720b1e45eb570f` / 1255.75 | 육안·DOM 실측, 04 §15         |
| 10 템플릿     | `96c3f59f78b64c148cd5804cfa65e1b5` / 1099.5  | `c636b178b60a42aeb012c7855c80fb8e` / 1181    | 육안·DOM 실측, 04 §12–13      |
| 11 개인실     | `399e8da93fda456ca6fb24ec12b65672` / 1308    | `e8318d5da737420ca03584e13d79566e` / 1176    | 육안·DOM 실측, 04 §14         |
| 12 설정       | `2cc05be3c87e4614a48f5c1c5c7837d5` / 2631    | `992974d456f9469eb5efa35ad7ce035a` / 1927    | 육안·DOM 실측, 04 §14         |
| 13 운영       | `8178d81ee53f45daae9b9c3e417c2dd2` / 1122    | `6388c55dda0f40fe9b2322684f968980` / 1017    | 육안·DOM 실측, 아래 기획 감사 |
| 14 정책       | `17c30a9ce3f7464ea6d4509634f88a98` / 1624    | `7baadb2159e3411db77faaadb0dc52f5` / 1236    | 육안·DOM 실측, 아래 기획 감사 |
| 15 거버넌스   | `d3f87ba97185403ba023bdfc81035ae9` / 1575    | `fffb987648454c19b4a1d87d3ed80b56` / 1182    | 육안·DOM 실측, 아래 기획 감사 |

## 공통 적용 전 확인할 차이

| 항목        | 원본 사이의 차이/누락                                                       | 적용 기준                                                                           |
| ----------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 공통 셸     | 01의 56px/240px, 후속 시안의 다른 헤더/탐색 치수와 실제 DWP 64px/248px 차이 | DWP 공통 셸 유지, 본문 충실도 별도 측정. 예외를 100% 일치로 숨기지 않음             |
| 모바일 탐색 | 01의 다섯 번째는 설정, 10은 템플릿                                          | 화면별 목적지 교체 금지. 01 기준 고정, 템플릿은 홈·내 회의·전체 메뉴로 접근         |
| 선택 메뉴   | 10 데스크톱 본문은 템플릿이나 라이브러리가 활성 표시됨                      | 실제 목적지에 맞게 템플릿을 활성 표시                                               |
| 예약 모바일 | 4단계 중 첫 단계만 시각화                                                   | 나머지 단계·확정·실패·복귀도 같은 컴포넌트 계약으로 구현                            |
| 준비 모바일 | 데스크톱 사전 대화 블록 누락                                                | 사전 대화는 API 지원 후 접기·문맥 진입을 제공. 미지원 상태를 완성으로 주장하지 않음 |
| 장치·동의   | 정적 장치·지연 수치, AI 동의 미리 선택, 마이크 ON                           | 실제 사용자 행동과 장치 상태, 별도 동의, 참여 전 미디어 비게시                      |
| 개인실 보존 | 즉시 파기 주장과 90일 보존·지난 세션 기록 충돌                              | 콘텐츠 유형별 실제 정책, 링크 회전과 기록 삭제 분리                                 |
| 설정 모바일 | 네 번째 탭 표제와 본문 불일치, 알림·언어 누락, 모두 로컬 저장 주장          | 계정·기기 저장 분리, 빠진 항목도 접근 가능하게 구성                                 |

색상·타이포·섹션 순서·열 비율·CTA 배치는 원본을 기준으로 측정한다. 원본의 가상 사용자/수치/인증·개인정보 문구를 운영 사실로 취급하지 않는다. 실제 실행 권한과 데이터가 없는 기능은 숨겨서 개발 완료로 처리하지 않고 미구현/의존성 Gate로 명시한다.

## 기획·아키텍처 전문가의 U06/U13/U14/U15 원본 감사

4개 화면의 desktop/mobile 8프레임을 직접 확인했다. 아래는 구현 전에 해소해야 하는 원본 간 모순이며, 제작한 UI의 합격 증적이 아니다.

- U06: 영상 무대·협업 패널·하단 컨트롤의 구성은 유지한다. 원본의 FIPS 140-3 E2EE, WebRTC mesh, AI 녹화 상태는 정적 문구라 운영 사실로 사용할 수 없다. 데스크톱 도크 줄바꿈·잘림과 모바일 화면 공유/반응 진입 누락은 좁은 폭에서도 접근 가능한 더보기와 실제 권한 경계로 보정해야 한다.
- U13: 운영 영향·예외 큐·인프라 상태 순서를 유지한다. 원본은 metadata-only를 주장하면서 회의 제목·부서를 노출한다. 운영자에게 내용 접근 권한을 암묵 부여하지 않으며, failover 등 고위험 조작은 실제 영향 미리보기·추가 인증·명령 영수증·감사 없이는 활성화하지 않는다.
- U14: desktop/mobile 정책 옵션이 다르다. 모바일에서 빠진 조직 템플릿·allowlist·호스트 시간 제한·녹화 권한을 누락하지 않는다. E2EE와 저장 암호화 AES를 같은 보안 상태로 표시하지 않는다.
- U15: 데스크톱에는 7개 단계가 있으나 표제는 6/6이며 모바일에는 녹화 제공자 단계가 빠져 있다. 실제 의존성 전체를 공통 모델에서 표시한다. HSM·ZKP·zero-training 등의 문구는 검증된 구성 증거가 있을 때만 표시한다.

## 2026-09-04 우선순위 10프레임 직접 대조 결과

구현 스크린샷을 승인 원본으로 재명명하지 않고, 위 Stitch node를 다시 열어 같은 viewport와 실제 API fixture 상태를 비교했다. `일치`는 픽셀 복제가 아니라 공통 DWP 셸·실제 계약·보안 경계를 지키면서 원본의 정보 위계, 열 비율, 탐색 위치와 상태 의미를 재현했다는 뜻이다.

| 화면           | 원본에서 보존한 핵심                                                      | 구현 보정                                                                                                                | 승인 원본과 남는 의도적 차이 / Gate                                                                    |
| -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| U01 홈         | desktop 오늘 일정:대기열 8:4, 최근 결과:도구 7:5, mobile 5개 고정 목적지  | 공통 `PageCanvas` gutter, 단일 연속 목록, 320/390 하단 탐색, 실제 next/live/empty/blocked 상태                           | 원본의 가상 아바타·안건 0/3·RSVP·보안 등급은 실제 projection이 없어 만들지 않음                        |
| U02 내 회의    | desktop 목록+sticky inspector, mobile 선택 항목 우선, 검색/시간/역할 필터 | 현재 페이지에서만 동작하는 명시적 검색·시간·역할 필터와 2:1 workspace, 취소 회의의 거짓 CTA 제거                         | 반복 회차·초대함·자료 준비율은 API가 없어 표시하지 않음                                                |
| U05 장치·대기  | private preview→이름/입장→장치→정책 rail, mobile preview 우선             | 계정/브라우저 선호를 실제 입장 choices에 결속하고 speaker 선택·test tone·지원 감지 fallback 및 mobile sticky 입장을 추가 | 장치 ID/label 서버 저장 금지, 자동 mic/camera 게시 금지; 실제 OS permission과 LiveKit 종단은 운영 Gate |
| U07 라이브러리 | desktop 7:5 목록/preview, mobile 단일 actionable list                     | 실제 history 필드만으로 evidence 필터·bounded search, 선택 preview와 recap 이동                                          | 본문 전사 검색·organizer·공유받음·즐겨찾기는 서버 계약이 없어 표시하지 않음                            |
| U08 결과·검토  | desktop 결과 문서:evidence 7:5, mobile 요약→근거→재생 순서                | 연속 결과 문서, 게시/검토 상태, bounded 전사 segment/search와 recording ticket 재생·citation seek                        | 전사 원문/locator는 overview에 복제·저장하지 않고, 매 page/ticket에서 현재 접근·보존을 재검증          |

### 공통 셸·반응형 판정

- DWP 실제 셸의 64px header/248px rail은 Stitch의 56px/240px를 복제하지 않는다. 본문은 공통 `PageCanvas`의 xs 16px, md 24px, xl 32px gutter를 사용하고 페이지별 고정 `max-width`를 만들지 않는다.
- 390/320 사용자 화면에는 홈·내 회의·라이브러리·후속 업무·설정의 같은 5개 목적지를 유지한다. immersive room, join, 예약/준비 문맥과 관리 화면에는 고정 nav를 중복하지 않는다.
- 장식용 gradient, 18–52px shadow, hover lift, 의미 없는 중첩 카드는 우선순위 화면의 공용 surface에서 제거했다. 상태색은 선택·경고·성공처럼 실제 의미가 있을 때만 쓴다.
- long label, dark, forced-colors, reduced-motion, keyboard focus, 200% text와 320/390/1280/1440 경계를 별도 E2E로 검증한다. 테스트 fixture는 실제 운영 데이터나 LiveKit/STT/LLM/KMS 종단 증거가 아니다.

## 최종 30프레임 구현 대조

아래 판정은 이 문서 첫 표의 node ID 30개를 정본으로 삼는다. `구조 합격`은 원본의 정보 위계·주요 CTA·desktop/mobile 재배치를 실제 컴포넌트로 보존했다는 뜻이며, 원본 PNG의 픽셀 복제나 외부 공급자의 운영 준비를 뜻하지 않는다. 공통 DWP 셸, 실제 데이터 계약, 접근성 또는 fail-closed 경계 때문에 달라진 부분은 마지막 열에 남겼다.

| ID                 | Desktop 구현 대조                                                                         | Mobile 구현 대조                                                                          | 의도적 차이 / 남은 운영 Gate                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| U01 홈             | 명령 초점, 일정:대기열 8:4, 결과:도구 7:5, 공통 gutter 구조 합격                          | 390/320 단일 열, fixed 5-destination nav와 safe-area 합격                                 | 원본의 가상 사용자·안건 완료율·보안 등급은 실제 projection이 없어 생략                                                                       |
| U02 내 회의        | 검색/시간/역할 필터, 목록:inspector 2:1, 선택·예약 관리 구조 합격                         | 선택 회의와 다음 행동을 먼저 노출하고 5개 nav 유지                                        | 실제 회차 변경·취소를 U03 workspace에 연결; 가짜 준비율은 만들지 않음                                                                        |
| U03 예약·변경      | 단계형 입력, sticky briefing, 반복/회차 impact preview와 receipt, V36 수동 초안 구조 합격 | 순차 입력, 명시적 저장·복원·폐기, 오류 복귀, 44px 행동 영역 합격                          | silent autosave/localStorage 금지. 지원되지 않는 호스트 전 입장은 미선택·비활성 사유 표시; Calendar 가용성 및 외부 Notification 전달은 NO-GO |
| U04 준비           | 안건·RSVP·자료 metadata·정책·입장 흐름과 SELF-only 준비 체크 구조 합격                    | 같은 우선순서와 개인 체크 disclosure를 단일 열로 보존                                     | 타 사용자·관리자 준비 집계는 제공하지 않음. 신뢰 공급자 ACL/open과 사전 대화는 NO-GO; pending 자료는 참가자에게 redaction                    |
| U05 장치·대기      | private preview:보안 rail 2열, 저장 speaker·test tone과 이름→입장→장치 순서 합격          | 390에서 preview→장치→정책, safe-area sticky 입장 순차 배치 합격                           | 자동 mic/camera 게시 금지; 실제 OS 장치와 LiveKit 종단은 운영 Gate                                                                           |
| U06 실제 룸        | 영상 무대, 참가자/채팅 패널, 하단 dock과 검증된 Q&A·투표·안건 timebox 진입 구조 합격      | 390/320 identity/actions 2행, 연결 toast safe-zone, launcher/drawer와 안전 종료 동선 합격 | DOMRect 비중첩·44px target을 검증했다. 소회의실과 실제 LiveKit/TURN/recording 종단은 NO-GO                                                   |
| U07 라이브러리     | 결과 목록:evidence preview 7:5, bounded search/filter 구조 합격                           | 상세 rail을 제거한 actionable list 구조 합격                                              | 전사 본문 검색·공유받음·즐겨찾기는 source 계약 전까지 미노출                                                                                 |
| U08 결과·검토      | 결과 문서:evidence 7:5, 인용·검토/게시·ephemeral playback 구조 합격                       | 요약→근거→재생 순서를 단일 열로 보존                                                      | 원문/locator 비저장; Work CREATE CTA는 현재 authority 미검증이라 숨김                                                                        |
| U09 후속 업무      | Work 목록:inspector와 상태 명령/receipt, 확인된 후보 검토와 명시적 승격 차단 합격         | 상태와 다음 명령을 우선하는 단일 열 합격                                                  | 현재 authority port 부재로 CREATE/READ/REASSIGN은 fail-closed; People eligibility 전까지 REASSIGN도 NO-GO                                    |
| U10 템플릿         | 개인/조직 목록:상세, 복제·즐겨찾기·예약 구조 합격                                         | 필터와 주요 CTA가 겹치지 않는 단일 열 합격                                                | 조직 템플릿 관리는 사용자 CRUD로 우회하지 않음                                                                                               |
| U11 개인실         | 방 identity, 초대 revision, 현재 세션:이력 구조 합격                                      | 이름·초대 회전·입장을 먼저 배치                                                           | QR·alias 자동 입장·자동 녹화/동의는 미제공                                                                                                   |
| U12 내 설정        | 설정 nav:form:데이터 범위 rail, 계정/기기 저장 구분 합격                                  | 섹션 단일 열과 명시적 장치 점검 합격                                                      | 실제 알림 전달·미지원 배경은 미제공; stale 장치는 안전 fallback                                                                              |
| U13 운영 관리      | 영향 지표, 공급자 상태, 예외 큐:진단 inspector 구조 합격                                  | 진단 근거와 제한된 운영 동작을 순차 배치                                                  | 고위험 조작은 추가 인증·receipt 없이는 활성화하지 않음                                                                                       |
| U14 정책 관리      | 정책 그룹, 현재 적용 상태, 변경 영향 rail 구조 합격                                       | 데스크톱 항목을 누락하지 않고 순차 배치                                                   | 저장 암호화와 E2EE를 같은 상태로 표시하지 않음; 외부 집행은 readiness Gate                                                                   |
| U15 AI·데이터 관리 | 1440에서 7단계 pipeline 수평, 기능/의존성/검토/보존 증거 구조 합격                        | 390에서 동일 7단계와 모든 dependency를 순차 보존                                          | 승인 원본보다 길지만 fail-closed 사유·감사·보존을 숨기지 않기 위한 의도적 확장; KMS/STT/LLM/recording은 NO-GO                                |

### 최종 시각 증거

- 사용자 제공 Stitch ZIP을 실제로 읽은 `video-meeting-approved-frame-matrix.spec.ts`가 ZIP 1개, U01–U15 D/M 30개 `screen.png`/`code.html`의 SHA-256·raster·node·route·state·proof를 두 브라우저 프로젝트에서 검증해 **62/62 PASS**했다. 이 증거는 승인 원본 provenance이며 implementation golden과 분리된다.
- Node24.19/Yarn4.17 독립 test server :4463에서 12개 화면의 실제 라우트·상태를 desktop 1440/mobile 390에 고정한 전용 `video-meeting-approved-frame-regression.spec.ts`가 no-update **24/24 PASS**했다. U01/U02/U05/U07–U14 모바일은 첫 viewport가 아닌 수렴한 전체 문서 높이로 캡처하며, U06 D/M만 실제 몰입형 viewport를 유지한다.
- U03/U04 owner spec은 저장 초안·SELF 체크 보정 뒤 no-update **54/54 PASS**했다. U06은 390/320 header identity/actions 및 실제 연결 toast의 DOMRect 교차 0을 검증한다. U15 canonical D/M은 모두 한국어/light/BLOCKED이고, 별도의 390 English/dark/READY progressive-disclosure 회귀를 보존한다. 전용 시각 묶음은 **27 PASS + project-scope skip 3 / 0 fail**이다.
- 따라서 실제 route/state에서 생성한 구현 frame golden은 U01–U15 D/M **30/30**이 존재한다. 계약은 28개 `FULL_DOCUMENT`와 U06 D/M 2개 `IMMERSIVE_VIEWPORT`, 정확한 repo path·raster width/height·SHA-256·owner screenshot call·랜드마크 순서·마지막 콘텐츠 여백을 고정하며 missing/duplicate/orphan은 0이다.
- 사용자 화면의 5개 하단 목적지는 해당하는 6개 mobile golden에서 fixed/visible, 최소 44px, safe-area 포함, 마지막 콘텐츠 비가림과 중복 렌더 0을 assertion으로 검증한다. join·prejoin·room·관리 화면에는 의도적으로 표시하지 않는다.
- 전체 Meeting page surface의 장식 gradient는 0이다. 몰입형 room의 떠 있는 반응/협업 panel에만 기능적 depth shadow가 남고, 일반 page/card의 18–52px shadow·hover lift·반복 decorative card는 제거했다.
