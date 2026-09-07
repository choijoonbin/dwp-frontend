# 화상회의 01–15 디자인·기능 계약 및 개발 아키텍처

> 기준일: 2026-09-05
> 상태: 전체 화면의 개발 설계 + V26–V36 코드 구현·검증 체크포인트. 존재하는 코드, 외부 연결 대기, 신규 개발을 구분한다.
> 입력: `output/meeting-design-ai-2026-09-04/prompts/00-common-design-contract.md` 및 01–15 전체 프롬프트, 현재 Meeting/Agent/Work API·마이그레이션·권한 코드.
> 디자인: 사용자가 전달한 Stitch 01–15 데스크톱·모바일 30개 프레임. 루트의 프레임별 실측/상호작용 감사 결과와 병합한다.
> 이 문서의 최초 조사와 제안은 3–9절, 이후 실제 코드 구현 및 검증 범위는 10–12절이다. DB migration 파일 및 테스트 DB 적용은 실제 운영 DB 배포·프런트 연결·디자인 일치·운영 준비 완료와 별개다.

## 1. 적용 결정과 완료의 의미

대표 사용자는 회의를 준비·진행하고 결과를 실행하는 구성원이다. 대표 질문은 “지금 참여할 회의, 내가 준비할 내용, 끝난 회의에서 이어서 처리할 일은 무엇인가?”다. 홈은 command center, 회의/라이브러리/업무는 list-detail, 예약·검토는 workflow, 개인 설정은 focus form이다.

승인 디자인의 영역을 현재 API에 맞추어 임의 삭제하는 방식은 사용하지 않는다. 필요한 메뉴와 계약은 신규 개발 대상으로 명시하고 해당 화면까지 연결한다. 반대로 픽셀 모양을 맞추기 위해 가짜 참가자, 자료 수, 기한, 장치 정상, E2EE 보장, AI 완료 상태를 만드는 방식도 사용하지 않는다. 디자인용 예시 데이터는 격리된 테스트 fixture에서만 사용한다.

완료는 네 가지 독립 판정이다.

1. **제품 연결:** 화면의 주 행동과 보조 행동이 실제 목적지·저장·권한·오류 복구로 이어진다.
2. **디자인 일치:** 승인 프레임과 동일 조건에서 배치·비율·간격·타이포·컴포넌트·모바일 순서를 직접 비교한다.
3. **기술 안전:** tenant/object 권한, 중복 명령, 버전 충돌, 민감 정보, 장애/재시도를 검증한다.
4. **운영 준비:** 외부 미디어·암호화·전사·모델·삭제 계통을 실제 배포 환경에서 검증한다.

기능 테스트 수나 자체 snapshot 갱신만으로 2번을 대신하지 않는다. 프레임 이름에 `1440px`가 있어도 실제 노드 폭이 1280px이면 1280 기준 원본 비교와 별도의 1440 반응형 검증을 구분한다. 공통 셸의 실제 248/72px 내비게이션·64px 헤더·16/24/32px 거터를 임의 축소해 시안을 흉내 내지 않는다.

## 2. 메뉴와 책임 경계

| 영역   | 메뉴/화면                  | 경로 계약                                  | 책임                                            |
| ------ | -------------------------- | ------------------------------------------ | ----------------------------------------------- |
| 사용자 | 회의 홈 U01                | 기존 `/meetings/home`                      | 다음 행동을 모으는 권한 확인된 projection       |
| 사용자 | 내 회의 U02                | 기존 `/meetings/mine`                      | 날짜·상태·역할·초대 응답별 탐색                 |
| 사용자 | 회의 라이브러리 U07        | 기존 `/meetings/history` 유지, 표시명 변경 | 한 회의 한 결과 객체, 검색·검토함·공유·즐겨찾기 |
| 사용자 | 내 후속 업무 U09           | 신규 `/meetings/follow-ups` 제안           | 회의 출처의 후보 및 목적지 업무 projection      |
| 사용자 | 회의 템플릿 U10            | 신규 `/meetings/templates` 제안            | 개인 템플릿 관리와 조직 승인본 사용             |
| 사용자 | 내 회의 설정 U12           | 신규 `/meetings/preferences` 제안          | 계정 선호와 기기별 장치 설정 분리               |
| 문맥   | 예약/변경 U03, 준비 U04    | 내 회의의 생성/상세 하위 경로 제안         | 목록 필터·선택·회차를 보존하며 진입             |
| 문맥   | 장치/대기 U05, 실제 룸 U06 | 기존 `/meetings/room/:meetingId` 여정 보존 | 사전 미디어 비게시, 승인·고지 후 입장           |
| 문맥   | 결과/검토 U08              | 기존 회의 기록 상세를 확장                 | 게시본과 권한자 초안, 근거/재생 연결            |
| 문맥   | 개인실 U11                 | 내 회의 하위 신규 경로 제안                | 영구 미디어 방이 아닌 사용자별 재사용 진입점    |
| 관리   | 운영 A01/13                | 기존 `/meetings/admin/operations`          | 영향·진단·운영 조치, 콘텐츠 비열람              |
| 관리   | 정책 A02/14                | 기존 `/meetings/admin/policies`            | 정책 버전·영향·허용 기능·보존                   |
| 관리   | AI·데이터 A03/15           | 기존 `/meetings/admin/intelligence`        | 준비 증거·의존성·보존/삭제 건전성               |

즉시 시작·예약·코드 참여는 별도 대형 메뉴 타일이 아닌 행동이다. 코드 참여는 기존 사이드바 진입점을 보존한다. 따라서 사용자 주 목적지 6개 + 코드 참여 진입 메뉴 1개로 총 7개다. 모바일 5개 탐색의 정확한 항목은 승인 프레임과 이 전체 탐색을 대조하여 확정한다. 하단 탐색에서 빠진 메뉴는 명시적 전체 메뉴로 접근할 수 있어야 한다. 존재하지 않는 경로를 아이콘에 연결하지 않는다.

Meeting은 회의와 참가 권한·의제·초대·후속 후보/출처를 소유한다. Work는 확정 업무의 담당/수락/진행/기한을 소유한다. Calendar는 달력 이벤트와 가용성, Messaging은 지속 대화, 원자료 서비스는 자료 내용과 ACL, Agent는 승인된 분석 실행을 소유한다. 서비스 간 DB 조인이나 데이터 복사로 소유권을 우회하지 않는다.

## 3. 현재 구현의 증거 범위

다음은 V25 기준 최초 조사에서 읽은 코드에 존재했던 계약이다. V26–V36 신규 계약과 현재 판정은 10–12절에서 별도로 갱신한다. 존재 자체가 이번 변경의 검증 통과를 뜻하지 않는다.

- Meeting public base는 `/api/meetings/v1`; owner controller base는 `/v1`이다.
- `GET /home`, `/meetings`, `/meetings/{meetingId}`, `/history`, `/people`, `/capabilities`가 있다. 목록 API는 현재 page/pageSize 중심이며 디자인의 날짜/역할/검색/반복/초대 응답 필터 전체를 제공하지 않는다.
- `POST /meetings`, `/meetings/instant`는 단건 생성과 idempotency를 제공한다. 예약 수정/취소, 시리즈/회차, RSVP, 템플릿은 별도 신규 계약이 필요하다.
- join-code, join-request, lobby admit/deny, start/token/connected/leave/end 경계가 있다. 초대 응답과 입장 승인은 서로 다른 업무다.
- 회의 채팅의 sequence/delta 조회·전송·삭제와 손들기/발언 큐 명령이 있다. 이 계약은 회의 전후의 지속 Messaging 채널 연결을 자동으로 의미하지 않는다.
- `GET/PUT /meetings/{id}/content-plan`, notice acknowledge, recording request/stop이 있다. plan/dependency/consent 상태와 실제 장치 상태는 별개다.
- intelligence runs, latest/latest-published/report, review/publish, reviewer assignment/ACL이 있다. Agent는 `STANDARD_RECAP_V1` 전사 분석만 받는다.
- 녹화 access-ticket은 현재 권한·artifact version·보존을 재검증한 짧은 HTTPS 재생 권한이다. 전사 본문을 브라우저에 제공하는 검색/구간 API를 대신하지 않는다.
- 관리 overview/policy/intelligence readiness가 있다. 상세 장애 목록·장기간 시계열·사건별 재처리 명령·증거 반출 전체가 이미 존재하는 것은 아니다.
- 홈의 `normalizeSummary()`는 `participants`, `artifacts`, `followUpActions`를 빈 배열로 만든다. `getVideoMeetingHome()`의 최근 결과 녹화/전사 플래그도 실제 상세 custody 판정이 아니다. 참가자/자료/결과는 적절한 detail/projection으로 보강해야 한다.
- 현재 참가 상태는 `INVITED/REQUESTED/ADMITTED/DENIED/JOINED/LEFT`다. RSVP 수락/거절이나 준비 완료로 해석할 수 없다.

관련 정본 파일: `video-meeting-api.ts`, `video-meeting-lifecycle-contract.ts`, `video-meeting-content-api.ts`, `video-meeting-intelligence-api.ts`, `video-meeting-artifact-api.ts`, `video-meeting-admin-intelligence-api.ts`, `video-meeting-collaboration-api.ts` 및 대응 `dwp-meeting-server` controller/service/repository.

## 4. 01–15 화면별 계약 매트릭스

`기존`은 재사용 가능한 코드, `신규`는 이번 목표를 위한 개발, `조건부`는 외부/공급자 준비 검증 후 활성화할 범위다. 신규를 영구 미제공으로 분류하지 않는다.

| 번호               | 기존 재사용                                                 | 필수 신규 개발                                                                                                         | 조건부·수명주기 검증                                                                |
| ------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| U01 홈             | 시간대/현재·다음·오늘, 즉시/예약/코드, 게시본·검토 대상     | 의제/RSVP/자료/업무/즐겨찾는 템플릿/개인실의 bounded home projection, 영역별 freshness/error                           | 장치 정상은 실제 점검 결과일 때만; 업무·자료 실패가 일반 입장을 막지 않음           |
| U02 내 회의        | 회의 목록/상세, 역할·상태, 결과 연결                        | 서버 필터/검색/저장 보기, RSVP함, series/occurrence 구분, 준비 inspector                                               | 초대 통지·Calendar sync 상태; 과거 회차 불변                                        |
| U03 예약·변경      | 단건 생성, 참가자 검색, 기본 접근/대기실                    | 구조화 의제, 필수/선택 참석자, 변경·취소·영향 preview, 반복/DST, template revision 적용, notification outbox           | 가용성은 Calendar ACL 기반; 게스트와 AI 의제는 검증된 capability 없으면 비활성 이유 |
| U04 준비           | 상세·코드·기록 고지·기본 입장                               | 의제 확정/제안, 자료 참조·준비 체크·RSVP, 이전 회차/이월 연결, Messaging handoff                                       | 원자료 ACL/삭제·AI 준비 브리핑 출처·취소/일정 변경 반영                             |
| U05 장치·대기      | LiveKit PreJoin, lobby/고지/입장 통제                       | 독립 장치 테스트/출력 지원 판정, 계정·기기 선호 적용, 준비도 결과 모델                                                 | 권한 거절·장치 교체·호스트 대기·notice revision 변경·입장 승인 철회                 |
| U06 실제 룸        | 미디어/공유·채팅·손들기·반응·참가자·녹화 제어               | 의제 진행, Q&A/투표 상태·중복 응답 제약, 승인 도구 연결, 소회의실 관리                                                 | provider 권한 집행·이동/복귀·자막/STT·E2EE; 종료 후 late success fence 유지         |
| U07 라이브러리     | history/detail, artifact custody, published/reviewer report | metadata 검색·필터·검토함·공유받음·favorite, 결과 요약 projection                                                      | 전사/의미 검색은 새 source-scoped 계약; 만료/철회는 제목/개수/미리보기까지 비노출   |
| U08 결과·AI 검토   | 인용 분석, 독립 검토·게시·ACL, 짧은 재생 ticket             | 내장 재생+시간 연결, 권한 확인 전사 구간, 후보 확정, 새 버전 편집/재검토, 범위 제한 Q&A                                | STT/LLM/KMS/retention readiness, 근거 철회·보고서 충돌·ticket 만료                  |
| U09 후속 업무      | AI `text+citations` 후보, 별도 PersonalWork 기본 API        | 후보 영속 ID·담당/기한 확인·promotion receipt, Work Meeting-source adapter와 배정/수락 계약, 내가 요청/담당 projection | 생성 timeout/crash 중복 방지, 원근거 철회와 업무 존재 분리, 목적지 권한 재확인      |
| U10 템플릿         | 기존 예약 입력 재사용                                       | 개인/조직 템플릿·의제·version·favorite·복제·게시·정책 적합 preview                                                     | 적용 시 현재 정책 재검증, 이전 동의/토큰/실제 참가 권한 복사 금지                   |
| U11 개인실         | 일반 회의 생성·입장 수명주기                                | 사용자별 room profile·안정 alias·invite generation·session mapping·회전/비활성                                         | 진행 session 중복 생성 차단, 링크는 권한 아님, 이전 세션 미디어/기록/ACL 승계 금지  |
| U12 내 설정        | prejoin 장치 선택과 안전한 기본값                           | 계정 preference version·알림 설정·기기 local 설정·restore/충돌 UX                                                      | device ID 계정 동기화 금지, 배경/출력/자막 지원 확인, 회의 동의 대체 금지           |
| A01/13 운영        | overview와 공급자 capability                                | 영향/예외 목록·필터·기간 baseline·익명 진단 inspector·사건 시간축                                                      | 재처리/종료/차단은 실제 권한·영향 preview·durable command/audit 제공 후             |
| A02/14 정책        | optimistic version 정책 저장                                | 신규 도구/템플릿/개인실 policy, before/after 영향, 적용 상태·이력                                                      | 저장 허용과 provider 준비 구분, 기존 session에 적용되는 경계 명시                   |
| A03/15 AI·거버넌스 | readiness/dependency/retention signal                       | worker 최근 성공/시도·backlog·삭제 증거의 안전한 projection, 담당/조치 안내                                            | 실제 삭제/KMS 증거 없는 green 금지, admin은 콘텐츠 custody 권한 아님                |

## 5. 공통 데이터·보안 계약

### 5.1 식별자와 격리

- 기존 `vm_meetings`의 `(tenant_id, meeting_id)` unique를 부모 경계로 사용한다. 새 공개 객체는 추측 가능한 순번 대신 UUID를 사용한다.
- 모든 자식 FK는 `meeting_id` 단독이 아니라 `(tenant_id, meeting_id)` 또는 `(tenant_id, meeting_id, parent_id)`다. 전역 UUID가 우연히 유일해도 tenant 제약을 생략하지 않는다.
- 사람은 인증된 `tenant_id/user_id`와 `vm_people_snapshot`의 활성 상태로 검증한다. 클라이언트가 보내는 owner/tenant/role 값을 권위로 사용하지 않는다. API에서 보이는 불투명 공개 인물 ID와 내부 user ID를 명확히 변환한다.
- 공통 변경 필드: `version BIGINT >= 0`, `created_at/by`, `updated_at/by`; 객체 scope unique와 최근 조회용 tenant-first index. 삭제는 업무별 archive/tombstone과 보존 처리 후 수행한다.
- 기존 관리 surface는 `ADMIN.MEETINGS:VIEW/MANAGE`, 사용자 surface는 `APP.MEETINGS` 권한과 객체별 역할을 함께 확인한다. 새 POST를 현행 filter의 일반 UPDATE fallback에 무조건 붙이지 않는다. 개인 설정·초대 응답·업무 수락 등 SELF 명령의 구체 권한을 별도 검토한다.
- 현재 exact PEP 대표 경로만 새 화면 전체 권한 근거로 간주하지 않는다. 신규 PAGE/DATA/ACTION registry 후보는 중앙 소유자에게 전달하고 owner service 권한 검사를 먼저 구현한다.

### 5.2 동시성·명령·외부 호출

- 변경 request는 `expectedVersion`, 안정된 `Idempotency-Key`, canonical body digest를 가진다. 같은 key+동일 body는 같은 결과, 같은 key+다른 body는 충돌이다.
- 신규 업무 명령 receipt는 `(tenant_id, actor_user_id, operation, idempotency_key)` unique로 묶고 resource scope/hash/result reference를 보존한다. 원문 payload를 receipt/audit에 저장하지 않는다.
- 외부 Calendar/Messaging/Work/모델/자료 호출은 DB row lock 밖에서 실행한다. durable receipt/outbox commit → external call → matching fence/unexpired lease/version으로 terminal+audit commit 순서를 재사용한다.
- 주 업무 변경과 canonical audit/outbox는 같은 transaction이다. audit insert 실패 시 업무 변경도 rollback한다. crash/retry/reclaim/stale worker 테스트가 필수다.
- timeline의 순서는 `updated_at`만 추정하지 않고 명령/이벤트 sequence 또는 version으로 정한다. 브라우저에서는 tenant/user/scope 및 generation fence가 바뀐 뒤 late response를 폐기한다.

### 5.3 민감 정보와 보존

- 회의 제목·의제·자료 제목·후속 업무·RSVP 메시지는 사용자 콘텐츠다. audit/log/trace/error에 본문·이메일·device ID·토큰·원자료 URL·스토리지 key를 기록하지 않는다.
- AI에서 파생한 후보/새 버전 분석은 기존 envelope encryption과 tenant/object binding을 재사용한다. 미리보기용 plaintext shadow나 범용 검색 index를 별도로 만들지 않는다.
- 신규 Meeting 소유 콘텐츠에 `retention_until`, 삭제 상태, 법적 보존 관계를 정의한다. 단순 FK cascade만으로 감사·외부 삭제 완료를 선언하지 않는다.
- 원자료 참조를 삭제해도 원소유 서비스 자료를 삭제하지 않는다. 회의 근거가 만료되어도 Work 소유 확정 업무가 자동 삭제된다고 약속하지 않는다.
- material/search/AI read는 현재 원자료 ACL·버전·보존을 다시 확인한다. 불가/실패일 때 이전 title/link/snippet을 권한 있는 데이터처럼 계속 노출하지 않는다.

## 6. 신규 저장 모델 상세안

다음 이름/필드는 전체 목표를 위한 DDL 설계안이다. 같은 이름의 테이블이 V26–V29에서 구현됐더라도 이 절의 모든 미래 필드가 존재하는 것은 아니다. 실제 테이블·현재 API는 10–11절을 따른다. Migration 번호별 작성자를 고정하여 충돌을 방지한다.

### 6.1 의제·초대·준비·자료

| 테이블 제안                       | 핵심 필드와 제약                                                                                                                                                              | 의미                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `vm_meeting_agenda_items`         | tenant/meeting/item UUID, position, title, objective, owner_user_id nullable, planned_minutes nullable, state, version; unique tenant/meeting/item 및 tenant/meeting/position | `PLANNED/ACTIVE/COMPLETED/SKIPPED`; 담당·기간 미정과 0을 구분. 실제 시작/종료는 명시적 진행 명령으로 기록 |
| `vm_meeting_agenda_proposals`     | tenant/meeting/proposal, item nullable, proposer, encrypted/protected proposal text, state, base_agenda_version                                                               | 참가자 제안과 호스트 확정을 분리; stale proposal 자동 덮어쓰기 금지                                       |
| `vm_meeting_invitation_responses` | tenant/meeting/participant, invitation_revision, response, responded_at, response_message nullable, version; participant composite FK                                         | `NEEDS_RESPONSE/ACCEPTED/TENTATIVE/DECLINED/RECONFIRM_REQUIRED`; 입장 attendance 변경과 독립              |
| `vm_meeting_preparation_checks`   | tenant/meeting/participant/item, checked_at, source_version, version                                                                                                          | 본인의 사전 읽기/준비 체크. 의제 실제 완료 또는 타인 동의로 표시하지 않음                                 |
| `vm_meeting_material_refs`        | tenant/meeting/material UUID, agenda_item nullable, owner_service, source_reference opaque, source_version nullable, classification, retention_until, version                 | 원자료 내용/ACL/지속 URL 복사 금지. `AVAILABLE/FORBIDDEN/DELETED/UNAVAILABLE`는 조회 시 원소유자 판정     |

단일 문자열 `agenda`는 기존 클라이언트와 호환되게 남긴다. 새 구조화 의제가 생긴 뒤에도 기존 문자열에서 담당자·15분씩 시간·완료율을 추론하지 않는다. 의제 순서 교체는 aggregate version과 하나의 transaction으로 실행하여 중간 순서 중복이 보이지 않게 한다.

자료 업로드를 승인 프레임이 요구하는 경우 별도의 승인된 content storage 접수/검사/다운로드 티켓 adapter가 필요하다. 임의 URL 입력을 파일 업로드로 위장하거나 서버가 임의 URL을 fetch하게 하지 않는다. browser/API SSRF·MIME·size·malware·retention 계약을 함께 검증한다.

### 6.2 예약 변경·반복·통지

- `vm_meeting_series`: tenant/series UUID, organizer, IANA zone, validated recurrence rule, duration, bounded end/count, revision/state, template reference/revision. 무한 materialization 금지.
- `vm_meeting_series_occurrences`: tenant/series/meeting, occurrence local key/UTC instant, exception kind, series revision; 회차 identity unique. `THIS_ONLY/THIS_AND_FUTURE` 명령이 과거 종료 회차를 수정하지 않게 한다.
- `vm_meeting_change_receipts`: 기존 meeting/series version, command scope, impacted occurrence count, invitation revision, request hash, result reference. 변경 preview token은 버전과 정규화 diff에 묶고 권한을 대체하지 않는다.
- `vm_meeting_delivery_outbox`: tenant/event/recipient reference, destination, event kind, bounded retry/fence, delivery state, safe failure code. 초대 저장 성공과 Calendar/알림 전송 성공을 구분한다.
- DST 중복/존재하지 않는 지역시각, 월말 반복, 시리즈 시간대 변경을 사전에 검증하고 사용자에게 적용 결과를 보여준다. browser locale로 반복 instant를 계산하지 않는다.

### 6.3 템플릿

- `vm_meeting_templates`: tenant/template UUID, owner_user_id nullable, scope `PERSONAL/ORGANIZATION`, lifecycle `DRAFT/PUBLISHED/ARCHIVED`, purpose, display name, current_revision, version, retention/deleted marker. 개인 템플릿은 owner 필수, 조직본은 별도 게시 권한을 요구한다.
- `vm_meeting_template_revisions`: tenant/template/revision unique, immutable bounded payload(목표·의제·기본 기간·기록 요청·진행 도구), created_by/at, policy_revision_at_validation. 승인본을 in-place overwrite하지 않는다.
- `vm_meeting_template_favorites`: tenant/user/template unique, created_at. 홈 “자주 쓰는”이 favorite인지 실제 사용 횟수인지 디자인 label과 계약을 일치시킨다.
- 적용은 template revision + current tenant policy → 예약 초안이다. 실제 예약은 사용자의 검토 후 기존 생성 idempotency 경계를 통과한다. 초대 토큰·동의·호스트 권한·참가자 승인·device ID를 복사하지 않는다.
- 조직본 조회/개인 복제는 일반 사용자에게 허용 가능하나 조직 게시/삭제는 관리 action이다. 정책에 의해 무효화된 일부 옵션은 이유와 effective value로 반환한다.

### 6.4 개인 회의실

- `vm_personal_meeting_rooms`: tenant/room UUID, owner_user_id, opaque_alias, display_name, state `ACTIVE/DISABLED`, invitation_generation, version, created/updated; unique tenant/owner와 tenant/alias.
- `vm_personal_meeting_room_invites`: tenant/room/invite UUID, generation, cryptographic token digest, expires_at/revoked_at, intended scope; token 원문 영속화·로그 금지. alias 그 자체와 access secret을 구분한다.
- `vm_personal_meeting_room_sessions`: tenant/room/meeting, generation at creation, session ordinal, state; 하나의 current session claim을 row lock/CAS로 보장한다. 실제 LIVE는 기존 provider lifecycle이 결정한다.
- 별도 회전 명령은 새 generation을 commit하고 이전 초대를 거부한다. 정책 선택에 따른 기존 참가자의 현재 세션 유지/종료 영향을 preview에서 명시한다. 회전이 저장된 녹화/AI ACL을 바꾸지 않는다.
- stable alias resolver는 현재 세션에 대한 일반 join request 흐름으로 안내할 뿐, 미디어 token을 직접 발급하지 않는다. 주최자 부재/외부 신원 검증은 별도 capability다.

### 6.5 계정 선호와 기기 설정

- `vm_meeting_user_preferences`: tenant/user primary key, version, default microphone/camera(기본 false), prejoin_required, supported notification preferences, optional caption language, created/updated. 정책 잠금과 effective 값을 별도 응답한다.
- 기기 ID, speaker sink, local preview 설정은 인증 scope로 구분된 browser-local 저장이다. 장치 존재/권한을 재확인하며 없는 장치는 `default`로 안전하게 복구한다. 다른 기기로 device ID를 동기화하지 않는다.
- account default “camera on”이 있더라도 페이지 방문만으로 getUserMedia를 시작하지 않는다. 사용자의 명시적 점검/참여 행동이 필요하다.
- 전역 언어/테마/방해금지 설정을 Meeting DB에 중복 소유하지 않는다. 전역 preference가 잠긴 경우 일관된 값을 읽고 해당 설정으로 연결한다.
- 계정 알림 선택 저장과 실제 알림 delivery는 별개다. 존재하지 않는 채널에 대해 “알림 설정 완료”를 “알림 발송 가능”으로 표시하지 않는다.

### 6.6 후속 업무와 Work 정본

최초 조사 당시 `PersonalWorkTask`는 self-owned 기본 업무만 제공했고 Meeting 원천 배정 계약이 없었다. 이후 Work assignment 저장소·명령 receipt·Meeting 원천 조회/검토 경계와 V31의 서명 assertion/JTI replay 방어가 구현됐다. 다만 이것은 현재 사용자에게 CREATE/REASSIGN 권한이 열렸다는 뜻이 아니다.

2026-09-04 사용자 승인에 따라 실제 Work 배정/수락/업무 전환의 정본 계약 개발은 별도 작업 **「업무 앱 역할과 차별성 분석」**(`01a06a12...`)으로 이관됐다. Meeting은 회의 후보, 원문·인용 검토, 후보 확정 및 destination 연결을 소유한다. 두 제품의 source 계약은 `POST /internal/v1/meeting-followups/resolve`와 `X-DWP-Work-Assertion`으로 고정됐으며 public OpenAPI에는 노출하지 않는다. 이는 browser가 직접 호출하거나 Work 공개 endpoint로 대체할 수 있는 계약이 아니다.

- 후속 후보는 게시된 보고서의 tenant/meeting/report/version과 결정적 candidate UUID에 결속된 projection 및 사람 검토 경계로 제공된다. 독립 업무는 Work assignment 저장소가 소유한다. 배열 index나 AI 문장 자체를 영구 업무 identity로 쓰지 않는다.
- 최초 제안했던 `vm_meeting_followup_promotions` 서버 worker는 이번 합의에서 채택하지 않는다. 현재 인증된 U09 사용자가 Work 생성 API를 호출하고, Work의 tenant/actor/command UUID receipt 및 tenant/source unique로 중복과 응답 유실을 복구한다. Meeting은 후보의 원본/확정 상태를 소유하되 독립 Work 상태를 복제하지 않는다.
- Work 소유자가 Meeting 원천 reference 검증, 담당자 지명·수락/반려, 진행 변경, 기한/요청자 권한을 가진 assignment 계약을 추가한다. Meeting이 Work DB를 직접 변경하거나 개인 업무 API로 다른 사람의 수락을 위조하지 않는다.
- 생성자는 후보/담당/기한을 확정하지만 담당자의 수락을 대신하지 않는다. 내 업무·내가 요청 목록은 현재 Work의 actor-specific projection으로 읽는다.
- U09→Work 생성은 같은 UUID Idempotency-Key와 확정 candidate identity/version을 유지한다. timeout 뒤 Work `GET /commands/{commandId}` 및 현재 접근 가능한 `GET /by-source`로 재조정하며, 새 key로 무작정 재생성하지 않는다. Meeting worker가 공용 서비스 토큰과 임의 사용자 헤더로 Work 사용자 권한을 대행하지 않는다.
- source report/회의 권한 철회 시 인용/원회의 제목을 비노출한다. 독립적으로 존재하는 Work task의 상태·보존은 Work 정책을 따른다. 삭제 cascade로 업무를 지우지 않는다.

2026-09-04 Work 소유자와 합의한 내부 원천 프로토콜은 `DWP-R1-WRK-001-unified-work-execution/meeting-assignment/source-protocol-v1.md`다. V31은 전용 assertion과 원자 JTI replay 소비, tenant/actor/source/action/body 결속, public OpenAPI 비노출 경계를 구현했다. Meeting 수신부는 여기에 **현재 Meeting 제품 권한·scope·identity plane**, report/candidate ACL·version·미만료를 함께 검증한다. production `MeetingFollowupCurrentAuthority`는 승인된 Auth 정본 adapter가 없어 CREATE와 REASSIGN을 먼저 `AUTHORITY_UNVERIFIED`로 fail-closed한다. Auth 판정이 준비된 뒤에도 REASSIGN은 People의 현재 tenant membership/assignability 판정이 없으면 `TARGET_ELIGIBILITY_UNVERIFIED`로 차단한다. Work 원천 HTTP 동안 DB transaction/row lock을 유지하지 않는 분리와 응답 유실 복구 경계는 보존한다.

### 6.7 룸 도구와 결과 탐색

- Q&A는 tenant/meeting/question, author, text retention, moderation state, answer reference, version; vote/upvote는 tenant/meeting/question/participant unique다.
- 투표는 poll/option/response 테이블과 `DRAFT/OPEN/CLOSED` lifecycle, 참여자당 유효 응답 unique, 변경 허용 정책, host-result 공개 경계를 갖는다. 익명 표시와 운영상 식별 가능성을 과장하지 않는다.
- 소회의실은 room group/assignment와 provider command receipt를 갖고 기존 참가자·권한 version에 결속한다. 이동/복귀 성공은 provider acknowledgement로 확정한다.
- 공동 노트/화이트보드는 승인 도구 reference와 owner ACL을 활용한다. 다른 저장 엔진을 임시로 복제하지 않는다.
- 전사 구간/검색과 Q&A는 원본 artifact version·segment ID·권한/retention에 결속된 bounded read다. `STANDARD_RECAP_V1` 요청에 임의 다른 기능 필드를 끼워 넣지 않고 새로운 분석 profile/schema와 독립 검증을 도입한다.
- 수정된 분석은 새 보고서 버전과 재검토를 요구한다. 이전 게시본과 새 초안이 공존하고 검토 권한은 version별로 재평가한다.

## 7. 공개 API 확장안과 화면 연결

이 표의 `신규` path는 구현 제안이며 현재 호출 가능한 endpoint 목록이 아니다. public prefix는 `/api/meetings/v1`, owner prefix는 `/v1`; browser가 내부 Agent 경로를 직접 호출하지 않는다.

| 범위       | API 제안                                                                              | 연결                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Home       | 기존 `GET /home` 확장 또는 신규 `GET /home/workspace`                                 | focus·today·queue·recent·tools에 독립 상태/observedAt/coverage 반환; 처음부터 전체 transcript 로드 금지 |
| 목록       | 기존 `GET /meetings`, `/history`에 명시적 validated filter/cursor 확장                | U01→U02 날짜, U07 필터/선택 deep link 보존                                                              |
| 준비       | 신규 `GET /meetings/{id}/preparation`                                                 | detail+의제+RSVP+자료 상태·현재 허용 action; source 실패는 독립 component 상태                          |
| 의제       | 신규 `PUT /meetings/{id}/agenda`, item proposal/transition 명령                       | U03 작성→U04 확인→U06 진행→U08 결과 동일 item identity                                                  |
| 초대       | 신규 `PUT /meetings/{id}/invitation-response`, participant/invitation 관리            | SELF 응답, host 초대 revision 변경; attendance와 구분                                                   |
| 변경       | 신규 `POST /meetings/{id}/changes/preview`, 적용·취소 명령; series counterparts       | U02/U03 영향 확인→receipt→통지 상태; preview는 mutation 권한 아님                                       |
| 자료       | 신규 material references CRUD 및 owner-validated open/preview                         | U04/U01 자료 수는 현재 접근 가능한 객체만; opaque handle을 원자료로 해석                                |
| 템플릿     | 신규 `/templates`, `/{id}/revisions`, `/favorites`, `/{id}/apply-preview`             | U10→U03 draft→실제예약; home 최대 3개는 server bounded projection                                       |
| 개인실     | 신규 `/personal-room`, `/personal-room/invitations/rotate`, `/personal-room/sessions` | U11→일반 meeting detail/prejoin; home copy/start 분리                                                   |
| 선호       | 신규 `GET/PUT /preferences`, `/preferences/reset-preview` 필요성 검토                 | U12 effective values→U05; 동의는 content notice에서 따로                                                |
| 후속       | 신규 `/follow-ups`, `/{id}/confirm`, `/{id}/dismiss`, `/{id}/promotions`              | U08 후보→U09 확정/업무 생성→Work task→U01 queue                                                         |
| 라이브러리 | 신규 favorite/review-inbox/metadata projection, 단계적 transcript segment/search      | U07 한 회의 한 객체→U08 현재 공개 version                                                               |
| 협업       | 신규 meeting-scoped agenda/Q&A/polls/breakouts/tool references                        | U06 각 도구 policy+membership+provider capability로 제한                                                |
| 관리       | 신규 scoped operation incidents/evidence/policy-preview                               | A01–A03는 콘텐츠가 아닌 승인된 진단·버전·결과·증거만                                                    |

응답 공통 상태는 `READY/EMPTY/LOADING` 같은 UI 상태와 `FORBIDDEN/UNAVAILABLE/STALE` 같은 authority/transport 상태를 혼합하지 않고 명시적으로 모델링한다. backend가 loader 상태를 위조하지 않으며 각 영역의 last-success, coverage, retry 가능 여부를 전달한다. 권한 철회는 stale display 허용 사유가 아니다.

## 8. 개발 수직 단위와 선후 관계

```text
공통 권한/명령/보존 + 승인 디자인 컴포넌트 계약
  ├─ 의제·RSVP·자료·예약 변경 ── U03 → U04 → U02 → U01
  ├─ 템플릿 ───────────────── U10 → 예약 draft → U01
  ├─ 개인실·선호 ──────────── U11/U12 → U05 → U01
  ├─ 기존 미디어/고지 ──────── U05 → U06 → 기록 custody
  ├─ 라이브러리/검토/근거 ─── U07 → U08 → U01
  └─ 후속 후보 + Work adapter U08 → U09 → Work 정본 → U01

각 수직 단위 → A02 허용 정책 / A01 안전한 운영 신호 / A03 데이터 증거
```

1. 승인 30프레임의 상호작용·반응형·위험 상태를 trace ID로 고정하고 공통 레이아웃/컴포넌트 계약을 만든다. 제품 홈 하나를 임의로 다시 설계하지 않는다.
2. 의제/RSVP/자료와 예약 수정의 DB·API·권한 단위를 구현한다. 이 단위가 focus/timeline의 정보 밀도와 진실성을 만든다.
3. 템플릿/개인실/개인 선호를 병렬 분담하되 migration writer는 단일화한다. 예약/입장 기존 계약에 연결하여 실제 저장과 재방문을 검증한다.
4. 라이브러리/검토/인용·재생을 기존 custody와 연결하고 홈 recent/review를 완성한다.
5. Work 소유자와 assignment/source adapter 계약을 구현한 뒤 후보→확정→수락→완료를 종단 검증한다. 그 전에 홈의 만기/수락 큐 완료를 주장하지 않는다.
6. 실제 룸의 신규 진행 도구는 하나씩 provider/retention/권한까지 수직 완성한다. 투표/소회의실 활성 버튼만 만드는 방식은 불가하다.
7. 관리 3화면에 새 기능의 허용 정책·진단·증거를 연결한다. 사용자 기능을 관리 메뉴에 섞지 않는다.
8. 모든 화면에 실제 API fixture와 같은 디자인 예시를 주입한 별도 시각 검증을 실시한 후 live-data empty/error/blocked 상태를 재검증한다.

## 9. Migration·테스트·인계 기준

### 9.1 Migration

최초 조사 기준은 `V25__add_governed_transcript_retention.sql`이었다. 이후 V26–V29 템플릿/개인실/설정/준비, V30 예약·자료, V31 후속 출처 권한, V32 전사 확정 후 AI 실행 queue, V33 전사 사용자 조회 window, V34 Q&A·투표·안건 timebox, V35 채팅 원문 물리 파기, V36 사용자 예약 초안·SELF 준비 체크 migration이 실제 작성됐다. 최신 로컬 PostgreSQL은 Flyway V36, HTTP health/readiness/liveness 200/UP이며 Meeting 전체 check는 **517 testcase = 516 PASS / 1 opt-in LiveKit skip / 0 fail·error**다. V35 chat 및 V36 schedule-draft retention은 최근 성공 heartbeat, 실패 없음, `overdue=false`, active lease 없음으로 확인했다. 2026-09-05 `meeting-ui-demo-v1` 화면점검 seed는 회의 **30건**(SCHEDULED 16, ENDED 10, CANCELLED 2, DRAFT 1, LOBBY 1), 참가자 **170건**, 안건 **90건**, 템플릿 **12건**, 개인실 **1건**이다.

V30/V31 적용 전 회의 38건·참가자 192건·템플릿 12건과 당시 사용자 smoke 뒤 42건·196건·12건은 **2026-09-04 역사 체크포인트**다. 현재 seed나 최신 V36 검증 수치로 재사용하지 않는다. 다른 세션이 신규 migration을 작성할 때는 최신 번호를 다시 조회한다.

기존 `vm_meetings`, `vm_meeting_participants`, `vm_meeting_artifacts`, content notices/consent, intelligence runs/reports/reviews/ACL, `sys_audit_outbox`를 재사용한다. 코드 재사용을 이유로 신규 의미를 legacy JSON `follow_up_actions`나 attendance enum에 무단 삽입하지 않는다. 신규 schema는 FK/unique/check/index, clean boot와 기존 데이터 upgrade를 모두 테스트한다.

### 9.2 검증 단위

기존 회귀 기반에는 `VideoMeetingLifecyclePostgresTest`, `VideoMeetingIntelligenceDurabilityPostgresTest`, `VideoMeetingIntelligenceLeasePostgresTest`, `MeetingIntelligenceRetentionPostgresTest`, `MeetingRecordingCommandDurabilityPostgresTest`, `MeetingRecordingDeletionPostgresTest`, `MeetingTranscriptDeletionPostgresTest`, `MeetingProductSurfacePepPostgresTest` 등이 있다. 과거 기록된 PASS 수를 이번 변경 결과로 재사용하지 않는다.

새 수직 단위별 필수 회귀:

- tenant 교차 FK/객체조회, SELF/host/reviewer/admin/Work assignee 경계, opaque scope 및 stale authority, 내부 헤더 위조, 기존 sibling endpoint 호환.
- repeated same-key 및 key/body mismatch, stale expectedVersion, 두 worker 경쟁, commit 후 crash/reclaim, stale fence terminal 차단, audit 실패 rollback.
- RSVP와 admission 불변성, 다른 참가자 응답 불가, invitation revision 재확인, 과거 회차 보존/DST/월말.
- 자료 owner ACL 철회/삭제/일시 실패, title/link/snippet 캐시 정리, 임의 외부 URL/redirect·MIME·size 차단.
- template 복사 시 토큰/동의/role/device 미승계, 정책 변경 effective value, 개인/조직 편집 구분.
- personal room 중복 시작 경쟁, generation 회전 후 이전 invite 거부, 현재 session/기록 분리.
- account/device preference 분리, 방문 시 getUserMedia 0회, 장치 교체·출력 미지원·정책 잠금·저장 충돌.
- follow-up 후보와 업무 상태 구분, 다른 사람 대신 수락 불가, Work timeout 중복 방지, 원회의 권한 회수 후 업무 source redaction.
- report draft/publication/retention/reviewer 독립성, 재생 ticket 만료, 신규 전사/Q&A의 bounded source·citation validation.

명령은 각 repository의 정본 스크립트를 사용한다. Backend는 `./gradlew :dwp-meeting-server:check`와 PostgreSQL/Testcontainers 실제 실행 여부·skip 수를 함께 보고한다. Frontend는 clean non-incremental typecheck, scoped lint/format, i18n, unit/API, source-size/design-system, production build 및 Chromium/mobile E2E를 수행한다. Agent 관련 변경이면 Meeting intelligence security/API target, 전체 suite 및 public OpenAPI internal-path 비노출을 확인한다.

디자인 검증은 원본 실측 폭, 1440, 1280, 390, 320, 200% 확대, light/dark/high contrast/reduced motion, 긴 한국어/영어, keyboard/focus, 44px 주요 터치 목표, 영역별 실패를 포함한다. screenshot 이름·화면 trace ID·동일 fixture/시간대·원본/구현 비교 결과를 남긴다. 신규 snapshot을 승인 기준 없이 update하여 PASS로 만드는 것은 검증이 아니다.

### 9.3 외부 운영 Gate와 인계

내부 PostgreSQL retention/readiness/purge 증거는 V35 chat과 V36 schedule draft까지 구현·검증했다. LiveKit/TURN/TLS·실기기·회선 저하·provider 역할 회수/강제 퇴장·다중 노드/드레인·녹화 Egress·KMS/object store·trusted STT·approved model·원자료 owner·Work assignment authority·Calendar/Messaging delivery·외부 object 삭제/crypto-shred의 실제 증거가 필요한 항목은 코드 구현과 별도 판정한다. 미설정이면 안전하게 차단하되 영구 미제공으로 닫지 않고 배포 책임·필요 설정·검증 절차를 인계한다.

인계에는 정확한 변경 파일, 생성/변경 테이블·API, 동작하는 사용자 여정, 실행 명령/PASS·실패·skip 수, 승인 디자인과 남은 차이, 외부 Gate, 수행 중 명령/편집 여부를 포함한다. 공통 Gateway/OpenAPI/권한 registry 생성물은 지정 소유자와 순서를 맞춰 한 번 정본 동기화한다. 부분 커밋이나 다른 제품 파일 변경은 이 설계 문서 작업에 포함하지 않는다.

## 10. V29 준비 계약 구현 체크포인트(당시 이력)

위 매트릭스는 최초 조사 및 전체 개발 설계다. 이후 루트가 V26–V28을 템플릿/개인실/선호 구현자에게, V29를 준비 계약 구현자에게 배정했다. 다음 V29 항목은 실제 코드로 추가되었으며 프런트 연결·전체 디자인 일치는 별도 검증 대상이다.

- `V29__add_structured_meeting_preparation.sql`: `vm_meeting_preparations`, `vm_meeting_agenda_items`, `vm_meeting_invitation_responses`, `vm_meeting_preparation_commands`, `vm_meeting_template_sources`. 기존 회의/초대의 안전한 초기 projection과 향후 생성 trigger를 포함한다.
- 생성 request에 optional `agendaItems`, `sourceTemplateId`, `sourceTemplateVersion`을 추가했다. 기존 Java 생성자 및 신규 필드 없는 요청의 idempotency digest는 보존한다. 구조화 의제·초대 응답·템플릿 revision trace는 기존 회의 생성/참가자/감사와 같은 transaction에서 저장한다.
- `AgendaItemInput`은 `itemId?`, `title`, `objective?`, `ownerUserId?`, `plannedMinutes?`다. 배열 순서가 실제 순서이며 최대 50개다. 담당자는 현재 활성·초대/참가 관계를 검증한다. 템플릿의 역할 이름을 실제 담당자로 자동 변환하지 않는다.
- `GET /meetings/{id}/preparation`은 기존 상세 API를 깨지 않는 별도 projection이다. agenda/invitation revision, ordered items, 본인 응답, 호스트 전체/참가자 본인 응답 목록, response counts, 허용 action, observedAt을 반환한다. runtime은 repeatable-read이며 public response에 `Cache-Control: no-store`를 설정한다.
- `PUT /meetings/{id}/agenda`는 호스트와 UPDATE/MANAGE, `expectedAgendaVersion`, idempotency를 요구한다. `PUT /meetings/{id}/invitation-response`는 실제 초대받은 본인과 VIEW, 현재 invitation revision/response version을 요구한다. 단순 walk-in membership은 초대 응답 자격이 아니다.
- RSVP는 `ACCEPTED/TENTATIVE/DECLINED` 명령이며 입장 승인·미디어 토큰·고지 동의를 바꾸지 않는다. 예약 시각/기간/시간대가 변경되면 invitation revision과 기존 응답 version이 증가하고 `RECONFIRM_REQUIRED`가 된다. 이 절 작성 당시 별도였던 변경 명령·반복 회차는 현재 V30으로 구현됐으며 11–12절 판정을 따른다.
- 신규 명령 receipt에는 digest·불투명 식별자·버전만 저장한다. 의제 본문이나 RSVP 메시지를 audit에 넣지 않는다. 감사 실패 시 전체 변경이 rollback한다.
- template source는 생성 시 현재 private/org 권한과 삭제 상태를 `FOR SHARE`로 확인하고 immutable template revision의 composite FK로 묶는다. 적용 초안은 편집 가능하므로 “원본과 동일한 내용”이 아니라 “사용한 원본 revision”을 기록한다.
- 동일 생성 명령 경쟁은 tenant/user/key별 transaction advisory lock으로 직렬화한다. PostgreSQL unique 충돌로 transaction이 abort된 뒤 조회하는 방식에 의존하지 않는다.
- 실제 룸 의제 진행 시간/완료 상태는 이 V29 체크포인트에 포함하지 않는다. 이 계약으로 계산할 수 있는 것은 의제 순서·예정 시간·담당·항목 수이며 `0/3 완료`를 임의 생성하지 않는다. V30 자료 metadata·반복 명령은 구현됐지만 trusted source ACL/open adapter와 Work 배정/수락은 계속 별도 외부 Gate다.

검증 파일은 `VideoMeetingPreparationPostgresTest`와 `VideoMeetingPreparationContractTest`다. 첫 targeted run은 PostgreSQL 14개, DTO/Bean Validation/OpenAPI required-field 계약 4개와 기존 service/version 회귀가 통과했다. 이후 V26–V29 공유 snapshot을 단독 실행한 `./gradlew :dwp-meeting-server:check --console=plain --no-daemon`이 통과했다. 작성자가 최종 XML을 다시 합산한 결과는 **60 suites / 400 tests / failures 0 / errors 0 / skipped 0**이며 V29의 14+4개가 포함된다. 앞선 병렬 실행의 XML 보고서 쓰기 실패는 이 단독 재실행으로 대체했다.

같은 안전 지점에서 `python3 scripts/check-source-size.py`(production 1,375개), `python3 scripts/check-test-source-size.py`(Java test 652개), `python3 scripts/check-service-boundaries.py`, backend/frontend `git diff --check`, 이 문서의 정본 Prettier check가 통과했다. 프런트 사용자 여정/E2E/시각 일치와 외부 운영 Gate는 이 backend 결과에 포함하지 않는다. 무커밋 상태로 V29 구현 파일의 추가 편집·실행 명령을 종료했으며, 이후 변경은 새 담당 범위와 재검증을 필요로 한다.

## 11. 실제 V26–V36 테이블 및 화면 연결 계약

아래는 계획명이 아니라 공유 트리에서 확인한 실제 migration/owner controller 계약이다. 모든 public 요청은 `/api/meetings`를 앞에 붙이고 owner service 경로를 사용한다. OpenAPI/Gateway 정본의 최종 생성·동기화는 루트 소유 작업이며 이 문서 작성자가 공통 생성물을 변경하지 않았다.

| Migration | 실제 생성 테이블                                                                                                                                                                                                                                                                                                                  | 실제 owner API                                                                                                                                                                                                                                                                                   | 화면 연결과 남은 단계                                                                                                                                                                                                                                                                         |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V26       | `vm_meeting_templates`, `vm_meeting_template_revisions`, `vm_meeting_template_agenda_items`, `vm_meeting_template_favorites`, `vm_meeting_workspace_commands`                                                                                                                                                                     | `GET/POST /v1/templates`, `GET/PUT/DELETE /v1/templates/{id}`, `POST /v1/templates/{id}/clone`, `PUT /v1/templates/{id}/favorite`, `POST /v1/templates/{id}/apply`; 관리 목록/상세/CRUD는 `/v1/admin/templates`                                                                                  | U10 개인/조직/즐겨찾기 → apply draft → U03 실제 생성 → U04. 조직 변경은 실제 관리 권한을 재검증한다.                                                                                                                                                                                          |
| V27       | `vm_personal_meeting_rooms`, `vm_personal_meeting_room_sessions`                                                                                                                                                                                                                                                                  | `GET/POST/PUT /v1/personal-room`, `POST /v1/personal-room/rotate-invitation`, `GET/POST /v1/personal-room/sessions`, `GET /v1/personal-rooms/{alias}/invitation`                                                                                                                                 | U11 프로필/초대 회전/세션 → 일반 meetingId → U04/U05/U06. 별도 `invites` 테이블 대신 안정 alias와 회전 generation의 실제 계약을 사용한다.                                                                                                                                                     |
| V28       | `vm_meeting_user_preferences`                                                                                                                                                                                                                                                                                                     | `GET/PUT /v1/preferences`                                                                                                                                                                                                                                                                        | U12 계정 선호와 tenant/user/session 범위 로컬 장치 ID를 분리한다. 명시적 점검에서 유효 inventory를 확인한 뒤 stale 장치는 default로 복구하고 실제 U05 prejoin/LiveKit 입력·출력에 적용한다. 장치 ID는 서버에 저장하지 않는다.                                                                 |
| V29       | `vm_meeting_preparations`, `vm_meeting_agenda_items`, `vm_meeting_invitation_responses`, `vm_meeting_preparation_commands`, `vm_meeting_template_sources`                                                                                                                                                                         | `GET /v1/meetings/{meetingId}/preparation`, `PUT /v1/meetings/{meetingId}/agenda`, `PUT /v1/meetings/{meetingId}/invitation-response`; 기존 회의 생성 두 API에 optional agenda/source 필드                                                                                                       | U03 작성 → 같은 transaction에 저장 → U04 준비/본인 RSVP → U02/U01 권한 확인 projection. V29만으로는 U06 실제 진행률이나 개인 준비 체크를 만들 수 없으며, 개인 준비 체크는 V36의 별도 SELF-only 계약으로 구현했다.                                                                             |
| V30       | `vm_meeting_series`, `vm_meeting_occurrences`, `vm_meeting_schedule_commands`, `vm_meeting_invitation_outbox`, `vm_meeting_preparation_materials`, `vm_meeting_material_retention_state`, `vm_meeting_material_retention_evidence`                                                                                                | `POST /v1/meeting-series[ /preview]`, `GET/PUT /v1/meetings/{meetingId}/schedule`, `POST /v1/meetings/{meetingId}/schedule/preview`, `POST /v1/meetings/{meetingId}/cancel[ /preview]`, `POST /v1/meetings/{meetingId}/materials`, `POST /v1/meetings/{meetingId}/materials/{materialId}/remove` | U03 반복·영향 검토·변경/취소와 U04 자료 참조 metadata를 실제 UI에 연결했다. 외부 Notification dispatcher와 trusted source ACL/open adapter는 미연결이므로 각각 `PENDING`, `PENDING_REVALIDATION`으로 fail-closed한다.                                                                         |
| V31       | `vm_meeting_followup_assertion_replay`                                                                                                                                                                                                                                                                                            | `POST /internal/v1/meeting-followups/resolve` + `X-DWP-Work-Assertion`; public OpenAPI 비노출                                                                                                                                                                                                    | 서명 assertion의 tenant/actor/source/action/body·시각·JTI를 검증하고 JTI를 원자 소비한다. 후보 projection/검토 경계는 존재하지만 current Auth authority가 없어 CREATE/REASSIGN은 차단되고, REASSIGN에는 People eligibility도 필요하다.                                                        |
| V32       | `vm_meeting_intelligence_auto_requests`                                                                                                                                                                                                                                                                                           | 전사 artifact 확정 이벤트 → 내부 fenced AI recap dispatch                                                                                                                                                                                                                                        | 원문·storage locator 없이 source hash/content plan/consent/tenant를 결속한다. durable PENDING→RUNNING→terminal, lease reclaim 및 같은-source/idempotency 수렴을 제공한다.                                                                                                                     |
| V33       | `vm_meeting_transcript_access_windows`                                                                                                                                                                                                                                                                                            | `POST /v1/meetings/{meetingId}/artifacts/{artifactId}/transcript/query`                                                                                                                                                                                                                          | 현재 사용자·artifact version·보존·ACL을 매 요청 재검증한 bounded segment/search와 짧은 access window를 제공한다. 403/만료 뒤 이전 segment를 재사용하지 않는다.                                                                                                                                |
| V34       | `vm_meeting_facilitation_states`, questions/upvotes, polls/options/votes, commands, retention evidence                                                                                                                                                                                                                            | `GET /v1/meetings/{meetingId}/facilitation`; question/upvote/answer/dismiss, poll create/open/close/vote, timer start/pause/resume/advance                                                                                                                                                       | U06 Q&A·투표·서버 시계 timebox를 tenant/member/host 정책, sequence/version/idempotency와 content-free receipt로 연결한다. 소회의실과 외부 미디어 종단은 포함하지 않는다.                                                                                                                      |
| V35       | `vm_meeting_chat_retention_health`, `vm_meeting_chat_retention_evidence`                                                                                                                                                                                                                                                          | 신규 public endpoint 없음; 기존 chat write/read와 관리 readiness에 결속                                                                                                                                                                                                                          | 종료 회의의 만료 `message_text`와 자유형 삭제 사유·관련 command hash를 물리 제거한다. CAS lease/fence, stale worker 차단, heartbeat/backlog readiness, content-free evidence·audit·terminal의 동일 transaction을 보장한다.                                                                    |
| V36       | `vm_meeting_schedule_drafts`, `vm_meeting_schedule_draft_participants`, `vm_meeting_schedule_draft_agenda_items`, `vm_meeting_schedule_draft_commands`, `vm_meeting_schedule_draft_retention_health`, `vm_meeting_schedule_draft_retention_evidence`, `vm_meeting_personal_preparations`, `vm_meeting_personal_preparation_items` | `GET/PUT /v1/schedule-draft`, `POST /v1/schedule-draft/recurrence-preview`, `POST /v1/schedule-draft/commit`, `POST /v1/schedule-draft/discard`, `PUT /v1/meetings/{meetingId}/my-preparation`                                                                                                   | U03은 명시적 수동 저장·복원·폐기·검토 후 commit을 제공하고 silent autosave/localStorage를 사용하지 않는다. tenant/user·version·idempotency·만료와 철회된 template의 discard-only 상태를 결속한다. U04 준비 체크는 SELF-only이며 다른 사용자의 상태·집계와 안건 진행 완료율을 노출하지 않는다. |

### 11.1 메뉴 간 전달되는 값

| 출발 → 도착                | 전달 계약                                                                                    | 보존/재검증                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01 → U02                  | 날짜/상태/선택 meetingId의 탐색 상태                                                         | 화면 복귀 시 필터/스크롤 보존. 날짜/상태 필터는 실제 서버 지원 범위와 구분한다.                                                                                     |
| U01/U02 → U04 → U05        | meetingId; 준비 조회에서 현재 meetingVersion, agendaVersion, invitationRevision              | 각 진입 시 현재 객체 권한/수명주기 재조회. 홈 캐시는 입장 권한의 근거가 아니다.                                                                                     |
| U10 → U03                  | apply 응답의 sourceTemplateId/sourceTemplateVersion 및 편집 가능한 ScheduleDraft             | 템플릿 role을 사람으로 자동 치환하지 않는다. 사용자 확정 후 agenda의 ownerUserId를 생성 요청에 넣는다. 최종 생성 시 현재 template 접근 권한과 정책을 다시 확인한다. |
| U03 → U04                  | 기존 생성 응답 meetingId                                                                     | ordered agenda/source trace/초대 참가자는 생성 감사와 같은 transaction. 요청 재시도는 같은 idempotency key를 유지한다.                                              |
| U04 RSVP → U02/U01         | 현재 invitationRevision/본인 response version의 응답 명령                                    | 응답 완료 후 해당 meeting의 preparation projection을 무효화·재조회한다. RSVP 수락을 ADMITTED/JOINED/녹화 동의로 변환하지 않는다.                                    |
| U11 → U05                  | 개인실 session 명령이 반환하는 실제 meetingId                                                | personal room ID/alias를 일반 meetingId처럼 사용하지 않는다. 같은 세션 재사용과 새 세션 생성의 구분은 서버 응답을 따른다.                                           |
| U12 → U05                  | 저장 version과 effective preference                                                          | 페이지 방문만으로 미디어를 게시하지 않는다. 실제 브라우저 권한·장치·정책을 다시 확인한다.                                                                           |
| U07 → U08 → U09            | meetingId + 보고서 ID/version + 안정 candidate ID                                            | 현재 게시/검토 권한과 인용 접근을 확인한다. 후보 projection/검토와 Work 저장 경계는 존재하지만 current Auth authority가 없으므로 CREATE하지 않는다.                 |
| U09 → Work → U01           | Work 담당 작업이 제공할 source reference + durable promotion receipt + opaque destination ID | 후보 확정/업무 생성/배정/수락을 각각 구분한다. 실제 Work 응답 없이 임의 task 상태·담당·기한·성공 배지를 표시하지 않는다.                                            |
| 관리 A02/A03 → 사용자 영역 | 현재 정책/권한/dependency version의 effective projection                                     | 관리자 콘텐츠 열람 권한을 암묵적으로 추가하지 않는다. 설정 저장 성공과 외부 provider 준비 완료는 다른 상태다.                                                       |

프런트 공통 데이터 키는 tenant/user와 meetingId·reportVersion 등 객체 범위를 포함해야 한다. 사용자/조직 변경·403·로그아웃 시 projection을 비우고 이전 요청의 late success를 폐기한다. 여러 화면에서 한 계약을 재사용하되 U01에서 U02/U04/U08 전체 응답을 무제한 fan-out하지 않는다. 홈 전용 bounded projection을 구현할 때 source별 권한 확인과 부분 실패 경계를 함께 설계한다.

## 12. 현재 구현 상태와 다음 수직 개발의 시작 조건

| 항목                       | 현재 상태                                                                                                                                                                                                                                               | 필요한 저장/API 및 완료 조건                                                                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 예약 초안/수동 저장        | V36 구현 완료. GET/명시적 저장/복원/폐기/반복 preview/검토 후 commit을 제공하며 silent autosave와 공용 localStorage는 사용하지 않는다. 만료되거나 template source 권한이 철회된 초안은 본문을 숨긴 discard-only 상태로 전환한다.                        | tenant/user 소유 draft UUID/version/만료, `expectedVersion`·stable idempotency, 생성 직전 template/정책 재검증, retention lease/fence/evidence와 audit 원자성을 PostgreSQL 회귀로 고정했다.   |
| 예약 변경/취소/반복        | V30 구현 완료. `THIS_ONLY`/`THIS_AND_FUTURE`, impact fingerprint, IANA offset/DST gap·overlap·월말 검증, 과거·진행·종료 회차 불변, stable idempotent replay를 제공한다.                                                                                 | 실제 public Gateway에서 주간 4회 생성, 단일 회차 변경·취소와 같은-key replay를 검증했다. Calendar 가용성/동기화 및 외부 초대 전달은 별도 제품 adapter가 연결되기 전 NO-GO다.                  |
| 안건 진행률/준비 완료      | V34 host 진행 명령과 V36 SELF-only 개인 준비 체크를 구현했다. 개인 체크는 `agendaVersion`·본인 version·`preparedAgendaItemIds`에 결속하며 타 사용자·관리자 집계는 제공하지 않는다.                                                                      | 개인 준비 체크와 `ACTIVE/COMPLETED/SKIPPED` 안건 진행 상태·실제 소요 시간은 서로 다른 정본이다. 검증된 진행 상태 없이 두 값을 합쳐 완료율이나 `0/n 완료`를 표시하지 않는다.                   |
| 자료 첨부/자료 수          | V30은 raw content·임의 업로드 대신 opaque reference/sourceVersion/classification/retention metadata와 멱등 등록·삭제를 구현했다. 원자료 ACL adapter가 없으므로 항상 `PENDING_REVALIDATION`이며 host 외에는 개수·metadata도 숨기고 만료 즉시 비노출한다. | trusted 원자료 서비스의 tenant/object/version ACL 재검증과 짧은 open ticket, 철회/삭제 통지, 다운로드 감사 adapter가 실제 연결되기 전에는 열기·미리보기·다운로드를 활성화하지 않는다.         |
| 초대 통지/필수·선택 참석자 | V30은 변경 영향·RSVP 재확인 revision과 payload-free transactional outbox 의도를 구현했다. 실제 smoke 뒤 outbox 7건은 모두 `PENDING`이다.                                                                                                                | Notification/Calendar 소유 dispatcher의 tenant-bound claim/retry/delivery receipt가 필요하다. 그 연결 전에는 UI가 `INVITATION_DELIVERY_NOT_CONNECTED`를 표시하고 전달 성공을 주장하지 않는다. |
| 후속 후보/Work promotion   | 게시 보고서에 결속된 후보 projection/검토, Work assignment 저장소·명령 receipt, V31 signed source/JTI replay 경계가 존재한다.                                                                                                                           | production current Auth authority가 없어 CREATE는 `AUTHORITY_UNVERIFIED`, REASSIGN은 People eligibility까지 없어 fail-closed다. 두 정본 adapter가 준비된 뒤에만 종단 활성화한다.              |
| 15화면/사이드바/모바일     | 30개 승인 프레임의 구조·정보 위계·D/M 반응형 대응을 구현 화면과 직접 대조했고 사용자 7개·관리 3개 메뉴 및 문맥 화면을 라우터에 연결했다.                                                                                                                | 공통 셸·접근성·실데이터 진실성을 위해 승인 원본과 달라진 항목은 07–08에 근거를 남긴다. 외부 provider가 없는 상태를 fixture 성공 화면으로 대체하지 않는다.                                     |
| 외부 운영 준비             | V36 로컬 migration/readiness와 LiveKit control-plane smoke는 확인했다.                                                                                                                                                                                  | 실제 browser media·TURN·recording Egress·KMS·STT·LLM·외부 저장 삭제/crypto-shred는 별도 NO-GO다. 프런트 디자인이나 fixture, control-plane 응답만으로 이를 green 처리하지 않는다.              |

후속 개발은 신규 공통 계약/다른 제품 파일을 임의로 수정하지 않고 루트의 담당자 배정 뒤 각 수직 단위를 구현한다. 기존 코드 정합만 끝났다는 이유로 전체 디자인·15개 화면·외부 운영 완료라고 보고하지 않는다.
