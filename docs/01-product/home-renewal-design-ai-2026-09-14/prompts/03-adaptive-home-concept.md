# P03 — Adaptive Home Concept / AI Stage 가칭

## 전달 계약·제안 범위

**[P00 공통 계약](00-common-contract.md)**과 함께 전달한다. standalone 전달은 패키지 README의 `P00 → P03` 합본이다. 이 제3모드는 현재 제품에 존재하지 않는 디자인 제안이며 현재 소스·설정·서비스에 추가하라는 명령이 아니다. 구현·운영 활성화·전체 검증 완료를 주장하지 않는다.

Classic은 조직 소식·지식·안내의 편집형 조직 포털, Flow는 다음 행동·시간·응답·요청 중심의 개인 업무 실행 공간으로 개편한다. 제3모드는 **AI Stage — 오늘의 맥락에서 의도를 업무로 바꾸는 공간**이라는 가칭으로, 두 모드와 시각·주 행동·구성이 확실히 다른 대담한 안을 만든다. 내부 mode name Adaptive와 사용자 브랜드 이름은 모두 가칭이며 실제 identifier 변경은 구현 범위가 아니다.

Classic/Flow의 승인 내 앱 PNG는 보존 계약이다. **이 제3모드에서는 내 앱도 획기적으로 새로 제안할 수 있다.** 다만 실제 앱 실행·권한·pin/folder·알림·키보드 접근과 기존 개인 설정을 유실하지 않는다. `../audits/01-home-experience-audit.md`의 소스 사실·미검증 후보·설계 판단 구분을 읽어라.

## 사용자·핵심 질문·주요 행동

주 사용자는 도구를 찾는 일보다 상황을 이해하고 의도를 말해 실행을 준비하고 싶은 구성원이다. 젊은 구성원에게도 신선하고 역동적으로 느껴지는 화면을 제시하되, 연령을 이유로 유치한 게임·강제 알림·업무 순위 경쟁·감시형 점수를 넣지 않는다.

질문은 **“지금 내 의도를 실제 자료와 앱의 다음 행동으로 어떻게 이어갈까?”**다. 주요 행동은 AI에게 실제 업무 의도를 제시하고 근거·계획을 검토한 뒤 원본의 준비/실행으로 연결하는 것이다. 아키타입은 AI-assisted Context & Intent Workspace다.

AI는 큰 역할을 맡는 핵심 인터랙션이다. AI 채팅창을 가운데 넣고 카드 행을 주변에 늘어놓는 안으로 끝내지 않는다. 오늘 맥락의 근거 브리핑, 실제 질문의 응답, intent→관련 앱·자료·next action 연결, draft→preview→사용자 confirm→owner receipt 또는 오류 복구가 하나의 공간에서 이어져야 한다.

## 시각 콘셉트 — 답변이 실제 작업 공간으로 이어지는 Stage

두 가지 대담한 대안을 탐색한 뒤 하나를 주안으로 완성한다.

1. **Intent Stage:** 짧은 Context와 compact launcher 바로 다음에 큰 의도 입력·2~3개의 실제 근거 기반 시작 질문·관련 앱 연결을 놓는다. 필수 확인은 같은 첫 viewport의 짧은 보조 rail이며 일반 소식 지면을 AI 앞에 넣지 않는다. 질문을 제출하면 같은 지면이 `근거 → 준비 자료 → 가능한 다음 행동`의 작업 장면으로 전환된다. Context spine, 주 stage, 선택한 원본의 compact evidence 영역이 관계를 보여준다. 앱 launcher는 상단의 짧은 pin dock과 명시적 모든 앱 패널로 설계한다.
2. **Context Scenes:** “업무 시작 / 회의 준비 / 집중 / 응답”처럼 사용자가 고르는 scene을 제공한다. scene마다 큰 타이포·시간 맥락·연결된 근거와 행동의 composition이 바뀌며 같은 카드 위치에서 숫자만 교체하지 않는다. 새 상황은 업데이트 제안으로 보여주고 사용자가 scene을 선택/적용할 때만 전환한다. 자동 회전·무한 carousel·focus 이동은 금지한다.

이 콘셉트는 페이지가 소유한 안정된 responsive layout이다. unconstrained 좌표 canvas·무작위 위치·입체 효과로 읽기나 keyboard 순서를 깨뜨리지 않는다. 큰 타이포, 구분되는 semantic surface, 경계와 절제된 깊이, 원본과 계획의 연결로 놀라움을 만든다. gradient/glow·blob·continuous motion·단순 카드행 증식으로 역동성을 대신하지 않는다.

사용자 행동에 따른 scene transition은 원인과 공간의 연속성을 설명할 때만 사용한다. focus는 입력·검토·확인 동선에 안정적으로 남는다. reduced motion에서는 즉시 정적 전환과 “계획 준비됨 / 근거 3개” 같은 결과 문구로 동일 의미를 제공한다.

## 정보구조·역할

전체 의미 순서는 `짧은 Context + compact launcher → AI Intent Stage(의도 입력·짧은 근거·관련 앱) → compact 필수 확인 보조 rail(있는 경우) → 확장 근거/계획·시간/응답/대기 맥락 → 관련 일반 소식 brief 또는 아래 소식 → 데이터 범위·도움`이다. 1440/1280 첫 viewport의 중심은 큰 AI 의도 입력과 실제 근거·관련 앱 연결이다. 필수 확인은 같은 viewport의 짧은 보조 rail로 접근·마감을 보존하고 없으면 공간을 늘리지 않는다. 일반 소식은 관련 문맥의 brief 또는 아래 영역이며 AI 주 지면 앞에 고정 배치하지 않는다. 필수 항목이 AI 답변에 관련되어도 읽음/확인 완료로 자동 처리하지 않는다.

| 영역                      | 정보 역할                                             | 행동과 제약                                                                                                          |
| ------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Context brief             | 오늘 날짜·시간대·다음 약속·업무 범위의 근거 있는 요약 | “10:30 출시 점검, 확인할 조직 소식 1건”처럼 원본으로 검증 가능한 문장. 출처 없는 성과·감정·시간 소요를 추정하지 않음 |
| Compact launcher          | 권한 내 앱과 사용자의 pin/folder 접근                 | 전체 앱 경로·표시 예산 밖 알림·개인 숨김을 구별. 앱 검색/패널은 기존 capability 확인 또는 제안 표시                  |
| AI intent input           | 사용자의 질문·하고 싶은 업무 표현                     | 입력 예시와 질문 scope·근거 범위. assistant 응답은 사용자 의도를 source와 next action에 연결                         |
| Compact 필수 확인 rail    | 조직이 발행한 확인 책임의 보조 접근                   | 첫 viewport에서 짧게 노출, 없으면 빈 공간 없음. 확인과 읽음 구분, explicit 확인은 원본에서                           |
| Evidence workspace        | 답변·자료·계획의 원본 근거                            | 출처 제목·앱·시각·권한 범위·현재/지연·citation 선택. inference는 표시하고 source가 없으면 추론 금지                  |
| Plan / next action        | 검토 가능한 준비물·다음 행동                          | draft→preview→confirm→원본 handoff. 수정·취소·원본 보기·owner 결과/receipt·오류 복구                                 |
| Time / response / waiting | 시간 준비·내 응답·내가 기다리는 진척                  | 동일 업무를 AI 계획과 별도 할 일로 재합산하지 않음. relevant context만 현재 scene에 연결                             |
| 관련 일반 소식 brief      | 현재 의도·장면에 관련된 조직 문맥                     | AI 주 지면 아래 또는 관련 자료의 짧은 연결. 실제 관계의 근거가 없으면 추천 이유를 만들지 않으며 필수 항목 중복 제외  |
| 범위·상태                 | 마지막 성공·검색/조회 범위·부분 누락                  | 정상 반복은 압축. home summary와 원천/AI run의 서로 다른 fresh scope를 구별                                          |

기존 네 category·5×2는 이 모드에서 별도 표현 projection 또는 모드별 설정으로 보존할 수 있다. 축약 launcher에서 보이지 않는 앱을 실제 hiddenApp으로 저장하지 않는다. Classic/Flow 복귀 시 승인 내 앱·기존 layout·folder·정렬이 그대로 복원된다.

## AI의 핵심 역할과 실제 제품 경계

### 1. 오늘의 근거 브리핑

AI가 권한 있는 실제 소식·업무·일정·응답·요청 context를 구조화해 짧은 briefing을 만든다. 모든 중요한 문장에는 관련 source 또는 derived 계산의 근거가 있다. “곧 끝낼 수 있다 / 팀이 위험하다 / 당신이 스트레스를 받는다”처럼 원본에 없는 추측을 넣지 않는다. 부족한 원천과 stale 자료를 응답의 범위로 드러낸다.

### 2. 실제 질문 응답

예: “오늘 출시 점검 전에 무엇을 준비해야 해?”, “내 답변을 기다리는 요청만 모아줘”, “이번 주 조직 운영 변경의 근거 자료를 보여줘.” 답변은 승인된 원본 identity·source 문서·관련 앱·필터 범위를 연결한다. 소식 요약을 만드는 것과 확인 처리, 업무 준비와 완료 처리, 자료 검색과 공유를 각각 구별한다.

source가 없다면 “확인 가능한 자료가 없습니다”와 허용된 검색/원본 경로를 제공한다. 근거가 없는데 plausible한 답을 채우지 않는다. 권한이 없는 source의 존재·내용·제목도 새로 노출하지 않는다.

### 3. Intent → 자료·앱·준비 계획

의도를 해석한 결과를 편집 가능한 scope와 단계로 제시한다. 사용자 intent, 실제 source, 가능한 action, 미지원 action을 구별한다. 업무 앱별 상세 기능을 새로운 홈 AI가 복제하지 않는다. 계획 수정·단계 제거·다른 source 선택·pin·feedback·Undo·취소를 제공한다. 과거 사용자의 pin을 AI 추천이 자동으로 덮어쓰지 않는다.

### 4. 검토·확인·원본 실행

`draft → preview → confirm → owner handoff → owner receipt / error recovery`를 design flow로 명시한다. preview는 데이터와 대상·권한·변경 내용·영향·실행 가능 여부를 보여준다. 사용자 confirm은 원본 권한과 고위험 승인 과정을 대신하지 않는다.

owner가 지원하는 정식 action/receipt가 없는 경우는 **원본 상세 이동**까지만 디자인하고 자동 실행·성공 영수증을 발명하지 않는다. 결과 receipt는 원본이 반환한 실제 식별자·상태·감사 맥락이 있을 때만 표시한다. 실패·취소·권한 회수·timeout·중복 제출·결과 불확실 상태는 retry 조건·재조회·원본 확인 경로를 갖는다. 결과가 불확실하면 성공으로 꾸미거나 계획을 자동 반복하지 않는다.

### 5. CURRENT / EXTEND / NEW_API 계약 구분

기존 DWAI·ON을 재사용하는 홈 projection이며 새 AI 채팅 앱을 중복 생성하는 안이 아니다. 기존 DWAI·ON의 실제 확인된 conversation·source·artifact·controls capability만 그대로 재사용한다. 별도 신규 앱/앱별 메뉴 설계는 패키지 P12/P13을 따른다.

현재 [agent-plan-api.ts:64](../../../../libs/shared-utils/src/api/agent-plan-api.ts#L64)의 handoff origin과 같은 파일:92 이후 preview 검증은 `state=REVIEW`, `mutationAllowed=false`, `referenceMode=true`를 강제한다. 허용 origin은 `APP.ASK`의 `/dwaion/new` 또는 conversation UUID route, `surface=action-shelf`다. **현재 홈에서 직접 AI 계획을 실행하는 origin은 지원되는 것으로 그리지 않는다.**

| 상태                     | 디자인에서의 표현                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| CURRENT                  | 소스에서 확인된 DWAI·ON 진입·기존 conversation/source/artifact/controls 흐름. 실제 허용 route·permission만 사용; 운영 활성·실행 PASS를 뜻하지 않음 |
| EXTEND                   | 홈 context 전달·projection·AI 질문 entry·home origin·scope/return context·citation·run state 확장. 현재 미구현으로 명시                            |
| NEW_API / owner contract | 필요 시 home-origin plan preview/confirmation·owner action/receipt·failure recovery·idempotency·authorization 계약. 실행 전 별도 구현·검토 대상    |
| Unsupported              | 지원 계약이 없는 작업은 읽기/참조·원본 이동만 허용. 가상 성공·silent mutation 금지                                                                 |

분류는 P00의 `CURRENT / EXTEND / NEW_API / EXTERNAL`을 따른다. 순수한 시각·정보구조·scene 전환 안은 **디자인 제안**으로 별도 표시하며 API 지원으로 분류하지 않는다. 외부 원천 의존은 EXTERNAL로 추가 주석을 단다. Unsupported는 지원 불가 상태 설명이며 별도 capability 분류명이 아니다.

AI가 핵심인 main design과 AI unavailable degraded frame을 둘 다 만든다. unavailable 상태에서는 명확한 원인/재시도·마지막 유효 briefing 범위와 권한 내 원본 앱/자료 경로를 제공한다. degraded 상태를 AI가 정상 답변한 것처럼 꾸미지 않는다.

## 가상 데이터·상황 변화

모든 fixture는 디자인용 synthetic 데이터이며 현재 운영 상태·실제 AI 결과가 아니다. 사용자 김하린 / Harin Kim, MEMBER, 제품운영팀, Asia/Seoul, 2026-09-14. source identity·실제 route/permission은 P00과 데이터 감사 기준이다.

| Scene / context | 가상 입력                                        | AI가 할 큰 역할                                                                               | 유지하는 것                                        |
| --------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 업무 시작 09:58 | 필수 소식 1, 일반 소식 2, 다음 일정 10:30        | “오늘 출시 점검 전에 무엇을 준비할까?” intent와 일정·준비 업무의 source briefing·관련 앱 연결 | compact 필수 확인 접근·사용자 pin/order·현재 focus |
| 회의 준비 10:05 | E-31 출시 점검, W-1051 준비 업무, 실제 관련 문서 | “출시 점검 전 준비할 자료” 질문 응답·citation·초안 준비 계획                                  | source 없는 회의 결과·가상 자료 생성 없음          |
| 회의 직전 10:25 | 동일 일정의 원본 회의 link                       | 사용자 선택 시 준비 scene, 확인된 자료·회의 진입 경로                                         | 읽던 위치·자동 scene 이동 없음                     |
| 회의 후 11:05   | 다음 약속 14:00, W-1042 오늘 16:00               | 근거 있는 다음 행동 제안·원본 결과가 있을 때만 연결                                           | 업무 자동 완료·가상 receipt 없음                   |
| 집중 11:15      | 확인 calendar 빈 창 11:15~12:00                  | 사용자가 고른 업무와 시간 창 연결·계획 preview                                                | 소요 시간 추정·과거 pin 덮어쓰기 없음              |
| 응답            | MAIL:M-51 오늘 13:00, T-71 문의                  | 응답 대기만 모아 source와 원본 thread로 연결                                                  | AI 계획과 별도 task 중복 집계 없음                 |
| 낮은 업무량     | 성공 응답 0·일정 0·일반 소식 2                   | 짧은 briefing·조직 자료/앱의 유효 접근 경로                                                   | 실패를 0으로 표시하지 않음                         |
| 일부 원천 실패  | calendar unavailable, work success               | 응답 범위 명시, 시간 창 확정 중단, work source 활용                                           | 무관한 성공 자료·권한 범위                         |
| 퇴근 후/주말    | 지역 시간 18:30/토요일                           | 다음 근무일 맥락과 관련 조직 소식, 사용자가 요청한 intent 처리                                | 근거 없는 긴급 압박·자동 변경 없음                 |

소식 예시: 보안팀 “9월 정보보호 교육 확인”, 내일 18:00까지 미확인 1; 운영지원 “고객지원 운영시간 안내”, 09:20. Action: WORK:W-1051 “출시 점검 자료 준비”, 오늘 10:20; WORK:W-1042 “파트너 계약 검토안 마무리”, 오늘 16:00. Waiting: SERVICES:R-91 “노트북 점검”, 담당 배정·내일 업데이트. 역할 집계는 해당 권한의 TEAM_LEAD 표본에서만 별도 제공하며 MEMBER에게 타인의 개인 자료·조직 집계를 발명하지 않는다.

## 모드·폭·개인 구성·확장

Classic/Flow/Adaptive는 정보 모드, focused/balanced/expressive는 표현 preset, saved layout은 순서·보임·정보 예산·pin/folder 등의 개인 구성이다. 현재 Flow의 최대 폭 1280/1680/2560을 새 모드에도 통일하는 것은 디자인 제안이며 별도 저장·이관 계약을 명시한다. 현재 Classic 또는 미구현 Adaptive가 같은 폭을 보장한다고 주장하지 않는다. Adaptive를 expressive의 새 이름으로 쓰지 않는다.

조직 허용 모드·초기 기본·개인 현재 선택을 구별한다. 신규 아직 미배포·선택 미허용의 이유를 사용자 언어로 보여준다. 모드 선택기에는 목적 설명과 작은 preview, 현재 선택, 설정 보존 설명을 제공한다.

모드 전환으로 apps/folder/hidden/order·Classic/Flow layout·폭 preset을 삭제/reset하지 않는다. 공통 설정·모드별 projection·모드별 draft를 어떻게 보존하는지 전후 상태표로 명시한다. dirty 편집 중 전환, 저장 실패·버전 충돌·정책 강제 변경은 초안과 기존 성공 설정을 보존한다.

context 변화는 표시 맥락만 바꾸며 사용자 layout을 silently persist하지 않는다. AI 제안을 실제 설정으로 적용하려면 preview/diff·명시적 선택·Undo·오류 복구·감사 계약을 별도로 따른다.

향후 위젯 등록 규격은 역할·source·permission·지원 모드·context 입력/출력·정보 예산·모든 상태·원본 행동·반응형·접근성·settings schema/version을 갖는다. 이 모드의 확장은 briefing source lane·준비 자료·scene module 등으로 표현하고 모든 항목을 같은 tile로 강제하지 않는다. gallery에서 모드 지원·권한·원본·AI 활용 범위·preview를 보고 사용자 선택으로 추가한다. 자동으로 새 widget을 삽입/재정렬하지 않는다. 등록과 AI context 계약은 향후 제안이며 현재 구현을 주장하지 않는다.

## 상태·동선

대표 clickable flow:

1. 첫 viewport의 intent 입력→조회/run 진행→근거 답변→citation 선택→자료·관련 앱 확인.
2. 계획 draft 수정→preview scope/영향 확인→confirm→owner handoff 또는 원본 이동→실제 receipt/실패/결과 불확실 복구.
3. 사용자 scene 선택→context composition 전환→기존 pin·focus 보존→정적 reduced motion 결과.
4. 보조 rail의 필수 소식 source 확인→원본 상세의 명시적 확인→홈 복귀·scroll/focus 복원. 일반 소식은 관련 brief 또는 아래 영역에서 원본 이동.
5. 전체 앱 패널→검색/권한 내 결과→앱 이동→반환 context.
6. 모드 선택→preview/설정 보존→dirty 대응→Classic/Flow 복귀 및 승인 내 앱 복원.

각 영역은 initial loading/success/empty 0/one item/over budget/partial/unavailable/forbidden/stale/background refresh/retry failure를 갖는다. AI run은 source 조회 중·답변 중·취소·근거 부족·부분 원천·timeout·실패·권한 변경·미지원 intent·검토 준비·confirm 불가·owner 결과 불확실을 별도 표현한다.

자동 갱신은 읽는 위치·hover 대상·focus를 흔들지 않는다. manual retry 진행은 initiating control에 둔다. 실패를 0으로 표시하지 않고 과거 성공 자료라면 last success·범위·현재 지연을 설명한다. 새 권한 거부는 캐시 자료도 fail closed한다. 민감한 source는 허용된 scope에서만 사용하며 임의 공유·수신자 추가를 실행하지 않는다.

추가 프레임: 앱 0·pin 0·folder·표시 예산 밖 badge·개인 hidden·긴 영문명·관리 entry, 검색 0/오류, 필수 0/복수/기한 지남, 이미지 없음, source 삭제·권한 회수, calendar 일부 누락·다른 시간대, AI unavailable·근거 없음·user pin/feedback/Undo·intent 수정, policy disallowed·expired session, dirty save/failed/conflict/policy change.

## 반응형·접근성·프레임 ID

1440×1000, 1280×900, 390×844, 320×720 및 실제 browser 200% zoom·별도 text 200% frame을 제작한다. 1920은 폭 preset 비교 보조다. 모바일 DOM·Tab 순서는 `Context → compact launcher → AI intent 입력·짧은 근거/관련 앱 → compact 필수 확인 → 확장 근거/preview → 시간/응답/대기 → 관련 일반 소식 brief 또는 아래 소식`이다. 첫 화면에서 AI 입력의 목적과 행동을 알아볼 수 있게 하며 필수 rail은 보조 위계로 유지한다. 320/200%에서 모든 근거를 한 화면에 억지로 넣지 않고 동일 의미 순서로 이어진다. stage를 화면 높이에 가둔 영역별 스크롤로 만들지 않는다. 한·영 긴 질문과 답변, citations·대상 scope·badge·예산을 읽을 수 있게 reflow한다.

| Frame ID                                 | 내용                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A01-D1440-STAGE / A02-D1280-STAGE        | 첫 viewport의 AI intent·근거·관련 앱이 주 지면, compact launcher·필수 확인은 보조 rail. 일반 소식은 관련 brief 또는 아래 |
| A03-M390 / A04-M320                      | Context→launcher→AI 입력·짧은 근거/관련 앱→compact 필수→확장 근거/preview→시간/응답→관련 소식, 단일 문서·DOM·Tab 순서    |
| A05-Z200 / A06-TEXT200                   | zoom/큰 글자·긴 질문/라벨/citation·visible focus                                                                         |
| A07-INTENT-ANSWER / A08-EVIDENCE         | 실제 질문·권한 source 응답·citation 선택·관련 자료                                                                       |
| A09-PLAN-DRAFT / A10-PREVIEW-CONFIRM     | scope/영향·수정·미지원 action·명시적 확인                                                                                |
| A11-OWNER-RESULT / A12-RECOVERY          | 실제 receipt·실패·timeout·결과 불확실·중복 방지                                                                          |
| A13-SCENE-PREMEETING / A14-SCENE-FOCUS   | 사용자가 고른 상황 전환·기존 focus/설정 유지                                                                             |
| A15-LOW-VOLUME / A16-WEEKEND             | 낮은 업무량·퇴근 후/주말·기준일                                                                                          |
| A17-PARTIAL / A18-FORBIDDEN / A19-STALE  | 일부 원천·권한 회수·원본/AI run별 지연 범위                                                                              |
| A20-INITIAL-REFRESH / A21-AI-UNAVAILABLE | initial/background·AI run 실패·degraded 원본 접근                                                                        |
| A22-NO-SOURCE / A23-UNSUPPORTED          | 근거 없음·source 삭제·미지원 intent, 추론 금지                                                                           |
| A24-APP-PANEL / A25-EDITOR-CONFLICT      | 앱 검색·pin/folder·gallery·dirty/save/conflict                                                                           |
| A26-MODE-PRESET-PRESERVE                 | 세 모드/세 폭/기존 layout의 불변 전후표                                                                                  |
| A27-EN / A28-DARK / A29-HC               | 긴 영어·dark·고대비·citation·state·focus                                                                                 |
| A30-KEYBOARD-REDUCED                     | input→evidence→preview→confirm 순서·scene 정적 대체                                                                      |
| A31-CONCEPT-COMPARISON                   | 두 시각대안 및 Classic/Flow/AI Stage 첫 viewport 비교                                                                    |

접근성 목표: main/nav·한 h1·section headings·skip link, 일반 텍스트 4.5:1·큰 글자/필수 UI 3:1, 주요 44×44 CSS px target·icon accessible name·visible focus. source·추론 여부·scope·표시 수/전체 수·원본 이름을 screen reader가 읽을 수 있다. 답변/run 진행의 live region은 사용자 입력을 방해하지 않도록 예산을 두고 매 token마다 읽게 하지 않는다.

Enter/Space/Escape/PageDown·touch swipe·scene keyboard 선택·source citation focus·입력 보존을 설계한다. 명시적으로 focus를 옮긴 dialog/menu/listbox만 내부 scroll을 허용한다. 닫으면 trigger focus·문서 위치를 복원한다. reduced motion에서는 자동 movement 없이 계획 결과·상태·scene 선택 의미가 유지된다. Floating assistant 또는 기존 DWAI·ON 진입이 마지막 action·footer를 가리지 않는다.

## 산출물·평가

위 frame 전체, 두 대담한 시각 대안과 선택한 주안, reusable Stage/intent/evidence/preview/source/context components와 states, source·AI capability CURRENT/EXTEND/NEW_API/EXTERNAL 계약표, mode projection 보존표, clickable flow, context transition·focus/reduced motion 주석, 미확정 계약·추가 연구 목록을 제공한다.

동일 계정·원본·viewport에서 Classic의 조직 편집 지면, Flow의 개인 실행 위계, AI Stage의 의도→근거→준비 장면을 나란히 비교한다. 제목을 가려도 주 행동과 composition이 다르게 보여야 한다. AI가 핵심 역할을 하는지, 실제 질문이 원본 자료와 앱의 다음 행동으로 이어지는지, source/사용자 control/오류 복구가 완성돼 있는지 검토한다.

새 AI 채팅 앱 복제, 단순 카드 행, 근거 없는 추론·자동 실행·가상 receipt, source 권한 우회, 사용자 설정 유실, 무한 carousel·장식 motion은 수용하지 않는다. 이 디자인은 제3모드 제안이며 현재 제품 구현·배포·운영 활성화·전체 검증 완료가 아니다.
