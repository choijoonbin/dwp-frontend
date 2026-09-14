# P04 · 홈 편집·위젯 라이브러리·정보 표시·AI 편집 제안

디자인 AI에 P00 [공통 계약](00-common-contract.md), 첨부 [승인 내 앱](../assets/approved-my-app-2026-09-14.png), [원천 매트릭스](../contracts/widget-source-matrix.md), [확장 계약](../contracts/widget-extensibility-contract.md)과 함께 전달한다. 이 문서는 디자인 요청이며 현재 기능과 추가 개발을 구분한다.

## 복사하여 전달할 프롬프트

당신은 DWP의 홈 개인화 studio를 설계하는 엔터프라이즈 UX·인터랙션 디자이너다. 사용자는 일반 구성원이며 질문은 ‘내 역할과 업무에 맞게 정보를 추가하고 배치하되, 저장 결과와 영향 범위를 확실하게 이해할 수 있는가?’이다. primary action은 변경 검토 후 **홈 저장**. page archetype은 studio다. Classic은 내 앱만 보존하는 조직 편집 포털, Flow는 개인 업무 실행 화면, 신규 제3모드는 AI 중심 경험이므로 editor의 preview도 차이를 유지한다. 공통 ‘내 앱’의 네 category·아이콘·좌측 연속 배치와 크기를 승인 이미지대로 보존한다. 편집 화면을 화려한 카드 설정 목록으로 만들지 말고 실제 홈과 연결되는 작업공간으로 만든다.

### 프레임과 구조

| Frame ID | 화면·핵심 구성                                                                                            | 사용자 행동·결과                                                                                                       |
| -------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| H04-01   | 홈 읽기→편집 진입. 상단 화면명/경험모드/저장 범위, 편집 진입 focus cue                                    | 진입시 현재 스크롤 위치·focus·layout snapshot 보존                                                                     |
| H04-02   | desktop editor. 중앙 실제 홈 canvas, 우측 선택 위젯 inspector, 상단 저장/취소/위젯 추가/초기화, 변경 개수 | 위젯 선택시 같은 영역이 canvas/inspector에서 연결. width와 보이는 콘텐츠 깊이를 서로 다른 control로 제공               |
| H04-03   | widget library. 검색+업무 목적 필터+내가 사용 중/추가 가능/연결 필요/조직 제공 상태, 등록 widget preview  | 추가는 draft에 반영; 저장 전 영구 변경하지 않음. 추가 후 위치 cue와 Undo, 해당 widget으로 focus 이동                   |
| H04-04   | library 선택 inspector. 업무 질문/원천/권한 범위/보이는 데이터/기기 호환/등록 버전/추가 위치 preview      | 현재 가능한 것은 추가, 연결 필요한 것은 해당 앱의 내 연결 상태, 권한 없는 것은 이유/요청절차만. 민감 실제 preview 금지 |
| H04-05   | content settings. 선택widget/source/filter/fields/행 1·2·3/미리보기                                       | registered field와 preset만 선택. API 지원 필드picker는 추가 UI 개발. 자유 SQL·임의 source URL 입력 금지               |
| H04-06   | keyboard 이동 popover와 touch 이동 sheet. 이전/다음/맨위/아래/위치선택                                    | drag 없는 완전한 이동 대안. 결과를 live region에 발표, focus 유지                                                      |
| H04-07   | 변경 요약+삭제/중복 경고. 숨김, 크기, 순서, 앱 고정 전후                                                  | 같은 데이터 W03와 W10처럼 중복이면 source identity와 목적 차이 설명, 대체/취소 선택                                    |
| H04-08   | 저장중/실패/409. 내초안과 최신layout 비교                                                                 | 실패시 초안 유지. 최신 불러오기 또는 다시 검토; 권한·view 소멸이면 적용 불가 원인 표시. silent overwrite 금지          |
| H04-09   | 이탈·초기화 확인. 저장/버리기/계속편집, 복원 영향 범위                                                    | 초기화는 layout/config 범위만. source 업무가 삭제되는 표현 금지                                                        |
| H04-10   | AI 편집 제안. 세 규칙 의도 선택, 근거/변경목록/전후preview/경고/만료                                      | preview→명시적적용→Undo. 자동 적용 금지. 자연어 요청 및 AI 작성안은 ‘신규 제안’별도프레임                              |
| H04-11   | mobile editor. 단일 canvas, toolbar/선택속성 full-height sheet, library full-screen                       | 읽기 홈은 문서 한 scroll. overlay는 자체 작업scroll 허용. 하단 action이 320px/zoom에서 내용을 가리지 않음              |

### 정확한 위젯 목록과 현재 기능

현재 등록 목록은 일곱 개인 위젯이다. Classic 표시명은 업무 요약(command-rail), 추천 브리프(daily-brief), 우선 업무(focus), 일정(schedule), 활동(activity), 집중 시간(focus-balance), 오늘 회의 부하(meeting-load). Flow 표시명은 처리할 업무(action-queue), 오늘 흐름(today), 답변 필요(response-hub), 요청 추적(request-tracker), 역할 신호(role-pulse), 집중 시간, 회의 부하다. 저장 alias가 공통이라 같은 의미로 취급하지 않는다. 조직 소식은 governed zone이며 개인이 관리 정책을 해제할 수 없다.

확장 library에는 오늘 계획·협업 재개·다음 회의 준비·메일 응답·언급 확인·임직원 마감·원천 상태·근거 브리프를 제안한다. 원천 매트릭스의 CURRENT/EXTEND/NEW_API/EXTERNAL annotation을 유지한다. 지식/ERP/레거시 관련 콘텐츠는 연결 필요 상태와 필요한 계약만 보여주며 실제 업무 수치를 발명하지 않는다. 기능을 모드별로 무조건 복제하지 않는다. 미래의 widget 등록을 수용하는 slot/component와 검색 결과를 설계한다.

현재 gallery는 숨긴 등록 위젯 복원 dialog이다. 전체 탐색·검색·추천·preview·권한 상태 library는 새 UX/일부 신규 API를 요구한다. 현재 content UI는 보이는 행 1–3을 저장하며 API 계약은 필드·preset·itemLimit 1–20을 지원한다. 디자인은 읽기 preview에 실제 bounded 행을 보여주며 한도를 높여도 nested scroll을 만들지 않는다. more는 원천 상세로 이동한다.

### 상태·데이터·AI 경계

일곱 source는 성공/진짜 0건/부분 실패/연결 필요/권한 없음/퇴역/unknown version/로딩/오프라인/재시도 실패를 가진다. 사용할 수 없는 widget을 데이터 0으로 preview하지 않는다. preview는 synthetic 샘플 또는 사용자가 권한 있는 데이터이며 restricted/classification 정책을 따른다. 추가 후 권한이 없어지면 private 내용을 즉시 숨기고 안정 ID와 설정을 보존한다.

추천에는 ‘내가 선택한 역할·현재 scope·허용 원천·이유·추가 시 영향’을 보여준다. 인기도만으로 개인 추천을 설명하지 않는다. AI 편집의 현재 세 의도는 FOCUS_DEADLINES/BALANCE_DAY/REDUCE_NOISE의 규칙 proposal이며 생성AI의 전면 홈 설계처럼 묘사하지 않는다. 신규 자연어 편집은 context source/version/freshness/permission과 effect preview·action receipt를 필요로 한다. 자동으로 없는 source를 상상하거나 모르는 위젯 키를 만들지 않는다. fixed/required 영역 변경은 불허 이유를 보여준다.

### 반응형·접근성과 산출물

1440/1280 desktop, 390/320 mobile, 200% 확대 프레임을 만든다. ko/en 긴 이름·서로 다른 줄바꿈, light/dark/high contrast, reduced motion, keyboard-only, 44px touch, visible focus, dialog title/description/focus trap/escape/return을 표현한다. 방향키 이동·screenreader 변경 발표·drag alternative를 interaction annotation에 포함한다. future widget 30/100개 검색·호환 필터 상태도 보여준다. 고정 높이 빈 카드·decorative glow·계속 움직이는 장식은 사용하지 않는다.

컴포넌트/토큰/variant/interactive prototype/상태 table/개발 annotation을 산출한다. width 표준/와이드가 실제 span과 preview로 구분되고 저장·재조회·모드·기기 scope가 설명돼야 한다. 모드 독립 저장 및 새 library contract는 추가 개발이며 현재 지원을 주장하지 않는다.
