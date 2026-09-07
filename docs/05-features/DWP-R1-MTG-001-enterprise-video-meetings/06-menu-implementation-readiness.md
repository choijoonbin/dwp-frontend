# 화상회의 고도화 착수 기준 — 메뉴·화면·저장·연결

기준: 2026-09-05 / 사용자 제공 Stitch 01–15 데스크톱·모바일 30개 화면.

증거 상태: 디자인·기획 담당이 데스크톱/모바일 30개 승인 프레임을 직접 확인하고 07 원본 등록부에 식별자·치수·차이를 기록했으며, 30프레임의 구조·정보 위계·반응형 대응을 구현 화면과 직접 대조했다. U03/U04/U09/U10/U11/U12는 실제 구현 브라우저 여정까지 검증했다. 공통 셸·접근성·실데이터 진실성 때문에 승인 원본을 의도적으로 보정한 항목은 픽셀 동일이라고 과장하지 않고 07–08에 차이와 근거를 남긴다.

## 1. 현재 상태를 먼저 명확히 한다

착수 시점에는 신규 코드가 홈·사이드바에 연결되지 않았다. 2026-09-04 연결 묶음에서 신규 메뉴와 문맥 화면을 실제 라우터에 연결했다. 다만 코드·브라우저 fixture 검증과 현재 공유 서버의 배포 상태는 다르다.

- 현재 메뉴 코드: 사용자 7개(홈·코드 참여·내 회의·회의 라이브러리·내 후속 업무·회의 템플릿·내 회의 설정), 별도 관리자 3개. `meetings-navigation.ts`·`meetings-product-manifest.ts`·`pages/meetings.tsx`에 실제 화면을 연결했다. 신규 3개는 W3 DRAFT이며 official v4 권한을 활성화한 것이 아니다.
- 신규 템플릿·개인실·설정·구조화 안건·참석 응답과 V30 예약/자료, V31–V35 후속 출처·AI queue·전사 조회·회의 진행·채팅 파기, V36 수동 예약 초안·SELF 준비 체크 경계는 PostgreSQL 회귀를 포함한 최신 Meeting 전체 check **517 testcase = 516 PASS / 1 opt-in LiveKit skip / 0 fail·error**를 통과했다. 최신 로컬 DB는 Flyway V36, HTTP health/readiness/liveness 200/UP이며 chat 및 schedule-draft retention은 최근 성공 heartbeat, 실패·overdue·active lease 없음으로 확인했다.
- V30은 반복 회차·변경·취소 impact preview/receipt/outbox와 준비 자료 metadata·보존 worker를 실제 구현했다. `THIS_ONLY`/`THIS_AND_FUTURE`, DST gap/overlap·월말, 응답 유실 뒤 같은 idempotency key 재시도, 과거·진행·종료 회차 불변을 PostgreSQL 회귀로 검증했다. 초대 outbox는 payload-free `PENDING` 의도까지만 보장하며 외부 Notification dispatcher가 연결되기 전에는 전달 완료로 표시하지 않는다. 자료 원본 공급자 ACL adapter 역시 미연결이므로 host가 등록한 metadata는 `PENDING_REVALIDATION`으로 유지하고 참가자에게 노출하거나 열기·다운로드를 제공하지 않는다.
- :4348 정본 Yarn 서버에서 실제 페이지 라우트와 API fixture를 이용해 예약·준비·템플릿·개인실·설정·후속 업무의 데스크톱/모바일 왕복 흐름을 검증했다. 이는 실제 공급자·공유 백엔드 종단 검증을 대체하지 않는다.
- 실제 사용자 :4200 브라우저에서 사용자 7개 메뉴와 템플릿·설정·개인실의 정상 조회를 확인한 V31 시점 증거는 역사 체크포인트로 보존한다. 같은 절의 59 paths(신규 15 paths/25 operations)와 Gateway 757 paths도 V29 동기화 이력이며 최신 V36 계약 수치로 재사용하지 않는다. 최신 정본은 Meeting **87 paths**, Gateway **797 paths**이며 backend/frontend 생성 계약 sync와 check가 통과했다.
- 2026-09-05 `meeting-ui-demo-v1` 화면점검 seed는 `[화면점검]%` 회의 **30건**(SCHEDULED 16, ENDED 10, CANCELLED 2, DRAFT 1, LOBBY 1), 참가자 **170건**, 안건 **90건**, 템플릿 **12건**, 개인실 **1건**이다. V30 적용 당시 public Gateway smoke의 migration 전 회의 38건/참가자 192건/템플릿 12건과 이후 전체 tenant 42건/196건/12건, payload-free outbox 7건 `PENDING`은 **2026-09-04 역사 증거**이며 현재 화면점검 seed 수가 아니다.
- 로컬 LiveKit control-plane smoke는 별도 확인했지만 이는 브라우저 카메라·마이크 media path, TURN, 녹화 Egress·저장, KMS, STT, LLM 또는 crypto-shred의 운영 증거가 아니다. 해당 항목은 승인된 외부 환경에서 종단 검증하기 전 NO-GO다.
- 과거 홈 자체 snapshot 및 기능 테스트 통과만으로 승인 원본 디자인과 일치했다고 보던 판정은 철회했다. 현재 판정은 07의 승인 원본 provenance와 30개 구현 golden, strict no-update 회귀를 서로 다른 증거 등급으로 유지한 직접 비교에 따른다.
- 이 문서는 **구현 순서와 연결 기준**이다. 미개발 기능을 구현 완료로 선언하는 문서가 아니다.

## 2. 사이드바와 문맥 화면

15개 디자인은 사이드바 메뉴 15개를 뜻하지 않는다. 항상 찾는 목적지, 특정 회의에 속한 화면, 관리자 화면을 분리한다. 사용자 주 목적지 6개 + 코드 참여 진입 메뉴 1개로 총 7개이며, 관리 3개는 별도 권한 영역이다.

| 구분    | 사용자에게 보일 항목 | 디자인  | 경로/진입 계약                        | 현재 연결                                                                                                                                                                          |
| ------- | -------------------- | ------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 시작    | 회의 홈              | 01      | `/meetings/home`                      | 승인 정보 위계·공통 gutter·부분 실패 경계와 실제 리소스 진입을 구현·검증                                                                                                           |
| 시작    | 코드로 참여          | 05 진입 | `/meetings/join`                      | 코드 해석·대기 승인·장치 점검을 분리하고 late-response fence·모바일 접근성을 구현·검증                                                                                             |
| 내 업무 | 내 회의              | 02      | `/meetings/mine`                      | 검색·시간·역할 필터, 선택 inspector, 준비·예약 변경/취소 문맥 연결을 구현·검증                                                                                                     |
| 내 업무 | 회의 라이브러리      | 07      | `/meetings/history` 유지, 표시명 개선 | 결과 목록·권한 확인 preview·검토/게시/재생 진입을 구현·검증; 외부 전사/녹화 공급자는 NO-GO                                                                                         |
| 내 업무 | 내 후속 업무         | 09      | `/meetings/follow-ups`                | 실제 Work 목록·명령 연결, 새 후보 승격/재배정 NO-GO                                                                                                                                |
| 내 업무 | 회의 템플릿          | 10      | `/meetings/templates`                 | 실제 API·라우트·예약 연결, 공유 서버 조회 확인                                                                                                                                     |
| 내 업무 | 내 회의 설정         | 12      | `/meetings/preferences`               | 계정 설정과 tenant/user별 로컬 장치 선호를 분리 저장하고 명시적 05 점검 뒤 실제 prejoin/LiveKit 입력·출력에 적용. 제거된 장치는 기본값으로 복구하며 장치 ID는 서버에 저장하지 않음 |
| 관리자  | 회의 운영            | 13      | `/meetings/admin/operations`          | 영향 지표·readiness·예외 진단 구조를 구현·검증; 고위험 조작은 외부 권한/receipt 전 차단                                                                                            |
| 관리자  | 회의 정책            | 14      | `/meetings/admin/policies`            | 정책 그룹·변경 영향·버전 충돌·실제 provider capability projection을 구현·검증                                                                                                      |
| 관리자  | AI·데이터 거버넌스   | 15      | `/meetings/admin/intelligence`        | 7단계 처리·사람 검토·보존/삭제 readiness/evidence를 구현·검증; 외부 KMS/STT/LLM/recording 증거 전 fail-closed                                                                      |

문맥 화면은 아래처럼 들어간다. 사용자에게 같은 기능을 두 개의 별도 메뉴처럼 보이게 하지 않는다.

| 화면              | 진입                                          | 복귀/다음 행동                              |
| ----------------- | --------------------------------------------- | ------------------------------------------- |
| 03 예약·변경      | 홈/내 회의의 예약 CTA, 템플릿 적용, 회차 변경 | 생성한 회의 준비, 원래 필터의 내 회의       |
| 04 회의 준비      | 홈 focus/오늘 일정, 내 회의 상세, 초대 링크   | 안건/참석 응답 확인 → 장치 점검             |
| 05 장치 점검·대기 | 준비의 참여, 코드 참여, 개인실 시작           | 승인·동의 확인 → 실제 룸, 취소 시 원래 회의 |
| 06 실제 회의실    | 05의 현재 입장 승인                           | 종료 → 처리 상태/결과; 퇴장 → 내 회의       |
| 08 결과·검토      | 홈 최근 결과, 라이브러리 선택                 | 근거/재생 확인 → 검토·게시 → 후속 업무      |
| 11 개인 회의실    | 홈 도구 영역, 내 회의의 개인실 진입           | 초대 복사/회전 또는 일반 05 입장 흐름       |

구현한 문맥 경로는 `/meetings/mine?view=schedule`, `?view=preparation&meetingId=<UUID>`, `?view=personal-room`이다. 템플릿 적용은 templateId/templateVersion만 전달하고 현재 권한·개정을 다시 조회한다. 개인실 초대는 `/meetings/join?room=<opaque-alias>&revision=<N>`에서 명시적인 사용자 행동 후 일반 입장 절차로 이동한다. `/meetings/history?meeting=<UUID>&reportId=<UUID>`는 지정 게시본만 읽고 최신 보고서로 대체하지 않는다. 기존 `/meetings/room/:meetingId` 여정은 보존했다. 미래 설계 URL을 현재 구현된 경로처럼 안내하지 않는다.

### 모바일 탐색의 기준

01 승인본의 하단 5개는 홈·내 회의·라이브러리·후속 업무·설정이다. 10번 등 후속 시안 일부는 다섯 번째가 템플릿으로 바뀌어 서로 충돌한다. 화면마다 탭의 의미가 바뀌지 않도록 **01 하단 탐색 고정 + 템플릿/개인실을 홈·내 회의 및 전체 메뉴에서 접근**하는 안을 권고한다. 이 변경은 원본 100% 일치 항목으로 숨기지 않고 공통 탐색 조정 사항으로 남긴다.

06 실제 룸은 몰입형 회의 제어가 우선하므로 일반 하단 내비게이션을 겹쳐 표시하지 않는다. 관리자는 별도의 관리 탐색을 사용하고 일반 사용자에게 관리 항목을 노출하지 않는다.

## 3. 홈은 신규 메뉴의 연결 중심이다

카드를 같은 크기로 나열하는 구성을 되풀이하지 않는다. 승인 01의 정보 위계와 두 종류의 열 비율을 따른다.

1. **상단 상태·다음 행동:** 날짜/시간대, 현재 컨텍스트, 코드 참여·예약·즉시 시작. 실제 권한과 공급자 상태를 사용한다.
2. **지금/다음 회의 focus:** 제목·시각·참석 응답·구조화 안건, 장치 점검/입장, 사전 자료 및 초대 복사. 안건 개수를 완료율로 표시하지 않는다.
3. **오늘 일정 + 내 처리함:** 데스크톱 8:4, 모바일 일정 다음 처리함. 내 회의/준비, AI 검토, 실제 Work의 기한/수락 대기로 이어진다.
4. **최근 게시 결과 + 템플릿·개인실:** 데스크톱 7:5, 모바일 순차 배치. 게시본만 일반 사용자에게 표시하고 템플릿은 실제 즐겨찾기, 개인실은 실제 생성 상태를 쓴다.

템플릿이 없으면 만들기/탐색, 개인실이 없으면 설정 시작, 회의가 없으면 예약을 안내한다. 샘플 회의나 가짜 업무를 운영 데이터에 섞어 빈 화면을 채우지 않는다. 영역별 조회 실패/권한 철회가 다른 영역의 일반 참여 기능을 불필요하게 막지 않도록 독립 상태를 둔다.

공통 DWP 셸은 현재 헤더 64px, 탐색 248/72px, 콘텐츠 거터 16/24/32px를 유지한다. 본문에 임의의 좁은 `maxWidth`를 추가하지 않는다. Stitch 원본 01은 헤더 56px·탐색 240px인 차이가 있으므로 **공통 셸 일관성**과 **본문 원본 충실도**를 별도로 비교한다. 이 차이를 승인 원본과 동일하다고 보고하지 않는다.

## 4. 메뉴 사이에서 이어져야 하는 계약

| 출발 → 도착             | 전달하는 정본                                                                                 | 반드시 검증할 실패/경합                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 10 템플릿 → 03 예약     | templateId + immutable revision + 검토할 초안                                                 | 접근 철회, 삭제, 구버전, 다른 tenant; 참가 권한·동의·장치 복사 금지               |
| 03 예약 → 04 준비       | 생성 응답 meetingId → GET preparation에서 서버 itemId/revision 조회; receipt는 서버 내부 증거 | 같은 key 재시도, 감사 실패 rollback, 회의만 저장되고 안건 누락되는 부분 성공 금지 |
| 02/04 참석 응답 → 01/02 | invitationRevision + 응답 version                                                             | 참석 수락≠입장 승인; 일정 변경 시 재확인, 오래된 응답 거부                        |
| 12 설정 → 05 점검       | 계정 기본값 + 이 브라우저 장치 선호                                                           | 계정 전환, 장치 제거, 저장 실패, 정책 우선; 페이지 진입만으로 카메라 시작 금지    |
| 11 개인실 → 05/06       | 현재 초대 revision + 실제 meetingId                                                           | 초대 회전, 두 시작 명령 경쟁, 이전 링크; alias가 미디어 접속 권한이 아님          |
| 06 종료 → 07/08         | 실제 artifact/run/report lifecycle                                                            | 처리 대기/실패/보존 만료, 녹화·전사·AI를 서로 완료 상태로 오인 금지               |
| 08 후보 검토 → 09       | 서버 영속 candidate UUID/version, 사람 확정                                                   | 배열 index·AI 문장 자체를 identity로 사용 금지, 이전 보고서/원문 권한 철회        |
| 09 → Work → 01/09       | Work assignmentId + version + assignmentRevision                                              | 생성 중 timeout/중복, 담당자 변경, 수락과 진행 분리, 오래된 worker/권한           |
| 사용자 기능 → 13/14/15  | 정책 버전·실행 결과·안전한 증거                                                               | 관리 권한이 녹화·전사 열람 권한으로 확장되지 않음                                 |

목록 필터·선택·스크롤 복귀, 새로고침 시 복구, 미저장 변경 이탈 경고, 401/403 이후 늦은 성공 응답에 의한 화면 복구 방지도 각 화면 계약에 포함한다.

## 5. DB 설계와 실제 구현의 구분

다음은 현재 신규 migration에 실제 작성된 테이블이다. 개발용 PostgreSQL 적용 검증과 공유 실행 DB 배포는 구분한다.

| Migration | 실제 테이블                                                                                                                                                                                                                        | 책임/주요 무결성                                                                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V26       | `vm_meeting_templates`, `vm_meeting_template_revisions`, `vm_meeting_template_agenda_items`, `vm_meeting_template_favorites`, `vm_meeting_workspace_commands`                                                                      | 개인/조직 범위, 불변 revision, 순서 안건, 사용자 favorite unique, 명령 idempotency                                                                                                                                     |
| V27       | `vm_personal_meeting_rooms`, `vm_personal_meeting_room_sessions`                                                                                                                                                                   | tenant/owner 단일 개인실, opaque alias/revision, 현재 세션 경합 방지                                                                                                                                                   |
| V28       | `vm_meeting_user_preferences`                                                                                                                                                                                                      | tenant/user SELF 설정, optimistic version; 기기 식별자·녹화 동의 제외. 로컬 장치 선호는 명시적 점검에서만 유효 inventory와 대조해 U05 prejoin/LiveKit에 적용                                                           |
| V29       | `vm_meeting_preparations`, `vm_meeting_agenda_items`, `vm_meeting_invitation_responses`, `vm_meeting_preparation_commands`, `vm_meeting_template_sources`                                                                          | 안건 version, 초대 revision, tenant 포함 FK, 기존 데이터 backfill, 템플릿 revision 추적                                                                                                                                |
| V30       | `vm_meeting_series`, `vm_meeting_occurrences`, `vm_meeting_schedule_commands`, `vm_meeting_invitation_outbox`, `vm_meeting_preparation_materials`, `vm_meeting_material_retention_state`, `vm_meeting_material_retention_evidence` | 회차/series version·scope·impact fingerprint, durable idempotency receipt, payload-free 초대 의도, host-only pending metadata, 만료 즉시 비노출·lease/fence 보존 purge 증거                                            |
| V31       | `vm_meeting_followup_assertion_replay`                                                                                                                                                                                             | public OpenAPI에서 숨긴 `POST /internal/v1/meeting-followups/resolve` + `X-DWP-Work-Assertion`; 서명 assertion/JTI replay 소비. current Auth authority 부재 시 CREATE, People eligibility 부재 시 REASSIGN fail-closed |
| V32       | `vm_meeting_intelligence_auto_requests`                                                                                                                                                                                            | 전사 확정 후 content-free AI recap queue, same-source/idempotency 수렴, lease reclaim과 stale worker terminal 차단                                                                                                     |
| V33       | `vm_meeting_transcript_access_windows`                                                                                                                                                                                             | tenant/user/artifact/version/retention에 결속된 bounded transcript segment/search 및 짧은 조회 window                                                                                                                  |
| V34       | `vm_meeting_facilitation_states`, questions/upvotes, polls/options/votes, commands, retention evidence                                                                                                                             | 실제 Q&A·투표·안건 timebox, sequence/version/idempotency, 원문 없는 command receipt와 만료 purge                                                                                                                       |
| V35       | `vm_meeting_chat_retention_health`, `vm_meeting_chat_retention_evidence`                                                                                                                                                           | 만료 chat plaintext 물리 파기, CAS lease/fence/heartbeat/backlog readiness, stale worker 차단, content-free evidence·audit·terminal 원자성                                                                             |
| V36       | `vm_meeting_schedule_drafts`, draft participants/agenda/commands/retention health/evidence, `vm_meeting_personal_preparations`, personal preparation items                                                                         | U03 tenant/user별 수동 저장·복원·폐기·preview·commit, discard-only source 철회, silent autosave/localStorage 금지; U04 SELF-only 준비 체크와 version/CAS·retention 무결성                                              |

V30–V36으로 반복 일정/회차·예약 변경/취소, 알림 outbox 의도, 자료 참조 metadata·보존, follow-up source 방어, AI 자동 요청, bounded 전사 조회, Q&A·투표·timebox, chat plaintext 파기, 수동 예약 초안과 SELF-only 준비 체크 계약을 구현했다. 아직 별도 설계/구현이 필요한 저장 또는 외부 단위는 Notification 전달 claim/retry receipt, 신뢰 공급자의 원자료 ACL 재검증 ticket, 소회의실 provider 명령, 라이브러리 개인 보기/favorite다. 기존 JSON 필드에 무리하게 넣어 새 의미를 숨기지 않는다.

공통 원칙: tenant 포함 복합 FK, 의미별 unique/check/index, 버전 충돌, 감사와 상태의 동일 트랜잭션, 외부 HTTP 호출 중 DB row lock 금지, durable receipt/fence/lease로 재시도 수렴, 삭제·보존 worker와 readiness 결속. 원문 전사/영상/음성·민감 AI 결과를 일반 command/audit 로그에 넣지 않는다.

상세 컬럼·API·보존 및 조건부 공급자 범위는 05 설계 문서를 정본으로 한다. 6–7절은 향후 설계 제안이며, 현재 화면 연결에는 **11절 실제 API**, 미구현 항목에는 **12절**을 적용한다. 제안 endpoint를 이미 동작하는 주소로 사용하지 않는다.

## 6. Work 작업에 이관한 범위

사용자 승인에 따라 「업무 앱 역할과 차별성 분석」 작업에 확정 업무 소유 범위를 이관했다.

- **Meeting 소유:** 게시 보고서에 결속된 AI 후보 projection/근거, 사람의 검토, 원본 ACL, 안정 candidate identity, U09 출처/검토 화면, V31 signed source ingress와 JTI replay 방어.
- **Work 소유:** 독립 업무 정본, durable command receipt, 담당자 배정·수락/거절·재배정·실행 상태·기한, 타임라인, Work 측 API/DB/테스트.
- **구현된 연결 경계:** `MEETING_FOLLOWUP {meetingId, reportId, candidateId}` → `WORK_ASSIGNMENT + assignmentId`, expectedSourceVersion, 전용 signed workload assertion, source ACL/retention 재확인. 이 경계의 존재를 action 활성화로 해석하지 않는다.
- production `MeetingFollowupCurrentAuthority`는 current Auth authority adapter가 없어 `AUTHORITY_UNVERIFIED`를 반환하므로 CREATE는 UI와 owner service 모두 fail-closed다. REASSIGN은 같은 Auth 판정과 People의 현재 tenant membership/assignability 판정이 모두 준비되어야 하며 지금은 활성화하지 않는다.
- Work의 durable command receipt와 by-source reconciliation은 응답 유실·중복을 복구한다. 공용 서비스 토큰을 이용한 Meeting worker의 사용자 대행이나 Gateway 신원 가장은 만들지 않는다.
- 기존 self-only 개인 업무로 다른 사람의 업무나 수락을 위조하지 않는다. 원문 인용을 Work 설명에 자동 복제하지 않는다. 원본 접근이 사라져도 사람이 확정한 독립 Work를 cascade 삭제하지 않는다.
- Work 쪽 추가 디자인이 필요한 부분은 그 작업에서 사용자에게 분리 보고한다. Meeting 01–15 승인 화면을 Work 자체 UI처럼 다시 설계하지 않는다.

## 7. 적용 순서와 사용자 확인 지점

| 순서 | 구현 묶음                                                            | 사용자가 확인할 변화                                                                  | 통과해야 다음 묶음                                           |
| ---- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 준비 | 30프레임 식별·시각 비교, 본 문서, 05 API/DB, 소유권·모바일 탐색 결정 | 메뉴 구성·흐름·기존/신규/조건부 경계가 명시됨                                         | 원본 누락/충돌·죽은 링크 설계 제거                           |
| 1    | 사이드바/라우트 + 템플릿/개인실/설정 + 현재 예약·안건/응답 준비 연결 | 실제 새 메뉴와 저장·재방문, 템플릿으로 예약/개인실 입장                               | 권한·idempotency·왕복 E2E·모바일/a11y·U10–U12 원본 시각 비교 |
| 2a   | 예약 변경·반복/회차, 자료 참조, 준비 metadata, 통지 outbox의 DB/API  | V30 예약/회차와 fail-closed 자료 metadata·통지 의도 구현; 외부 ACL/dispatcher는 NO-GO | DB 무결성·DST/변경 영향·멱등 replay·만료/비호스트 redaction  |
| 2b   | 01 홈·02 내 회의·03/04/05의 승인 디자인 적용                         | 기존 홈이 실제로 바뀌고 준비/입장/자료/도구로 연결                                    | 1280/1440/390 원본 대비 + 현재 데이터/빈/오류 상태           |
| 3    | 07/08 결과와 09 후속 업무, Work integration                          | 검토한 후보가 실제 담당 업무가 되고 홈에서 후속 처리                                  | source ACL 철회·중복 전환·수락/진행 종단 테스트              |
| 4    | 06 진행 도구·13–15 관리                                              | 룸 도구와 정책/운영 증거 연결                                                         | provider 포함 실행 및 안전한 미구성 상태                     |
| 마감 | 모든 화면 교차·실브라우저·운영 준비                                  | 30개 시안 대응표와 남은 외부 Gate 제시                                                | 디자인/기능/보안/운영을 각각 판정                            |

사이드바 항목을 먼저 추가하고 빈 페이지나 샘플 성공으로 채우는 방식은 완료로 보지 않는다. 반대로 백엔드 작업만 계속하면서 홈/탐색의 반영 여부를 모호하게 두지도 않는다. 각 묶음은 화면 진입부터 실제 저장과 복귀까지 닫은 뒤 진행 상태를 보고한다.

## 8. 디자인 완료 판정

- 승인 원본 ID/폭/높이와 실제 구현 화면을 연결한다. 데스크톱 이름에 1440이라고 써 있어도 실제 원본 폭 1280이면 이를 구분한다.
- 동일 fixture·언어·시간대·viewport로 비교하며, 원본과 다른 영역 누락·열 비율·간격·크기·서체·아이콘·상태·모바일 순서를 목록화한다.
- 기능 검증과 시각 검증을 별도 증거로 남긴다. 자기 화면에서 갱신한 screenshot baseline만으로 원본 일치라고 하지 않는다.
- 공통 셸 치수, 고정 모바일 탐색, 44px 터치 영역 등 접근성 보정, 실데이터가 없는 예시 수치/인증 문구는 차이 사유를 명시한다.
- 내부 DB retention/readiness/purge는 V35 chat과 V36 schedule draft까지 구현했다. 아직 실제 장치·browser media·TURN·녹화 Egress/저장·STT·LLM·KMS·외부 object 삭제/crypto-shred가 연결되지 않은 기능은 운영 NO-GO를 유지한다. 디자인에 존재한다는 이유로 활성/성공 상태를 만들지 않는다.
- 시안의 미리 체크된 AI 동의, 정적 사진에 붙은 실제 장치/FPS 상태, 서로 충돌하는 즉시 삭제/90일 보존 문구는 실제 기능으로 그대로 옮기지 않는다. 안전한 동의·실측·보존 계약을 적용하고 원본 보정 사항으로 공개한다.

이 기준표는 구현·검증 완료 항목과 외부 운영 NO-GO를 섞지 않고 사용자가 기대한 화면을 누락 없이 인계하기 위한 기준이다.
