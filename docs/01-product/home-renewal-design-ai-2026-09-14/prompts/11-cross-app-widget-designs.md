# P11 · 앱 콘텐츠 기여·위젯 세부 디자인·원천 운영 연결

P00 [공통 계약](00-common-contract.md), [원천 매트릭스](../contracts/widget-source-matrix.md), [확장 계약](../contracts/widget-extensibility-contract.md), P04와 함께 전달한다. CURRENT는 현재 소스의 경로·조회/명령 계약 확인, EXTEND는 기존 기능 연결/보강, NEW_API는 새 계약 필요, EXTERNAL은 외부 연계 의존을 뜻하며 P00와 동일하다. 홈 provider 연결 여부는 원천 매트릭스에 별도로 표시한다. 이 분류는 프레임 밖 annotation에만 둔다.

## 복사하여 전달할 프롬프트

DWP 홈을 뒷받침하는 위젯 컴포넌트와 각 원천 앱의 홈 기여 설정을 설계한다. 주 사용자는 개인 구성원이며, 관리자·운영자 variant는 해당 원천 권한이 있는 사람에게만 제공한다. 홈은 질문을 압축하고 원천 상세는 검토와 명령을 소유한다. Classic은 조직 편집 포털, Flow는 개인 실행, 제3모드는 근거를 바탕으로 상황과 의도를 연결하는 AI 경험이다. 아래 위젯을 전부 한 화면에 기본 노출하지 말고 모드·역할·질문별 구성을 만든다. 같은 데이터를 이름만 바꾼 카드로 중복하지 않는다.

### 필수 위젯 component 프레임

각 ID는 compact/medium/wide 및 1/2/3행 variant를 가진다. 390/320 mobile, 1440/1280 desktop, 200% 확대, ko/en, light/dark/high contrast, reduced motion, visible focus, touch 상태를 산출한다. 수치는 가상의 디자인 샘플이며 원천·단위·기간·범위·신선도를 annotation한다.

| Frame ID·구현 분류       | 사용자와 질문                                     | 필드·시각·기본 budget                                                          | 주 행동과 원천 명령 경계                                                                           |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| H11-W01 CURRENT          | 개인; 지금 내 차례인 일은?                        | title/status/priority/dueAt/source/obligation, 우선순위 3행·wide 4행           | 특정 Work/결재/근태 상세. 홈 즉시 승인 금지                                                        |
| H11-W02 CURRENT          | 개인; 다음 시간에 어디로 가나?                    | 사용자 날짜·시작/종료·제목·장소·예약 상태, 시간축 3행                          | Calendar event/Workplace 예약 상세. 대응 identity 없는 회의/예약 merge 금지                        |
| H11-W03 CURRENT+EXTEND   | 개인; 내 답변 때문에 막혔나?                      | 원천별 응답 의무·제목·상태·기한, 목록 3행+원천 필터                            | Work 응답/서비스/결재 상세. Mail/Messaging 연결은 확장. 발송/보완 제출은 원천 소유                 |
| H11-W04 CURRENT          | 신청자; 내 요청은 어느 단계인가?                  | requestId/title/source/status/lastChange/dueAt, 단계 cue 3행                   | 내 서비스/결재 요청 상세. SLA를 확정 ETA로 바꾸지 않음                                             |
| H11-W05 EXTEND           | 개인; 오늘 하기로 한 일은?                        | 계획에 선택한 task·배정 시간·완료 상태, 2–3행                                  | Work 오늘 계획. plan pulse는 현재 연결됐지만 상세 compact view는 추가 필요. W01 합계에 더하지 않음 |
| H11-W06 CURRENT 재조합   | 개인; 집중 시간과 회의 부담은?                    | 확보 시간·회의 시간·기준·하루 time band, 1축+2수치와 텍스트 등가               | Calendar 인사이트. 기존 두 위젯 독립 저장 보존, 같은 날 차트 중복 금지                             |
| H11-W07 CURRENT          | 전 직원; 필수 확인과 조직 소식은?                 | 발행자·제목·위험도·독자 상태·확인 기한·이미지, 필수 2행+편집 기사 teaser       | 소식 원문과 확인 절차. read와 ack 분리, 대표 게시물 중복 금지                                      |
| H11-W08 EXTEND           | 협업자; Space에서 어디부터 재개하나?              | Space명·민감 등급·최근 변경·내용 reference·안전한 actor명, 2행                 | Space 허용 변경 상세. 발견 가능한 Space의 본문 preview 금지, 공개/심사는 원천 명령                 |
| H11-W09 EXTEND           | 참가자; 다음 회의를 준비했나?                     | 다음 회의·시작·시간대·capability·자료 존재·참가 상태, 1–2행                    | 회의 상세/입장 전 권한 확인. join credential/token preview 금지. Calendar origin 중복 해결 필요    |
| H11-W10 EXTEND           | 메일 사용자; 어떤 답장을 보낼 차례인가?           | thread/account/안전한 제목/NEEDS_REPLY/workflow/importance/classification, 2행 | 메일 thread 상세. W03 원천 필터와 같은 thread 대표 1개, 홈 발송 금지                               |
| H11-W11 NEW_API          | 대화 사용자; 놓친 직접 언급은?                    | conversation/message/mentionId/unresolved/permissions/freshness, 2행           | 해당 메시지. 현재 mentions 집계/priority만 확인. 미응답 상태와 기한을 발명하지 않음                |
| H11-W12 CURRENT+EXTEND   | 구성원; 개인 인사 기한은?                         | 근태/학습/복지 domainState·dataOrigin·기한, 2행                                | 근태/학습/복지 상세. reference/unknown을 확정 수치로 표시 금지. 급여 금액 기본 비노출              |
| H11-W13 CURRENT          | 관리자/운영자; 영향 있는 예외는?                  | 팀 범위·운영 예외·현재 상태·영향·원천·마지막 성공, 1예외+2보조                 | 결재 운영/팀 인사 상세. 원천 ADMIN 권한 검증, 일반 역할 자동 허용 금지                             |
| H11-W14 EXTEND           | 개인; 정보가 믿을 만한가?                         | 원천·조회 범위·상태·생성/조회 시각·실패 원천, 작은 popover 표                  | 원천 재조회/내 연결 설정. 중앙 connector 상태와 개인 조회 실패 구분                                |
| H11-W15 CURRENT+EXTEND   | 개인; 왜 이 추천인가?                             | 추천 이유·원천·근거·confidence·ruleVersion, 근거 1문장+feedback                | 근거 확인/원천 작업 preview. 생성AI 확장은 evidence·intent draft·receipt 필요                      |
| H11-W16 EXTERNAL/NEW_API | 개인; 지식을 어디서 이어 읽나?                    | 원천 ACL·문서 reference·최근/저장 상태·민감 등급 필요, 2행                     | 원천 문서. 전체 corpus 미확인과 연결 필요를 annotation. 전체 지식 보유 주장 금지                   |
| H11-W17 EXTERNAL         | ERP/레거시 사용자; 원천 업무를 안전하게 시작할까? | 연결 후 source task/status/version/obligation/timestamp, W01 원천 variant      | 외부 인증 후 허용 객체. 가짜 구매/경비/업무 건수 금지                                              |

### 위젯별 상태·중복·freshness

각 컴포넌트에 H11-S01 초기 로딩, S02 정상 데이터, S03 진짜 빈값, S04 부분 조회/hasMore, S05 오래된 데이터와 마지막 성공 시각, S06 권한 없음/취소, S07 연결 필요, S08 원천 실패, S09 미지원 버전/퇴역, S10 명령 버전 충돌(409)을 만든다. 실패 원천을 0으로 표시하지 않으며 일부 확인 완료를 ‘모두 완료’로 표현하지 않는다. 권한 없는 제목·개수·인물·메일 preview를 보여주지 않는다.

홈 전체 조회 시각은 한 곳에 표시하고 원천별 예외는 위젯의 작은 cue와 inspector로 설명한다. 서버 generatedAt과 HTTP observedAt을 구분하며 TTL을 실시간 수집 주기로 설명하지 않는다. 상세 drilldown은 범위·시간·필터·객체 identity를 유지한다. 알림 집계를 Work/결재의 개별 의무와 합산하지 않는다. 목록의 더보기 개수는 원천 전체 건수인지 확인된 조회 건수인지 표시한다.

같은 객체가 다른 관점에서도 쓰일 때 linked focus를 줄 수 있으나 기본 목록 중복은 피한다. 사용자 편집에서 다른 관점으로 추가하는 기능은 명확한 목적 설명이 있을 때 허용한다. 시각은 시간축·단계·의무 목록·편집 기사·짧은 근거·원천 상태표처럼 정보 목적에 맞게 달라야 한다. 관련 없는 KPI 카드 행을 기본 구성으로 만들지 않는다.

### 기존 원천 앱 운영 메뉴에 붙일 기여 설정

중앙 홈 관리자는 위젯 등록·조직 배치·개인화 허용·모드 정책·템플릿을 소유한다. 콘텐츠 발행·서비스 양식·알림 규칙·Space 공개 심사는 기존 앱이 소유한다. 다음 영역은 **신규 홈 기여 UI와 필요 API 제안**이며 새 중앙 발행 메뉴를 만들지 않는다. 기존 route를 유지하고 그 안에 영향 preview를 추가한다.

| Frame ID | 기존 원천 관리 route                                                                           | 붙일 신규 영역과 질문                                                                                 | 권한·preview·결과                                                                                |
| -------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| H11-A01  | /communications/admin/content                                                                  | 이 게시물이 Classic 소식/Flow brief/필수 확인에 어떻게 보이나? featured·독자 범위·기한·이미지 preview | 원천 발행 권한 유지. 대상 preview는 가상 데이터. 관리자가 독자 확인을 임의 완료 처리하지 않음    |
| H11-A02  | /services/admin/catalog, /services/admin/operations                                            | 서비스 의무와 상태가 답변/추적에 어떻게 기여하나? 등급·SLA·상태 mapping                               | catalog/operations 권한 별도. template에 신청자 payload 복사 금지. 명령은 원천 상세              |
| H11-A03  | /notifications/admin/contracts, /notifications/admin/policies, /notifications/admin/operations | actionable/urgent 정의와 홈 집계의 중복 범위는? 원천 계약·조회 범위·예외 preview                      | 기존 정책 운영 권한. 개별 의무 identity가 없으면 집계 유지. 홈 관리 권한은 발송 권한을 주지 않음 |
| H11-A04  | /spaces/admin/content-reviews, /spaces/admin/lifecycle, /spaces/admin/operations               | 공유/발행/멤버 취소가 협업 재개 preview에 어떤 영향을 주나?                                           | Space 권한·민감 등급·guest·publication review 유지. discoverability와 본문 열람 구분             |
| H11-A05  | /mail/admin/connections, /mail/admin/shared-inboxes, /mail/admin/policies                      | 개인/공유 메일 범위·needsReply 정의·동기화·preview privacy는?                                         | 계정 membership과 필드 redaction. 공유 inbox SLA 과장 금지. 연결 credential 비노출               |
| H11-A06  | /workplace/admin (기존 management prefix)                                                      | 사이트/예약 정책·체크인 window·오늘 예약 기여는?                                                      | 정확한 하위 route는 후속 inventory에서 확정. owner/UPDATE 재검증. availability 검색은 원천 소유  |
| H11-A07  | /messages/admin (기존 management prefix)                                                       | 미확인 언급과 공유자료의 read/privacy/membership 계약은?                                              | 정확한 하위 route는 후속 확정. 미처리 mention 상태는 NEW_API. Space 미러 권한 취소 시 숨김       |
| H11-A08  | 결재/HCM/회의/DWAI의 기존 management surface                                                   | contribution manifest·허용 신호·민감 필드·AI context 허용의 영향 inspector                            | 실제 앱별 route/authority registry 후속 확정. 신규 메뉴/앱 계획은 P12/P13으로 분리               |

기여 영역은 등록 위젯·허용 목적·필드·권한·preview·신선도·상태 mapping을 읽기 쉽게 비교하며 정책 변경 preview·영향·버전·감사·rollback을 갖는다. 원천 관리 권한이 없는 홈 관리자는 요약 사유만 본다. ‘관리콘솔 가기’ 버튼은 실제 대상 route 권한을 확인한 뒤 제공한다.

### AI 입력·출력·원천 경계

제3모드 AI는 원천별 context reference·버전·신선도·확인 범위·민감 등급·권한을 입력으로 받는다. 결과는 왜 지금인지, 근거, 불확실성, 필요한 capability, 실행 의도 초안이다. 업무 완료는 실제 원천 action response와 receipt로만 표시한다. 원천 정보가 없거나 오래됐다면 AI는 ‘확인 필요’를 표현하며 연결되지 않은 ERP·지식·원천을 상상해 추천하지 않는다.

AI 위젯에는 H11-AI01 근거 inspector, AI02 실행 의도 초안과 영향 preview, AI03 원천 명령 확인과 진행, AI04 실제 receipt·부분 성공·복구, AI05 권한 취소·오래된 근거·버전 충돌을 만든다. 현재 DWAI/Work/Space/Calendar API 재사용과 신규 API 필요를 annotation한다. 고영향 승인·발송·공개·일괄 변경은 원천 governed workflow로 이어진다.

H11-AI06은 전송 후 연결 단절로 결과를 모르는 상태다. 원천 결과/감사 경로에서 확인하도록 안내하며 성공/실패를 단정하지 않는다. 원천마다 실제 지원하는 복구만 제공한다. 현재 홈 편집 proposal Undo와 메일·결재·예약 명령 취소는 서로 다른 기능이며 범용 undo/receipt 조회 API를 발명하지 않는다.

### 산출물

위젯별 질문·필드·원천·권한·단위/범위/날짜·신선도·상태·최대 행수·link·dedupe·component variant·키보드/터치·메뉴 소유권을 annotation한다. 템플릿은 stable ID·config version·기기 호환을 기반으로 preview한다. 미지원 위젯을 몰래 삭제하거나 새 설정을 최상위 메뉴로 남발하지 않는다. 미래 100개 위젯도 라이브러리 검색·분류·원천 요청 공유·컴포넌트 지연 로딩으로 확장되는 설계를 산출한다.
