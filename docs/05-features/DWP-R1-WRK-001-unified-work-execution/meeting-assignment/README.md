# 회의 후속 업무의 Work 배정 계약

공통 후속 상태는 [2026-09-04 CLOSED / FROZEN 보고서](../../DWP-R1-CORE-006-product-surface-separation/11-2026-09-04-closeout.md)를 따른다. 공유 트리의 전체 단위 385개 파일·2,606개와 production build가 통과했고, 초기 raw 1,050.5 KiB·gzip 306.8 KiB는 기존 예산 이내다. signedWorkload registry와 기존 U09 배정 SDK 소비·도달성 차단은 해소됐다. 외부 출시 증적 37건 BLOCKED, 후보 승격·재배정 NO-GO, 새 Work 디자인·화면 대기는 별도로 유지한다. 아래 Work 배정의 개별 검증 수치를 공통 전체 검사나 운영 승인과 합산하지 않는다.

상태: 2026-09-04 현재 Work 공개 DTO·service·원천 송신부와 소유권 합의를 대조한 인계입니다. Work 배정 [backend 42개](evidence/backend-tests.json)(실제 PostgreSQL 15개 포함, 실패/오류/skip 0), [shared API의 기존 단위 검증 11개](evidence/frontend-tests.json) 통과를 확인했습니다. [프런트 검사·도달성 결과와 source SHA](evidence/frontend-checks.json)도 기록했습니다. Meeting U09에서 기존 Work 배정의 목록·상세·수락/수행 API를 소비하는 코드와 production 도달성은 확인했으며, 실제 Gateway·브라우저 E2E 완료는 확인하지 않았습니다.

회의에서 사람이 검토·확정한 후보를 Work의 독립 배정 업무로 만들고, 지정된 담당자가 수락하거나 거절한 뒤 수행합니다. Meeting은 후보·원문·인용·승격을, Work는 확정 업무 조건·배정·수락·진행·완료를 소유합니다. 기존 `PersonalWorkTask`에 다른 사람의 소유권을 덧붙이지 않습니다.

| 문서                                                 | 목적                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [implementation-report.md](implementation-report.md) | Work 구현 결과·검증 증거·실제 연결을 위해 남은 소유자별 조건                                   |
| [contract.md](contract.md)                           | 공개 13 operations, 식별·상태·권한·출처·명령 결과와 Gateway/SDK/Meeting 소유자별 인계          |
| [design-impact.md](design-impact.md)                 | 기존 01/05/09/12 시안에 덧붙일 디자인 AI 프롬프트. 새 영구 메뉴/화면 코드를 만드는 의뢰가 아님 |
| [verification-matrix.md](verification-matrix.md)     | 권한·중복 승격·재배정 경쟁·출처 삭제·역전 이벤트·UI 회귀 수용 기준                             |
| [source-protocol-v1.md](source-protocol-v1.md)       | 별도 소유 작업이 작성한 Work→Meeting 서명 검증 프로토콜. 양쪽 실제 연결 완료 의미는 아님       |

디자인 전달 시 기존 공통 맥락과 대상 화면 프롬프트에 `design-impact.md`의 공통 추가 프롬프트와 해당 화면 추가 프롬프트를 함께 붙입니다. 이 패키지의 변경은 **Work 배정 업무 유형에 한정**합니다. 개인 할 일·결재·서비스의 기존 계약을 바꾸지 않습니다.

공개 prefix는 `/api/platform/v1/workspace/work-hub/assignments`입니다. 생성자는 임의 제목·담당자를 Work 생성 본문에 보내지 않고, `MEETING_FOLLOWUP`의 정확한 meeting/report/candidate identity와 검토한 `expectedSourceVersion`을 보냅니다. Work는 소유 서비스가 재확인한 확정 조건으로 업무를 만듭니다.

기존 배정 업무는 `pages/meetings.tsx → MeetingFollowUps → work-assignment-api`로 목록을 조회하며, `meeting-follow-ups-state.tsx`가 상세·명령 receipt·수락/수행 transition을 소비합니다. 해당 코드 연결과 production 도달성 검사는 통과했습니다. 이는 실행 가능한 제품 코드 경로를 확인한 것이며 실제 Gateway 응답이나 브라우저 E2E 통과를 뜻하지 않습니다.

후보 CREATE/by-source 및 REASSIGN은 현재 U09에서 활성화되지 않았습니다. 후보의 현재 Meeting 권한·target eligibility·원천 수신부가 검증되기 전 후보 승격·재배정은 **NO-GO**입니다. 승인된 후보 생성 연결 방식은 본인 인증 브라우저의 Work SDK 호출이며, 서버 worker가 임의 사용자 권한으로 대신 생성하지 않습니다. 이 생성 흐름의 응답 유실은 같은 UUID 명령키의 receipt 및 현재 접근 가능한 by-source 조회로 복구하도록 계약되어 있습니다.

목록은 원본 HTTP 없이 Work 정보를 반환합니다. 출처는 `NOT_REQUESTED`이며 reference/sourceVersion/sourceRoute는 모두 null, canReassign은 false입니다. 이는 원천 조회 실패가 아닙니다. 상세·명령 응답·receipt에서는 현재 원천을 확인한 뒤 `AVAILABLE` 또는 `UNAVAILABLE`로 판정합니다. 출처 상태와 관계없이 Work 수행은 현재 Work 역할·capability를 따릅니다.

현재 확인한 기반:

- backend `WorkAssignmentDtos.java`: 별도 assignmentState/workState, assignmentRevision/version, 원천 view, capability, 현재 권한에 맞는 mutation result와 receipt.
- backend `WorkAssignmentSourceAuthority.java`: 생성 확정·재배정 권한·현재 원천 조회를 분리한 owner port.
- backend controller/service/repository의 공개 경로·version/revision·현재 참여자 범위·멱등 receipt·목록 원천 미조회 코드 확인.
- 기존 U09의 Work 목록·상세·receipt·transition 소비 코드 확인. production-reachability PASS(1,152/1,155 modules, 42 roots, 3 governed), unused exports PASS(2,430 declarations, 4 exact exceptions). 기존 API 단위 11개 결과와 새 도달성 검사는 서로 다른 검증 범위입니다.
- Work 원천 송신부: 응답 본문 수신을 포함한 시간 제한, 16 KiB 제한, 중복 키·후행 JSON 거부, DB transaction 밖 원천 확인과 최대 10초 검증 스냅샷. 실제 양쪽 권한 철회와 commit을 원자적으로 보장한다는 의미는 아님.
- Meeting [계약 6.6](../../DWP-R1-MTG-001-enterprise-video-meetings/05-meeting-design-contract-matrix.md#66-후속-업무와-work-정본): 영속 후보·본인 브라우저의 Work 생성/복구·멱등 명령·독립 Work 보존.

Meeting의 governed authority·대상자 적격성·서명/nonce 수신부와 실제 Gateway·브라우저 E2E는 각 소유 작업의 연결 검증 항목입니다. 현재 연결 gate가 닫히기 전 실제 원천 승격은 **NO-GO**입니다. 상세 책임과 해제 증거는 [연결 인계 표](contract.md#6-연결-인계와-go--no-go)를 따릅니다. typed signedWorkload 등록과 checker 보완 후 service-boundary 재검사가 통과했으며, source-size/unused-private/Java-cycle도 통과했습니다. [정적 검사 증거](evidence/local-checks.json)와 [검증 표](verification-matrix.md)는 정적 계약·제품 코드 소비 확인과 실제 연결 검증을 구분합니다. 정적 등록이나 도달성은 현재 Meeting 권한을 활성화하거나 실제 원천 수신·브라우저 동작을 증명하지 않습니다. 이전 개인 업무 결과를 새 배정 기능의 증거로 재사용하지 않습니다.
