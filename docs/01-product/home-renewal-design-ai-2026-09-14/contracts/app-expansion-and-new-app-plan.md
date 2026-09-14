# 앱별 확장 메뉴·신규 앱·AI 실행의 제품 경계

사용자의 추가 요구: 제3 모드에 놀라운 역동성과 AI의 큰 역할, 이를 뒷받침할 앱별 신규 메뉴·기존에 없는 신규 앱까지 포함한다. 아래는 설계 후보이며 실제 등록 route·permission·API가 아니다. CURRENT는 정적 소스 근거이며 운영 활성 확인을 뜻하지 않는다. 신규 경로는 구현 단계에서 제품 manifest와 owner에 따라 확정한다.

## 제3 모드: Adaptive / AI Stage(가칭)

Classic의 조직 포털이나 Flow의 업무 큐와 다른 **AI가 구성한 문맥별 작업 공간**을 제안한다. 사용자는 “내일 고객 워크숍 준비해줘”처럼 의도를 입력하고, AI는 허용된 일정·업무·자료·협업 상태를 근거로 준비할 일을 조합한다. 홈에서 문맥을 선택하면 실행 앱과 관련 자료가 함께 나타나고, 다음에 돌아와 같은 작업을 이어간다. 앱 아이콘을 누르는 경험을 넘어 관련 업무를 묶어 시작하는 경험이다.

‘MZ’를 나이로 분류하거나 강제 게임화하지 않는다. 빠른 피드백·직접 조작·자기 표현·가벼운 협업·자율성을 원하는 사용자에게 매력적인 경험을 설계한다. 색·움직임 강도와 밀도를 사용자가 조정하고, 접근성·집중 모드에서도 핵심 효용은 같다. 성과 순위·감정 추정·동료 위치 추정·보상 점수는 이 요구의 대체물이 아니다.

### AI의 다섯 책임

1. **근거 있는 브리핑:** 확인된 의무·다가오는 약속·누락된 준비를 짧게 연결하고 출처·기간·확인 시각·불확실성을 보여준다.
2. **의도 이해와 자료 구성:** 사용자가 고른 scope에서 관련 자료·앱·업무를 검색/연결한다. 자료가 없거나 접근 불가면 그 사실을 말한다.
3. **초안:** 회의 준비·메시지·업무 계획·요청 등의 초안을 편집 가능한 결과로 제공한다. 초안≠전송≠원본 업무 완료다.
4. **검토 가능한 실행 연결:** 실제 가능한 owner 행동과 입력·대상·영향을 보여주고 필요한 확인 뒤 원본 시스템으로 handoff한다. 제공된 preview를 자동 실행으로 확대하지 않는다.
5. **이어하기·피드백:** 작업 문맥·초안·근거·실행 결과를 다시 찾고 “관련 없음/근거 수정/연결 해제”로 사용자가 통제한다.

## 현재 AI와 추가 계약

| 확인된 기반                                                                                    | 이번 확장                                                                  | 경계                                                                                                         |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| DWAI·ON `/dwaion/home`, 새 대화/대화 이력/활동/제안/에이전트/행동/루틴/개인 통제/아티팩트 메뉴 | 홈 문맥에서 기존 대화·제안·아티팩트로 연결, 문맥/근거·복귀 유지            | 새 독립 AI 채팅 앱을 중복 개발하지 않음                                                                      |
| DWAI 아티팩트의 autosave·version·preflight·publish·export 소스                                 | 문맥별 자료/업무 참조를 아티팩트와 연결하거나 별도 공유 작업 공간으로 확장 | 아티팩트 게시·원본 자료 권한·공동 편집은 각각 계약 확인                                                      |
| `/api/agent/v1/plans/preview`                                                                  | 홈에서 계획 검토를 열고 필요한 owner 행동으로 이동                         | 현재 클라이언트는 REVIEW, `mutationAllowed=false`, `referenceMode=true`를 검증. 실행 완료 버튼으로 표현 금지 |
| Agent handoff origin: APP.ASK의 `/dwaion/new` 또는 대화 UUID, action-shelf                     | 홈 출발의 문맥·원본 대화·request/run/correlation 연결                      | 홈 origin은 현행 허용 규칙에 없으므로 EXTEND/NEW_API                                                         |
| 홈 추천 source/evidenceCount/confidence/ruleVersion+feedback                                   | 근거 열기·추천 수정·참조 데이터 범위 표시                                  | 추천 confidence를 사실 정확도·직원 평가로 사용하지 않음                                                      |
| 홈 Studio AI의 규칙 기반 preview/apply/undo                                                    | 설명 가능한 배치 제안·이관 미리보기                                        | 현재 FOCUS_DEADLINES/BALANCE_DAY/REDUCE_NOISE 규칙은 생성 AI 업무 실행이 아님                                |

직접 근거: `apps/dwp/src/features/dwaion/dwaion-navigation.ts`, `dwaion-artifacts.tsx`, `libs/shared-utils/src/api/agent-plan-api.ts`, 홈 overview/studio 모델. 새 홈 AI context projection·검색·개인 기억·루틴·실행은 각각 필요한 실제 계약을 확인한다. 무제한 전사 데이터 수집을 전제하지 않는다.

## 승인 내 앱 18개 각각의 확장 검토

각 행의 확장 화면은 [P12](../prompts/12-cross-app-expansion-menus.md)의 상세 설계 대상이다. 실제 기존 메뉴가 같은 목적을 이미 해결하면 기존 화면의 탭/상세를 확장하며 해당 사실을 디자인 주석에 표시한다. 필요한 새 메뉴·신규 앱은 배제하지 않는다.

| 앱        | 현재 기반/확인 한계                                                             | 신규 또는 확장 화면 후보·주 질문                                                             | 홈 제공 콘텐츠·필요 계약                                                                    |
| --------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 업무      | queue/action-required/day-plan/in-progress/awaiting-response/completed 실제 nav | **문맥별 업무 묶음**: 이 목표를 위해 무엇을 이어 처리하나? 기존 업무 상세/계획 확장          | 개인 업무·계획 CURRENT, cross-app context ref/version EXTEND/NEW_API                        |
| DWAI·ON   | 대화/제안/행동/루틴/개인통제/아티팩트·앱 관리자 실제 nav                        | **홈 브리핑·문맥**, 기존 개인통제·아티팩트 확장                                              | evidence-based brief·intent·plan preview·원본 handoff EXTEND/NEW_API                        |
| 활동      | 현재 실행 summary와 과거 활동 분리                                              | **문맥 타임라인**: 최근 어디까지 진행했나? 기존 활동 필터/상세 확장                          | 이벤트와 현재 업무 구분 CURRENT/EXTEND, source relation NEW_API 가능                        |
| 전자결재  | task 조회와 승인/변경 권한 분리                                                 | **결재 준비 묶음**: 검토에 필요한 자료는 무엇인가? 기존 task 상세 확장                       | 실제 의무 CURRENT, 관련 자료·AI 초안 EXTEND; 원본 승인 경계 유지                            |
| 알림      | 앱별 metrics·unavailableSources·채널 설정                                       | **업무 문맥 구독**: 어떤 변화만 받을까? 기존 설정·구독 확장                                  | badge≠의무, context subscription/quiet hours cross-app EXTEND/NEW_API                       |
| 소식      | 조직 필수/일반 콘텐츠 및 앱별 운영 경로                                         | **토픽·조직 읽기 공간**: 무엇을 알아야 하나? 기존 feed/detail 확장                           | 필수 확인 CURRENT, 명시적 관심 토픽/근거 NEW_API 가능                                       |
| 캘린더    | 오늘 일정·권한·원본 예약 흐름                                                   | **회의 준비**, **집중 계획**: 무엇을 준비하고 언제 할까? 기존 일정 상세/계획 확장            | event refs/참석 권한 CURRENT, 준비bundle·충돌preview EXTEND/NEW_API                         |
| 메일      | 앱 Home focusQueue/NEEDS_REPLY 등 있음, 공통 Home provider 연결 미확인          | **응답 준비**: 어떤 스레드에 무엇을 답할까? 기존 thread/reply 확장                           | reply-needed EXTEND, draft evidence NEW_API 가능, 전송은 Mail owner                         |
| Space     | 협업 공간 focusSpaces/recentActivity/insights                                   | **문맥 자료함**, **팀 준비판**: 이 작업의 관련 자료/사람은? 기존 공간 상세 확장              | 허용된 공간 업데이트 EXTEND, source-linked shared scene NEW_API 가능                        |
| 근무 공간 | Workplace 현재 이용/예약·Calendar와 권위 구분                                   | **회의·출근 준비 묶음**: 장소·시간·이용 행동이 준비됐나? 기존 홈/예약 상세 확장              | 이용 준비 CURRENT/EXTEND; 계획≠도착≠실제 위치                                               |
| 메신저    | Home mentions metric·priority, 개별 미처리 mention 목록 계약 미확인             | **멘션 대응**, **문맥 대화**: 어떤 대화에 응답할까? 기존 대화 상세 확장                      | metric EXTEND, actionable mention identity/status NEW_API 확인 필요                         |
| 화상회의  | next/active/today+capabilities 앱 Home                                          | **회의 전 준비·후속 실행**: 자료·안건·후속 일은? 기존 meeting 상세/후속 확장                 | next meeting EXTEND, 녹취/요약은 실제 권한/생산자 계약; 회의참석≠공간확보                   |
| 서비스    | 요청·응답 의무·운영 catalog 있음                                                | **요청 진행·준비**: 어디서 막혔고 어떤 응답이 필요한가? 기존 요청 상세 확장                  | request tracking CURRENT, evidence bundle/owner-required-input EXTEND                       |
| 인사      | SOURCE/MANUAL/REFERENCE 등 origin/availability 제공                             | **나의 신청·성장 연결**: 확인된 신청과 안내는? 기존 개인 인사/서비스 연결                    | 확인된 domain만 CURRENT, 성장/LMS 연계 NEW_API/EXTERNAL, 급여 홈 기본 비노출                |
| 지식      | launcher/category 확인, security-trimmed corpus/search/recent API 미확인        | **지식 탐색·보관함·근거 보기**: 믿을 자료는 어디에? 실기능 구축 후보                         | corpus/ACL/revision/index freshness/search/saved NEW_API, 외부DMS EXTERNAL                  |
| ERP       | launcher와 실 업무 task API 별개                                                | **ERP 업무 연결**: 외부 확정 의무는 무엇인가? 연결 후 앱 상세 landing                        | task identity/status/owner receipt/SSO EXTERNAL; 미연결≠0                                   |
| 레거시    | launcher와 connector content 별개                                               | **연결 상태·외부 업무 진입**: 어떤 시스템을 이어 쓸까? 기존 registry/앱 진입 확장            | connector capability/health/deeplink/SSO EXTERNAL; 비밀키 사용자 노출 금지                  |
| 관리      | 중앙 24개 메뉴+legacy, DWAI/개별 앱 admin별도                                   | **홈 확장 운영**: 위젯·AI·source가 누구에게 어떻게 적용되나? 기존 catalog/policy/studio 확장 | widget version/permission/health/proposal/rollout/receipt 계약. 앱별 admin과 중앙 권위 구분 |

## 신규 앱 후보: 독립 제품이 필요한 경우

신규 앱은 홈을 화려하게 채울 장식이 아니라, 자기 owner·영속 데이터·권한·수명주기·운영 메뉴를 갖는 업무 목적이 있어야 한다. 아래 두 후보는 디자인 확장안이며 지금 운영 앱에 등록하지 않는다.

| 후보                                | 독립 앱의 이유                                                                       | 기존 앱과 책임 구분                                                                               | 홈 연결·구현 조건                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Work Canvas / 작업 캔버스(가칭)** | 여러 앱의 업무·자료·AI 초안·준비를 하나의 지속 가능한 문맥 단위로 저장·공유·이어하기 | Work는 의무, Space는 협업 원본, DWAI는 대화·AI 아티팩트, Canvas는 source 참조와 공유 문맥의 owner | 명시적 scene membership/source refs/access policy/version/history/archive API. DWAI/Space 확장으로 같은 목적을 해결하면 별도 앱 없이 같은 디자인을 하위 공간으로 채택 |
| **Learning & Growth / 러닝(가칭)**  | 과정·학습 계획·신청/이수·인증·개인 학습 진척의 독립 수명주기                         | 지식은 자료, 인사는 공식 인사 기록, 러닝은 학습 활동과 과정 owner                                 | native course/enrollment/progress APIs 또는 검증된 LMS EXTERNAL, 사용자 선택 목표. 인사평가·동료순위로 연결하지 않음                                                  |

Work Canvas는 AI Stage의 깊은 이어하기를 지원하는 우선 검토 후보다. 러닝은 선택적 생태계 확장안이며 홈 기본에 임의 추천·가짜 이수율을 넣지 않는다. 신규 Automation 앱은 현재 DWAI 루틴/행동·관리자와 겹치므로 우선 기존 DWAI를 확장한다. 신규 Community 앱도 기존 소식/Space/메신저와 겹치므로 별도 owner가 필요한 고유 workflow가 확인될 때 분리한다.

## 확장 인터페이스의 최소 명세

문맥은 title/purpose/owner/members/visibility/sourceRefs/tasks/artifacts/sceneVersion/createdAt/updatedAt/archiveState를 후보로 가진다. 이는 새 schema 제안이다. sourceRefs는 원본 app/object/revision/permission/freshness를 가리키며 원본 내용을 무제한 복제하지 않는다. 공유된 문맥은 참조 원본의 접근권한을 자동 부여하지 않고 source마다 허용 preview를 다시 확인한다.

AI intent는 사용자 입력·선택 scope·근거·생성시각·제안 steps·검토된 입력·plan hash·origin·확인 필요·원본 도착점·receipt를 가진다. 원본 owner에서만 쓰기 권한/버전/멱등성을 검증한다. 복수 앱 실행은 부분 성공·대기·실패·결과 불명을 step별로 구분하며 존재하지 않는 범용 atomic transaction/rollback을 가정하지 않는다.

위젯은 `contracts/widget-extensibility-contract.md`에 따른다. 신규 앱에는 manifest·nav·route·resource/permission·API/DB·event producer·Home contribution·AI tool capability·관리/모니터링·i18n·a11y·테스트가 필요하다. 사용자 화면에는 기술 명칭보다 실제 질문·현재 상태·주 행동을 보여준다.

## 디자인 패키지와 실제 개발의 순서

AI Stage 주력 시안 → 핵심 문맥 사용 흐름 → P12의 앱별 확장 화면 → P13 신규 앱 선택안 → 반환 결과의 owner/권한/데이터 검토 → 필요한 새 메뉴·API·앱 구현이다. 원본이 없는 상태에서 가짜 활동·임의 실시간 숫자·전송 성공을 제품에 반영하지 않는다. 이 문서는 신규 기능을 검토 범위에 넣는 것이며 사용자에게 불필요한 사전 승인 흐름을 추가하는 문서가 아니다.
