# 홈 위젯·연동 데이터 전문가 감사

검토일 2026-09-14. 읽기 전용 검토 기준: `dwp-dev / 8b9975e4e69a80e653618beae71305e91dd0d969` 및 현재 작업 트리. 제품 소스·설정·서비스·테스트는 변경하거나 실행하지 않았다. 아래의 ‘이미 있음’은 프런트엔드 구현/계약이 있다는 의미이며 실제 서버 배포·실시간 데이터 품질 인증이 아니다.

## 핵심 판단

홈의 가장 큰 기회는 카드 수를 늘리는 일이 아니라, 여러 앱에 흩어진 사용자의 의무를 원천 상태와 권한에 맞춰 한 번만 보여주는 일이다. 기존 Flow contribution 모델은 이미 이를 위한 구조를 갖고 있다. 이 기반을 보존하면서 Classic의 디자인과 공통 개인화 경험을 개선해야 한다. Mail·Messaging·Space·화상회의에는 앱 전용 홈 API가 있으므로 내용을 가져올 수 있지만, 아직 DWP 공통 홈 provider가 연결됐다고 볼 수 없다. ERP·지식·레거시는 앱 카테고리 존재와 실데이터 API 존재를 구분해야 한다.

## 실제 위젯과 모드의 의미 차이

개인 위젯 catalog는 7개, 조직 관리 영역은 `announcements` 1개다. 앱 아이콘 18개가 위젯 18개 또는 데이터 연결 18개를 뜻하지 않는다.

| 저장 key            | Classic의 현재 의미 | Flow의 현재 alias/의미         | 보존할 사용자 질문                              |
| ------------------- | ------------------- | ------------------------------ | ----------------------------------------------- |
| command-rail        | 업무 요약/지휘 영역 | action-queue / 처리할 업무     | 지금 무엇부터 처리해야 하는가?                  |
| schedule            | 일정                | today / 오늘 흐름              | 오늘 언제 어디서 무엇을 하는가?                 |
| daily-brief         | 추천/브리프         | response-hub / 답변 필요       | 내가 응답해야 다음 단계가 진행되는가?           |
| focus               | 우선 업무           | request-tracker / 요청 추적    | 내가 요청한 일은 어느 단계이며 무엇이 막혔는가? |
| activity            | 활동                | role-pulse / 역할 신호         | 내 역할에서 오늘 확인할 예외가 무엇인가?        |
| focus-balance       | 집중 시간           | 집중 시간                      | 일정 사이 실제로 쓸 수 있는 시간은 얼마인가?    |
| meeting-load        | 오늘 회의 부하      | 오늘 회의 부하                 | 회의 밀도와 충돌을 어디서 확인할 것인가?        |
| announcements(조직) | 사내소식            | 필수 확인·사내소식 구성에 사용 | 꼭 확인할 소식과 알아둘 조직 맥락은 무엇인가?   |

**중요한 설계 제약:** Flow는 Classic 저장 key를 1:1 alias로 재사용한다. 같은 key라도 내용이 다르므로 Classic/Flow를 독립적인 개인 화면으로 설정하고 세 번째 모드까지 저장하려면 모드별 key·schema·migration·복원 계약을 추가해야 한다. UI에서 토글만 늘리고 공유 layout에 저장하면 다른 모드의 설정이 바뀔 수 있다. 이 문제를 디자인 파일에서 숨기지 않는다.

## 날카로운 문제 도출

| 우선순위 | 문제와 근거                                                                                                                                                                                                            | 사용자 영향                                                             | 설계/개발 방향                                                                                                                                                              |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0       | 요약 숫자와 실제 업무목록은 단위가 다를 수 있다. 알림은 앱별 actionable/urgent 집계, 결재·Work는 개별 의무다. notification provider의 identity는 앱+lastActivityAt이라 개별 업무와 동일 객체 dedupe를 증명하지 못한다. | ‘답변 7개’가 실제로는 결재 3개와 같은 알림일 수 있다.                   | 집계를 개별 리스트와 합산하지 않는다. 알림 집계는 ‘알림 센터에서 확인’ 보조 신호로 표시하고 원천 의무목록을 우선한다. 객체·의무 identity가 제공될 때만 결합.                |
| P0       | 부분 조회와 0건은 다르다. personal Work loader는 최대 1000개/10페이지를 읽고 hasMore를 PARTIAL로 승격한다. HCM domainStates, notification unavailableSources, activity executionSummaryStatus도 부분 상태가 있다.      | 실패를 ‘할 일 없음’으로 오해하거나 실제보다 낮은 업무량을 믿는다.       | ‘확인된 8건 · 일부 원천 확인 중’처럼 범위를 표현한다. 미확인 source가 있는 성공색 0, 100%, ‘모두 완료’를 금지.                                                              |
| P0       | 앱 접근·소스 조회·실행 권한은 별개다. 결재 task VIEW와 APPROVE/UPDATE, 요청 VIEW와 UPDATE, 운영 ADMIN, Calendar UPDATE, Workplace UPDATE가 각각 구분돼 있다.                                                           | 홈에서 버튼만 보고 수행할 수 있다고 착각하거나 민감 preview가 노출된다. | 권한에 따라 제목/개수/내용/동작을 각각 제어. 홈은 상세로 이동하고 원천은 최신 권한·버전·상태를 재검증. 즉시 일괄 승인·제출을 디자인하지 않는다.                             |
| P1       | 현 홈 catalog와 실제 Flow purpose 이름이 개인화 content 설정에서 같은 의미로 보장되지 않는다.                                                                                                                          | ‘브리프’ 설정이 Flow ‘답변’에 영향을 주는 혼란.                         | 사용자가 보는 모드별 이름/설명을 일치시키고 원천·필터·보이는 행 수를 함께 preview. 개발 전 alias roundtrip을 명세.                                                          |
| P1       | app contributor 목록은 확장 가능성을 나타내는 metadata이지 provider 연결 자체가 아니다. 특히 Mail/Messaging/Spaces/VideoMeeting은 앱 홈 API만 존재.                                                                    | 디자인 AI가 가능한 데이터를 과장한 mock를 만들 수 있다.                 | 화면을 ‘현 기능 재설계’와 ‘연결 확장 제안’으로 분리. 신규 디자인 표본에는 연결 필요 annotation.                                                                             |
| P1       | HCM은 SOURCE/MANUAL/REFERENCE/MIXED/NONE/UNKNOWN과 domain availability를 제공한다.                                                                                                                                     | 참고 정보가 잔여휴가·급여 지급·근태 확정 수치처럼 보일 위험.            | 원천 확인된 domain만 실제 수치로 표현. reference/unknown은 ‘참고’/‘확인 필요’; 급여 금액은 공용 홈 기본 비노출.                                                             |
| P1       | Calendar today와 근무공간 today는 timezone date가 같아야 한다. workplace는 UTC superset 조회 후 zoned day 필터, Calendar는 date mismatch를 부분 실패로 처리.                                                           | 출장·해외 근무에서 다른 날의 예약/일정 노출.                            | 사용자 timezone을 기준으로 ‘오늘’을 설명. 일정↔예약↔회의 공통 identity가 없으면 같은 시간/제목만으로 합치지 않는다.                                                         |
| P1       | 원천 생성 시각이 없는 서비스/예약/개인 업무는 query observation을 snapshotAt으로 사용한다.                                                                                                                             | ‘실시간’이라는 표현이 실제 원천 갱신을 과장.                            | ‘조회 17:42’와 ‘원천 업데이트 17:40’을 구분. 홈 전체 freshness는 한 위치, 예외만 위젯 내부. TTL은 새 데이터 생성 주기가 아님.                                               |
| P2       | 큰 카드의 고정 높이·건강상태 반복·동일 데이터 차트 반복은 읽기 밀도를 떨어뜨린다.                                                                                                                                      | 첫 화면에 실제 업무가 없고 빈 공간이 많다.                              | 위젯마다 1–3행 기본 budget, 더보기로 원천 상세. 집중 시간과 회의 부하는 하나의 일정 인사이트 안 두 subview 후보로 비교. standalone 두 개 모두 기본 노출하지 않는 편이 낫다. |

## 이미 있는 강점: 없애면 안 되는 기능

- `HomeContributionInput`에는 kind/scope/priority/status/dueAt/deepLink/dedupeKey/sourceReference/generatedAt/privacy가 있고 UI와 provider를 분리한다.
- 권한을 통과한 항목에 대해 dedupe하며 DENY 우선·민감 정보 redaction을 지원한다. DOM attribute에서도 source ID를 노출하지 않으려는 정책이 있다.
- 읽기 실패, 금지, 연결 설정 필요, stale, 부분 실패를 provider별로 표현할 수 있다. 재조회 실패 때 마지막 성공 데이터를 부분 상태로 유지하고 인증 실패 때 캐시 내용을 숨기는 구조를 유지한다.
- Work는 personalTask·개인 day plan과 외부 의무를 구별한다. 서비스 응답 obligation은 Work로 연결하되 Work VIEW가 없으면 권한 있는 서비스 요청 상세를 유지한다.
- Activity의 과거 이벤트는 현재 업무 상태를 대체하지 않는다. 현재 실행 summary 조회 실패는 부분 상태로 전달한다.
- 추천 피드백 HELPFUL/NOT_RELEVANT/DISMISSED가 있다. AI recommendation에는 source/evidenceCount/confidence/ruleVersion을 제공할 수 있다.

## 권장 위젯 포트폴리오

이번에 보존 승인된 영역은 첨부 이미지의 ‘내 앱’이다. Classic은 조직 편집 포털, Flow는 개인 업무 실행 중심으로 첫 viewport부터 구분한다. 과거 Flow 요구의 배치 순서를 이번 두 모드의 고정 승인 순서로 확대하지 않는다. 최소 필수 확인은 공통으로 제공할 수 있지만, 일반 소식은 Classic에서 조직 맥락의 주요 영역으로, Flow에서는 실행정보 아래 compact brief 또는 별도 진입으로 배치한다. 필수 확인과 일반 소식을 같은 목록으로 복제하지 않는다. 권한/역할에 따라 빈 위젯을 무조건 채우지 않는다. 최대 수량은 데이터 의미를 기준으로 정하며 카드 숫자 경쟁을 하지 않는다.

| 후보 ID·단계                            | 업무 질문·예시 신호                                              | primary action              | 시각 형식·기본 노출                                                | 필요한 개발                                                                                                                          |
| --------------------------------------- | ---------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| W01 처리할 업무 · 이미 있음             | ‘오늘 내 차례인 의무는?’ 마감 2시간 이내 결재/근태/개인 업무     | 선택 업무 상세 검토         | 우선순위와 due cue가 있는 3행 목록, 기본                           | 기존 Flow purpose를 Classic에도 목적별 재사용 검토                                                                                   |
| W02 오늘의 흐름 · 이미 있음             | ‘다음 일정과 예약은?’ 14:00 회의 + 13:50 자리 체크인             | 일정/예약 상세              | 짧은 시간축 3행, 기본                                              | Calendar+Workplace 기존 provider 유지; 회의 합류 확장은 W09                                                                          |
| W03 답변 필요 · 이미 있음 + 연결 확장   | ‘내 답변 때문에 막힌 것은?’ 서비스 추가정보 1건, 결재 보완 1건   | 원천 또는 Work 응답 상세    | 의무별 목록 3행, 기본                                              | Mail/Messaging는 확인된 개인 응답 identity 제공 시 추가                                                                              |
| W04 요청 추적 · 이미 있음               | ‘내 신청은 어디까지 왔나?’ 장비 요청 대기/보완                   | 내 요청 상세                | 상태·최근변화·다음 단계 3행, 기본                                  | 원천 확정 ETA 없으면 도착예정일 생성 금지                                                                                            |
| W05 오늘 계획 · 연결 확장               | ‘오늘 하기로 한 일은 무엇인가?’ 선택된 개인 task 3개             | Work 오늘 계획              | 계획 task 2–3개와 예약시간, 개인 업무 사용자에게 선택 기본         | dayPlan API/provider는 pulse만 연결. 실제 plan 구성 필드 기반 별도 compact view 필요                                                 |
| W06 일정 균형 · 이미 있음 재조합        | ‘집중 시간과 회의 부담은?’ 확보 90분/연속 회의 3개               | Calendar 인사이트           | 하루 time band + 수치·기준; 선택 기본                              | focus-balance/meeting-load를 독립 저장 유지하며 합성 component 제안                                                                  |
| W07 조직 소식/필수 확인 · 이미 있음     | ‘내가 알아야 하고 확인해야 할 것은?’ 보안정책 확인기한·조직 뉴스 | 소식 상세/확인 절차         | 필수는 compact queue, 일반 소식은 이미지+제목+publisher; 둘다 상단 | existing communications feed/actionable slice 유지, 중복 표시/독자상태 동기화                                                        |
| W08 협업 재개 · 연결 확장               | ‘진행 중 Space에서 어디부터 이어갈까?’ 내 Space 최근 변경 문서   | 권한 있는 Space의 변경 상세 | Space 맥락 2행 + 변경 cue, 선택                                    | SpaceHome/SpaceActivity API 존재. 홈 provider·필드 안전 preview·세부 link 계약 추가                                                  |
| W09 다음 회의 준비 · 연결 확장          | ‘다음 회의에 바로 준비할 수 있나?’ 시작 10분 전/회의자료 준비    | 회의 상세/입장 전 확인      | 시간·참가권한·준비자료 1–2행, 선택                                 | VideoMeetingHome/capabilities 존재. Calendar origin identity·join policy 확인 필요                                                   |
| W10 메일 응답 · 연결 확장               | ‘보낼 답장이 남았나?’ NEEDS_REPLY/담당 sharedInbox               | Mail 해당 thread            | 발신자 안전명·제목·reply state 2행; W03의 source filter 기본       | MailHome focusQueue/triageLane API 존재. 별도 카드 기본 중복 금지. 홈 provider 필요                                                  |
| W11 메시지 언급 · 신규 API 보강 가능    | ‘내가 반드시 볼 언급은?’ 미확인 직접 mention                     | 대화의 해당 메시지          | conversation+mention cue 2행, W03 보조/선택                        | MessagingHome metrics.mentions와 priority는 있으나 미처리 mention별 목록·답변의무 계약은 확인 안 됨. unread를 needsReply로 해석 금지 |
| W12 임직원 마감 · 연결 확장             | ‘이번주 놓치면 안 될 개인 기한은?’ 근태·필수학습·복지창구        | 해당 HCM 상세               | 마감 2행, 역할/기한 있을 때 선택                                   | 기존 HCM pulse를 domain state 확인된 항목으로 세분화. 주별 상세 dueAt은 API 확인 후                                                  |
| W13 역할별 예외 · 이미 있음             | ‘관리자로서/운영자로서 볼 예외는?’ 팀 미처리/결재 연동 실패      | 해당 팀/운영 예외 상세      | 예외 1개와 영향·scope·마지막 성공, 해당 권한 기본                  | manager/operator는 역할만으로 ADMIN 허용 금지. 정상상태 반복 카드 비노출                                                             |
| W14 원천 상태 · 연결 확장               | ‘홈 정보가 믿을 만한가?’ 서비스 조회 지연·메일 연결 해제         | 내 연결 상태/재시도         | compact provenance popover 또는 작은 표, 상시 카드 대신 예외 표시  | 현재 provider states/notification source diagnostics 재사용. 관리자 connector health와 사용자 조회 상태 분리                         |
| W15 나를 위한 브리프 · 이미 있음 재설계 | ‘왜 이것을 먼저 볼까?’ 근거 2개+추천 이유                        | 근거가 있는 해당 작업 상세  | 짧은 근거문장+피드백 1개, 선택                                     | rule recommendation을 생성AI 판단처럼 표현하지 않음. source/confidence/feedback 유지                                                 |
| W16 지식 이어보기 · 향후 제안           | ‘최근 본 안전한 문서를 이어 읽을까?’                             | 원천 문서                   | 2행, 미연결 preview annotation                                     | knowledge 카테고리만 확인. 권한 필터 recent/saved API 필요. Space content·메신저 shared asset을 사내 지식 전부로 명명 금지           |
| W17 ERP/레거시 업무 · 향후 제안         | ‘내게 할당된 원천 업무의 안전한 시작점은?’                       | 원천 인증 후 대상 업무      | verified task가 있을 때 W01 source로 통합                          | catalog launcher로 가능한 것과 업무 API 분리. connector/SSO/object identity/status 계약 필요                                         |

W10/W11은 W03과 동시에 같은 item을 기본 노출하지 않는다. W05 계획의 task는 W01에도 있을 수 있지만 계획은 배정시간·오늘 선택 상태를 보여주는 별개 목적이며 요약 총량에 더하지 않는다. W13 집계는 W01 업무 합계와 합산하지 않는다. ‘오늘의 흐름’과 ‘다음 회의’는 하나의 이벤트 identity를 공유할 때 오늘 축의 작은 shortcut/세부 view로 제공한다.

## 후속 개발 게이트

1. 디자인 파일은 A: 현재 연결된 데이터의 재설계, B: 존재 API 연결 확장, C: 신규 API 필요 제안을 구분한다.
2. 신규 위젯은 등록 key·owner·authority·privacy·TTL·schema·허용 크기·content budget·deep link·empty/error·dedupe 계약을 먼저 확정한다.
3. 원천별 생성시각과 조회시각, 집계 단위, 범위, 커서/hasMore, 권한 변경시 캐시폐기, route surface policy를 검증한다.
4. 클릭 후 해당 원천의 실객체/필터로 도착하는지 확인한다. broad /home 링크는 집계일 때만 허용한다. 임의로 detail URL을 발명하지 않는다.
5. 실제 화면 반영 후 Home/Work 통합만 영향범위로 다시 검증한다. 과거 Work 완료 결과를 신규 홈 변경 인증으로 사용하지 않는다.

## 소스 근거

- [위젯 manifest/catalog](../../../../apps/dwp/src/components/workspace-composer/workspace-widget-catalog.ts)
- [Flow 저장 alias](../../../../apps/dwp/src/features/home/flow-home/flow-home-preference.ts)
- [Contribution 계약](../../../../apps/dwp/src/features/home/contributions/home-contribution-types.ts)
- [권한·source adapter](../../../../apps/dwp/src/features/home/flow-home/home-contribution-providers.ts)
- [Runtime query·partial 처리](../../../../apps/dwp/src/features/home/flow-home/use-home-contribution-model.ts)
- [현재-state 실패 정책](../../../../apps/dwp/src/features/home/flow-home/home-contribution-runtime-policy.ts)
- [개인 업무 조회 상한](../../../../apps/dwp/src/features/home/flow-home/home-personal-work-loader.ts)
- [HomeOverview 계약](../../../../libs/shared-utils/src/api/home-overview-api.ts)
- [HCM 원천/참고 domain 계약](../../../../libs/shared-utils/src/api/hr-api.ts)
- [MailHome 계약](../../../../libs/shared-utils/src/api/mail-api.ts)
- [MessagingHome 계약](../../../../libs/shared-utils/src/api/messaging-api.ts)
- [SpaceHome 계약](../../../../libs/shared-utils/src/api/space-api.ts)
- [VideoMeetingHome 계약](../../../../libs/shared-utils/src/api/video-meeting-api.ts)

상대 소스 링크는 문서 위치 기준이다. 최종 문서 패키지 QA에서 링크 경로를 정규화한다.
