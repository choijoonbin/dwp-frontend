# 위젯 확장성·편의성·AI 기여 계약

현재 catalog의 manifestVersion/ownerProduct/dataSource/sourceAppResourceKey/contributorAppResourceKeys/freshnessSeconds/privacyClass/retention/lifecycle/policyClass/allowedSizes/allowedHeights/configuration/recipientContextBinding 구조를 출발점으로 삼는다. 아래 추가 항목은 신규 설계 계약이며 현재 구현됐다고 주장하지 않는다. 목표는 미래 위젯을 추가할 때 홈 전체와 설정 메뉴를 다시 설계하지 않는 것이다.

## 등록·버전·소유

| 계약            | 요구사항                                                                                                                        | 사용자·관리 UI                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| stable ID       | `owner.widget-purpose` 같은 안정 ID. 표시 이름 번역·모드·외형과 분리. 기존 key의 의미를 바꾸거나 재사용하지 않음                | 라이브러리 상세에 소유 앱·등록 버전. unknown ID는 삭제 대신 안전 placeholder                                         |
| schema/version  | manifestVersion/configVersion/viewSnapshotVersion/sourceContractVersion 및 명시 migration. backward/forward compatibility 범위  | 새 버전 적용 전 영향 preview·template compatibility·migration 실패 복원 경로                                         |
| owner/source    | 제품 owner, source provider 목록, source contract, primary source, support route. contributor metadata는 실제 query 연결과 다름 | ‘앱 API 존재/홈 연결 필요/신규 API 필요/외부 연결’ 구분. 책임자가 없는 widget은 등록 불가                            |
| lifecycle       | ACTIVE/DEPRECATED/BLOCKED 기존 정책 보존. 신규 RETIRED/UNKNOWN 처리는 compatibility layer로 정의                                | deprecated는 기존 render 가능·신규 추가/복원 불가; blocked는 private data 없이 이유·대체안. 기존 설정 무단 삭제 금지 |
| tenant/feature  | tenant allowed·provider allowed·app entitlement·source authorized·mode/device capability·feature gate                           | unavailable 이유를 구체적으로 표시. 재시도 버튼으로 정책 불허를 해결하는 척하지 않음                                 |
| migration scope | Classic/Flow 기존 alias와 제3모드 독립 view/config/device/revision 명시                                                         | mode switching preview와 초안 처리. unknown 설정·기존 expanded geometry·appLayout 보존                               |

위젯은 임의 외부 JavaScript를 실행하는 플러그인 스토어가 아니다. 현재 runtime은 NATIVE다. 외부 runtime이 필요하면 별도 sandbox·origin·서명·API·권한 계약을 검토하며 디자인에서 현재 지원처럼 표시하지 않는다.

## 내용·크기·스크롤

크기는 CSS 절대좌표가 아닌 허용 tier(fifth/quarter/compact/medium/large/full)와 responsive span으로 표현한다. 높이 short/standard/tall/expanded는 콘텐츠 깊이 budget이며 긴 빈 공간을 강제하는 높이가 아니다. 읽기 기본 1–3행, 주요 업무 wide 4행 등 renderer policy를 등록하고 template preset과 실제 원천 총량을 구분한다.

모든 위젯은 작은 폭·200%·긴 ko/en label·light/dark/high contrast·reduced motion·keyboard/touch 상태의 component variant를 갖는다. 데이터 목록·상태·강조 수치를 같은 시각 형식으로 획일화하지 않는다. 그래프는 실제 기준·기간·비교 목적과 text/table 등가 정보가 있을 때만 사용한다.

읽기 홈은 문서 한 번의 scroll이며 위젯 내부 세로 scroll을 금지한다. 많으면 행 budget과 더보기/원천 상세를 사용한다. editor inspector/library/dialog의 작업 scroll은 허용하며 page scroll과 modal scroll의 focus/overscroll을 구분한다. 새 위젯이 자체 scroll을 요구하면 catalog 호환 검토에서 읽기 홈의 compact 표현을 먼저 정의한다.

## 데이터 상태·권한·원천

- 권한은 앱 entitlement→source read→object visibility→action capability 순서로 판정하고 explicit DENY가 우선한다. private preview를 권한 확인 전에 fetch/render하지 않는다.
- source envelope에는 generatedAt/observedAt/TTL/coverage/hasMore/classification/objectVersion/identity를 포함한다. query observation을 source 실시간 갱신으로 표시하지 않는다.
- loading/true-empty/partial/stale/forbidden/unavailable/configuration-required/unsupported-version 상태는 별도 copy/action을 갖는다. 실패가 0이거나 ‘전체 완료’로 보이면 안 된다.
- 집계(alert/event/counter)와 개별 business obligation을 합산하지 않는다. canonical source/reference/obligation identity로 권한 후 dedupe한다. 제목·날짜가 비슷하다는 이유만으로 업무를 합치지 않는다.
- deep link는 허용 product surface/real object/filter/time/scope를 유지하고 재진입 때 source 권한·version·상태를 재검증한다. 임의 /home link로 모든 세부 업무를 대체하지 않는다.
- 수명·보존 정책은 최소 원칙. 기존 catalog retention NONE을 존중한다. layout/template/revision은 데이터 snapshot·개인 payload를 저장하지 않는다.

## 추가·탐색·설정·복원 사용자 흐름

`편집 → 라이브러리 검색/목적 필터 → 권한·source·기기 호환 확인 → 안전 preview → 위치/중복 확인 → draft 추가 → Undo → 변경 요약 → 저장`을 표준으로 삼는다. 각 앱의 widget마다 새 설정 메뉴를 추가하지 않는다. 공통 inspector의 등록 필드·filter preset·행 budget·size tier에 넣는다.

추천은 업무 질문·역할/scope·허용 source·추가 시 효과·근거를 표시하고 popularity와 구분한다. 같은 의무가 기존 위젯에도 보이면 ‘대체’와 ‘다른 관점으로 추가’의 차이를 설명한다. 위젯 설정의 삭제·숨김·퇴역은 원천 데이터 삭제가 아니다.

확장 템플릿은 widget ID+config version+허용 mode/device+recipient context binding을 저장한다. publisher의 데이터·ACL을 복사하지 않는다. template 버전 update 시 적용 차이·필수 영역·가용하지 않은 원천·퇴역 위젯·개인화 보존 범위를 보여준다. 자동 update는 기존 사용자 layout을 바꿀 수 있으므로 별도 정책/preview/rollback 계약 없이는 수행하지 않는다. 현재 template 객체의 config/device 포함 여부는 P05의 현재 계약과 구분한다.

mutation은 version/idempotency/busy/409·실패 시 초안 보존·focus return을 갖는다. Undo는 현재 초안 동작과 서버에 적용된 proposal 되돌리기를 구분한다. revision restore는 layout/config/device 범위이며 원천 업무 상태를 복원하지 않는다.

## 성능·지연 로딩·요청공유

현재 provider는 shell에서 fetch한 데이터를 normalize하는 pure adapter이며 query/client 의존성이 없다. 이를 보존한다. 신규 widget마다 같은 API를 fetch하는 방법을 피하고 `tenant+user+accessFingerprint+source+scope+date/filter` 기준 query ownership을 공유한다. 단 source scope가 다른 요청을 같은 cache에 합치지 않는다.

모드별 첫 viewport의 주요 콘텐츠를 우선 fetch/render하고 아래 optional 위젯과 무거운 시각 컴포넌트는 지연 load한다. 원천 조회와 위젯 컴포넌트 load는 별도 오류·재시도 상태다. viewport 밖의 위젯이 권한 취소를 감지하지 못하는 구조는 금지한다. polling은 foreground와 가용 원천을 기준으로 하며 같은 원천 poll이 여러 위젯에서 중복되지 않게 한다.

조회 timeout·반복 실패·부분 원천·page cursor 상한·cancel/abort를 정의한다. 개인 Work의 기존 최대 1000개/10페이지 부분 조회 정책을 유지한다. 위젯을 숨겨도 다른 위젯이 같은 원천을 쓰면 요청을 중단하면 안 된다. telemetry는 위젯 ID·상태·지연 등 최소 정보이며 제목·메일 본문·인사 정보·credential을 수집하지 않는다. 수치 성능 budget은 실측 후 확정하고 임의 PASS를 주장하지 않는다.

## AI 중심 제3모드를 위한 context·intent·receipt

AI는 네 번째 원천권위가 아니다. 기존 Work/Calendar/Services/Approval/HCM/Space/Mail/Meeting의 권한 있는 신호를 이유와 함께 조합하고 사용자의 의도를 실행 draft로 번역한다. 생성AI가 모르는 source·object·status·capability를 상상하는 디자인은 금지한다.

| 단계                  | 필수 계약                                                                                                                                                                | UI 상태                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Context input         | tenant/user/scope/timeZone/locale, 허용 원천 목록, object/reference/obligation/version, evidence generatedAt/observedAt/coverage/classification, consent/memory boundary | ‘사용한 정보’ inspector. 가용하지 않은 원천 표시, 권한 취소 시 재생성·redaction              |
| Recommendation output | intent ID, 왜 지금인가, evidence reference/coverage/freshness, uncertainty, 필요한 capability, 예상 효과와 되돌릴 수 있는 범위                                           | 근거·마지막 확인·미확인 범위·추천 피드백. AI confidence가 원천 확정값을 대체하지 않음        |
| Intent draft          | source action contract·target/version·입력값·권한·고영향 여부·preview·영향 범위·review-required                                                                          | 초안 확인/원천에서 계속. 홈 즉시 승인·발송·결재·공개·일괄 변경 금지                          |
| Execution             | 원천 governed command, 재검증·idempotency·busy·progress·재시도/rollback 계약                                                                                             | 실행 중·부분 성공·실패·권한 변경·버전 충돌. optimistic ‘완료’ 금지                           |
| Action receipt        | 실제 원천 response ID/time/result/newVersion·audit reference·복구 route                                                                                                  | 완료 영수증·원천 상세. AI 문장만으로 수행 완료 주장 금지. 추가 API가 필요한 원천은 제안 상태 |

명령 전송 후 연결이 끊기면 결과는 ‘확인되지 않음’이며 성공이나 실패를 단정하지 않는다. 현재 원천이 제공하는 결과 조회/감사 경로로 확인한다. 범용 실행 결과 조회·undo·rollback API가 있다고 가정하지 않는다. 현재 Studio proposal undo는 홈 layout 변경 되돌리기이며 메일 발송·예약·결재의 취소를 뜻하지 않는다. 새 직접 명령이 필요하면 NEW_API로 대상·버전·권한·확인·진행·부분 성공·409·결과 불명·복구 계약을 별도로 작성한다.

HomeOverview의 현재 rule recommendation과 Studio의 FOCUS_DEADLINES/BALANCE_DAY/REDUCE_NOISE 규칙 proposal은 생성AI의 통합 intent contract를 제공한다고 볼 수 없다. DWAI APP.ASK·agent proposal/evidence·Work 의무 허브·Space collaboration·Calendar 계획을 재사용/확장한다. 신규 ‘AI 상황 허브/intent’ 메뉴와 앱 제안은 P12/P13 및 개발 계획에서 구분한다. 지식 corpus·ERP·레거시가 연결되지 않으면 AI가 그 정보를 알고 있다고 표시하지 않는다.

## 후속 구현 acceptance

미래 원천 1개/위젯 1개를 추가해 기존 홈·editor·library·template·device·revision·AI context가 새 최상위 메뉴·임의 좌표 CSS·중복 원천 query 없이 동작하는지 검증한다. 1440/1280/390/320/200%, 한영·테마·대조·reduced motion·keyboard·touch·focus와 unavailable/unknown/retired/409/권한 취소/partial/hasMore·모드 저장 독립성을 실제 소스 snapshot과 실행 결과로 검증한 뒤 완료를 주장한다.
