# P10 — 관리콘솔: 연계·거버넌스 전체 디자인 AI 프롬프트

[P00 공통 계약](00-common-contract.md), [메뉴·권위 계약](../contracts/account-admin-menu-inventory.md), P08/P09와 함께 사용하세요. **현행 생산성 커넥터 1개, 거버넌스 5개, legacy 감사로그 1개**를 모두 디자인합니다. 신규 원천·품질·변경 통제 작업공간 3개는 제안입니다. 중앙 콘솔에서 모든 앱의 원천 데이터·업무승인·AI 정책을 새로 소유하지 않습니다.

## 공통 운영 shell · `P10-S00`

사용자: 연계 운영자·플랫폼 SRE·감사 조사자·통제 책임자. 조직/권한 scope, 기간/관측 범위, 현재 live/paused/stale, 마지막 성공 갱신이 보입니다. 고객 업무 영향과 예외/결정을 인프라 상세보다 먼저 보여줍니다. 모든 chart는 추이/비교/분포/임계/관계 목적을 가지며 accessible text/table equivalent를 제공합니다. 선택은 업무 상세/상관분석/실제 앱으로 연결됩니다. 민감한 증거·개인정보·secret 대신 가상 데이터와 안전한 오류 코드를 사용합니다.

**읽기·검토·실행 경계:** 원천 위젯이나 AI 계획의 capability가 REFERENCE/REVIEW이면 조회·근거 확인·원본 앱의 검토 화면으로만 연결합니다. 실제 mutation과 EXECUTE는 해당 앱과 서버의 권한·승인·command 계약이 허용할 때만 제공합니다. 현재 client/API가 존재하는 것만으로 현재 사용자에게 실행 가능하다고 표시하지 않습니다. 신규 집계·원천 연결·릴리스 조정은 구현 예정 계약이며 운영 중인 기능으로 그리지 마세요.

## 1. 생산성 커넥터 · `P10-N01` · `/admin/integrations/productivity` · 현행

**사용자 / 질문 / 액션 / 유형:** M365 연계 운영자 / “메일·일정이 동의·권한·동기화 조건을 충족하며 직원 홈에 정확히 제공되는가?” / connector 설정 검증·활성/정지·문제 원인 조사 / connection operations + 설정 작업 흐름.

**구조:** connections/subjects/runs 현행뷰. 상단은 사용자 영향(연결필요/재동의/신선도지연/실패 stream), 아래 커넥터 목록-detail, readiness/consent, 선택 실행 trace. 활성 connector 수·연결된 구성원 수·stale stream·failed24h 지표는 각각 scope/분모/마지막 갱신을 가지며 클릭하면 필터가 연동됩니다.

**실제 지원:** provider MICROSOFT_GRAPH, authmode DELEGATED, resource MAIL/CALENDAR. connector lifecycle DRAFT/ACTIVE/SUSPENDED/RETIRED, health CONFIGURATION_REQUIRED/HEALTHY/DEGRADED/AUTHENTICATION_REQUIRED/UNAVAILABLE, policy REVIEW_REQUIRED/APPROVED/BLOCKED, 개인 consent NOT_CONNECTED/CONNECTED/REAUTHORIZATION_REQUIRED/REVOKED. 이 네 상태를 단순 초록`연결됨`으로 묶지 마세요. 다른 provider/app은 명시적 추가 제안입니다.

**필드·controls·detail:** connectorKey/displayName/providerTenantId/clientId/credentialReference/redirectUri/requestedScopes/policyState/version. credentialReference는 vault참조이지 secret입력 평문이 아닙니다. requested/granted scopes와 필요한 메일·일정 capability·최소권한/owner를비교. 설정 검증는개별 check/실행 차단 코드/checkedAt. runs는 INITIAL/DELTA/RESET, RUNNING/SUCCEEDED/PARTIAL/FAILED/BLOCKED, upsert/delete/skip/errorCount, retryAfterAt, safeErrorCode, correlationId, 마지막 성공. subjects에는 consent/토큰 만료지원 값과 홈 영향을 보입니다.

**flow:** connector생성/편집→필요 scope/자격증명 참조 확인→check→blocking문제해결→policy 조건확인→activate→개인 consent→sync관측→홈원천 신선도 확인. suspend에는영향 widget/계정/자동 sync정지와 재개 조건 preview→confirmation→진행→서버 상태. 현행 커넥터 수동 재 sync API가 확인되지 않았으므로 `지금전체동기화`를기존 action으로 발명하지 않습니다. 원천을 소유하는 mail/calendar앱의 재연결 경로와 중앙 설정 권위를 분리합니다.

**프레임:** DRAFTcheck, 차단된 정책, ACTIVE+개인재동의, PARTIALrun, staleCALENDAR/healthyMAIL, connector편집/버전 충돌, activation/suspend 확인·진행·실패, subjects/runs부분 실패, 안전한 오류 추적, 모바일 상세.

## 2. API 모니터링 · `P10-G01` · `/admin/governance/api-monitoring` · 현행

**사용자 / 질문 / 액션 / 유형:** 플랫폼 운영자 / “어떤 API문제가 직원 업무를 막고 최근 변경과 연결되는가?” / 문제 route/trace/변경조사 / service impact command center + trace investigator.

**구조:** 기간·observation point·service·method·outcome·search·autoRefresh/livepause context bar. action가능한 오류 요약→errorrate/p95/처리량 추세→문제 route비교→eventlist/추적 상세→최근 감사 변경 증거상관. 정상 경로반복은 압축합니다.

**필드·controls:** total/throughput/errorRate/p95/p99/activeRoutes, 기간과분모, 지연 임계값/baseline은 source가 있을 때 표시. API 경로 비교 표은 service/method/path/traffic/error/latency/최근문제 비교용. trace detail은 correlation/observation/timestamps/outcome/안전한 오류/연관 request·변경 증거. 홈위젯 source 실패→해당 API로 연결된 운영 예제. 검색필터는 URL/저장 상태 개선으로 보존하고 민감한 payload/검색어는 안전하게 취급.

**flow:** 오류 trend 선택→동일기간/서비스 경로필터→route 선택→trace→설정/권한/배포변경 audit→원천 owner복구 작업→관측 상태 검증. 모니터링 read를 API재실행이나 서비스 재기동 버튼으로 확대하지 않습니다. 자동 갱신은 조사 선택을 리셋하지 않고 stale/paused 상태를 노출합니다.

**상태/프레임:** 관측된 요청 없음과 수집 실패, overview 성공/events 실패/변경 감사 조회 실패, trace없음, pause/live, longpath/모바일 표의 동등 정보, 권한 제한, observation관측 범위 확인 불가, 접근 가능한 추세 차트, 선택 추적복귀.

## 3. 감사 관제 · `P10-G02` · `/admin/governance/audit-overview` · 현행

**사용자 / 질문 / 액션 / 유형:** 감사/위험운영 책임자 / “지금 우선 조사할 위험과 증거 수집 공백은 무엇인가?” / finding/case/source/drill-down / audit command center.

**구조:** H24/D7/D30/D90 scope/time, 긴급 findings·open/고위험 사건·거절된 접근·원천 수집 범위, 위험 영역/추이·업무량, 관련 수행자는가상/권한 제한. 첫 viewport에 결정할 일을 노출하고 숫자 카드 나열로 끝내지 않습니다.

**필드·detail:** severity/riskScore 정의·threshold/baseline/평가 기간, findings/cases 분모·상태, 증적 events/원천 상태·마지막 성공. actor활동은 감사 근거 맥락에만 제공하고 직원 근무 성실도 평가로 쓰지 않습니다. count클릭→동일 filter를 보존하는 findings/cases/evidence/source 운영.

**flow:** 우선 finding→조사 dossier→case담당/진행→증거추적→판정→통제복구/evidence. source불완전/권한 제한시 위험 0나 100%healthy를 표시하지 않고 coverage/조회 제약을 설명.

**프레임:** 위험분류·원천 수집 공백, no incidents healthy, 부분원천 조회 실패, 기한 초과 사건, 기간 변경 연동, 접근 권한 없는 영역, drill-down·키보드로 읽는 차트/table·mobile.

## 4. 조사 워크벤치 · `P10-G03` · `/admin/governance/audit-investigations` · 현행

**사용자 / 질문 / 액션 / 유형:** 책임조사자 / “이 위험의 원인·영향·증거와판단·후속 작업이 연결되어 있는가?” / finding분류·case생성/담당/작업/판정/종결 / investigation workspace.

**구조:** findings/cases queue, 선택 조사 상세, 별도 조치 패널. URL `?view=cases|findings&finding=…&case=…` 선택을유지. queue에는 open/critical/unassigned/breached, status/search. dossier에는 위험 근거·관련 증적/entity·timeline·현재담당/기한·judgment/action, case에는 notes/tasks/evidence/closure.

**필드·controls:** case title/description/priority/선택 위험 신호 연결, 위험 신호 상태·owner·판정 근거, task담당/기한/진행·결과, note, evidence event link, closure report. case/finding API+조치 패널의 현재 필드만 기존 기능으로 반영. 증거를 편집하거나 원천 사건을 삭제하는 UI는금지.

**flow:** queue 선택→context읽기→담당/기한·severity판단→case생성/연결→증거/엔터티추가·tasks→판정 근거→필요한복구 작업 source 앱연결→closure 조건 검증→종결 report/evidence. 미완료 task·필수 근거 없음은 종결 차단 조건. case 조회 부분 실패시 queue유지. 책임권한 `ADMIN.AUDIT_INVESTIGATE UPDATE`와 수행자 정책을 반영.

**프레임:** 위험 분류/사건 상세, unassigned/overdue, note/task/증거 연결, 종결 차단/종결 report, 맥락 조회 실패/taskfail/409, 권한 제한, URL 선택 back/focus, 모바일 조치 패널.

## 5. 증적 탐색기 · `P10-G04-C` / `P10-G04-E` · `/admin/governance/audit-events` · 현행

**사용자 / 질문 / 액션 / 유형:** 감사조사자·증거반출자 / “어떤 불변 사실이 있고 같은 업무 흐름의 증거는 어떻게 연결되는가?” / 검색·상관분석·case 연결·근거 있는 export / evidence query workspace.

**두작업공간:** 기본 correlations뷰와 `?mode=events` 증적 검색뷰. correlations는업무/command/actor/entity·transaction의 관계를 시간축/연결 tree/detail로; events는 저장 검색/filter/query/검색 결과 표/drawer로. 이미 있는 두 뷰를 하나의 범용 table로 줄이지 마세요.

**필드·controls:** window/category/severity/outcome/query, 고급 원천 필터/actor/target 등지원 filter, 불변 증적의 occurredAt/source/action/actor/target/outcome/classification/correlation/증거 맥락. 저장 검색의이름/범위/공유 권한은 현재 지원 필드에 맞춤. 증적 상세은가상 값/민감 field마스킹·접근이유. case 연결은선택 event/context를 보존. export는기간/대상/format/reason/권한·limit/retention 및 progress/result를실제 API에 맞춰표시.

**flow:** 필터 적용→queryURL보존→event/correlation 선택→관련 사실 보기→case 연결 또는 권한 있는 반출→사유/범위 preview→진행→반출 파일 받기/유효성·audit. event반출과 화면 목록 열람은 다른 permission. 결과가 복잡해도 무한히 높은 빈 차트를 쓰지 않습니다.

**상태/프레임:** noevents/원천 수집 지연/forbidden구분, 증적 상세 없음, 원천 부분 실패/상관분석 실패, 저장 검색deleteconfirmation, 반출 한도 초과 차단/denied/진행/실패, case이미연결/409, pagination/selection유지, 모바일 event목록·상세과 접근 가능한 상관관계 표.

## 6. 증적 거버넌스 · `P10-G05` · `/admin/governance/audit-governance` · 현행

**사용자 / 질문 / 액션 / 유형:** 증거보존/통제 정책 책임자·검토자 / “증적 수명주기·반출·무결성이 어떤 정책으로 통제되고 변경은 승인되었는가?” / 정책 버전작성/검토/게시/rollback·checkpoint / governance policy studio.

**구조:** 현재 활성 정책/수명주기 미리보기, 초안 버전 편집·diff/impact, 버전 작업 흐름/history, 무결성 검증 기록. store/retention/export/integrity를 정보의 수명주기 순서로 연결하고 서로 무관한 설정 카드로 분해하지 마세요.

**필드:** standardDays/extendedDays/riskThreshold/exportLimit/requireReason/integrityEnabled, 버전 변경 사유/관련 사건 등현행필드. capture→immutable→standard→extended→disposition단계의 보존 대상/기간/정책효과. 법정근거/보존 의무는 실제 도메인 필드/정책이 있을 때 연결하며 국가별 법률값을 디자인 가정으로 고정하지 않음. checkpoint는실행시각/범위/검증 결과/불일치 source·추적.

**flow:** 활성 버전 확인→create revision→필드입력/validation→diff·삭제/반출영향→submit→authorized approve/reject→publish→활성 정책 확인→audit. 이 메뉴는 현행 submit/decide/publish가 존재하므로 승인 단계와 게시 단계를 분리해 그립니다. rollback은 source revision/이유/incident와복원영향 preview후신규정책 revision으로 지원 계약대로 처리합니다. checkpoint실행은 정책 게시와 다른 action.

**프레임:** active/draft/review/approved/published/rejected, 기간오류/retention감축영향, 승인 분리·권한 제한, publish/복원 확인/진행/409, 무결성 검증 성공/invalid/unknown, 부분 policy/history/무결성 조회 실패, 모바일 작업 흐름.

## 7. 감사 로그 legacy · `P10-G06-L` · `/admin/governance/audit` · 현행 직접 route

현재 정식 탐색에는 없지만 직접 route는 AuditLog를 렌더합니다. 질문: “옛 관리 변경 증거 링크를 잃지 않고 최근 증적 탐색으로 이어갈 수 있는가?” 유형: 이전 링크 호환 증적 목록. identity/platform audit의 actor/action/target/outcome/correlation/occurredAt를 안전하게 유지하고 원천별 부분 failure를 표시. `새 증적 탐색기에서 보기`는가능한 source/필터 맥락를전달하는 deep link. 기존 route를 404로 없애거나 본래 증거가 새 계약으로 모두 이관됐다고 주장하지 마세요. 신규작업 flow는 P10-G04로 안내합니다. source한쪽오류/권한 없음/oldlink 선택/모바일 표시 프레임을 요청합니다.

## 8. 신규 제안: 홈 데이터 원천 운영 · `P10-N02` · 후보 `/admin/integrations/home-data-sources`

**사용자 / 질문 / 액션 / 유형:** 홈/원천 앱 운영자 / “위젯이 비거나 틀린 이유가 원천·권한·동기화·계약 중 어디인가?” / 원천 문제 조사·담당 앱 복구 작업 연결 / 원천 검증 작업공간.

기존 생산성 커넥터/위젯 catalog/P08 policy 안의 source 상태로 충분한지 먼저 검토. 여러 앱 source를 독립 운영할 책임이 있으면 신규 메뉴를 만들 수 있습니다. row는 원천 앱/provider/원천 계약 버전/사용 중인 위젯/owner·지원 범위/마지막 성공·asOf/freshnessSLA/coverage/권한 정합성/오류 상태/안전한 오류/trace. fresh/empty/stale/partial/blocked/unsupported는 모두 다름. 겹치는 Work/결재/알림은 기준 원천 권위/dedupekey와실제 count 차이를 조사할 수 있게 합니다.

flow: 실패 widget→원천 범위→trace/contract/권한 근거→원천 앱 owner 작업→원천 결과→홈 재조회 검증. 이 페이지에서 원천 결재 승인·HR수정·연계 자격증명 조회·서비스 재기동을 같은 버튼으로 제공하지 않습니다. AI source는 근거 조회 시각/원천 버전·사용 범위/citation·허용 도구·개인정보 필터, 읽기/실행 capability를 포함. 중앙 집계 endpoint/trace 상관분석/필드 마스킹은 신규 계약입니다. 부분 실패·권한 없음·범위 확인 불가·인증 필요·지원되지 않는 app·두 source 중복/충돌·복구 영수증 프레임.

## 9. 신규 제안: 홈 품질 및 접근성 · `P10-N03` · 후보 `/admin/governance/home-quality`

질문: “세 홈 모드의 실제 품질은 어디서 막히고 복구되는가?” 유형: 품질 검증 센터. 범위 mode/빌드 스냅샷/테넌트 정책 버전/locale/viewport/theme/기간, 검증 run·실패 영향·A11y/keyboard·overflow/빈 높이·원천 신선도·부분 실패/recovery·배치 복원/width 차이·icon 정렬/업데이트 중복. 지표는 책임 있는 검증 근거를 갖고 실제 executed 결과가 없으면`미검증`을 표시합니다.

개인 행동·민감 업무·MZ세대/직원 효율 점수를 수집하지 않습니다. usage가 필요하면 동의된 익명 집계·최소 수집·보존·접근 제어를 추가 계약으로 분리합니다. 발견 issue→원천/소유자→source snapshot·실행 증거→복구 검증으로 연결. 기존 게시 검증의 운영 뷰로 충분하면 별도 메뉴 대신 그 안에 둡니다. 접근 가능한 차트/table, 실패한 검증 run/수집 실패/제한 scope/비교 불가 version·다크/모바일 validation 프레임.

## 10. 신규 제안: 경험 변경 통제 · `P10-N04` · 후보 `/admin/governance/experience-change-control`

질문: “홈·브랜딩·앱 배치·탐색·번역·위젯 계약 변경을 묶어서 검토하더라도 실제 게시·복원 단위는 명확한가?” 유형: 여러 영역의 릴리스 명세 workflow. manifest는 각 domain/게시 버전/제안 변경 비교/dependencies/영향받는 사용자·source/checks/owner·reviewer/조치 권위. 각 domain의 현재 publish 권위와승인 chain 존재 여부를 정직하게 표시합니다.

flow: domain 변경 selection→snapshot/diff→기기·권한·모드 검증→영향 검토→실제 승인 가능한 domain의 approval→게시 order/범위 confirmation→progress(각 영역)→부분 성공/실패·receipt→안전한 recovery/복원 범위→effective홈검증→audit. **현재 독립 API들을 하나의 원자적 transaction으로 가정하지 마세요.** 신규 서버 릴리스 조정/idempotency/reconciliation/approval 계약이 필요합니다. rollback이 전환 mode를 복원해도 개인 뷰·원천 데이터를 삭제해서는 안 됩니다. 조합 관리 질문이 기존 홈 정책/history로 충분하면 새 메뉴를 늘리지 않습니다.

AI·Adaptive 릴리스에서는 중앙 홈 표시/배치 정책, DWAI model/tool·safety 및 앱 도메인의 실행/승인을 분리합니다. release에는 허용 source/tools/capabilities/version, 실행 영수증/trace 확인, 민감한 필드 마스킹·동의, 사용자 확인, 안전한 재시도 command/중단 가능성·결과 불확실 복구를 포함하세요. 실행 확정 전 UI의 마법 같은 즉시 완료를 약속하지 않습니다.

## 제출물

각 ID의 주 사용자/question/action/archetype과 실제 대표 여정이 prototype으로 연결되어야 합니다. 기존 7route와 제안 3workspace는 구분됩니다. P00의 1440/1280/390/320·200% zoom·ko/en·light/dark/고대비·움직임 줄이기·keyboard/focus/touch·loading/empty/error/부분 실패가 필수입니다. chart/table 동등 정보·scope/time/freshness·selection URL·permissions·승인/preview/progress/recovery/감사 annotation을 포함하세요. 실데이터가 없는 영역은 가상/제안/미검증 상태를 명확히 보여줍니다.
