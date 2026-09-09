# 통합업무함 소유 범위 최종 검증

기준일: 2026-09-08. **WORK_OWNED_COMPLETE** — Work 자체 구현과 필수 로컬 검증을 마쳤다. 원본 18프레임(데스크톱 11·모바일 7), 6개 경로를 최종 성공 실행과 연결했다. 실제 테넌트 또는 픽셀 동일성 인증은 아니다.

검증 범위는 2026-09-08 기록 소스 스냅샷(`4cdc185b3d2e0040720a45a21691878a2c48ef6a6f5fa9e1bf1f359fea8f68f2`)이다. `WORK_OWNED_COMPLETE`는 이 스냅샷에서의 Work 완료 상태이며, 동결 해제 이후 변경된 작업 트리까지 검증했다는 뜻은 아니다. 스냅샷 검증 상태: `PASS_AT_RECORDED_WORKTREE_SNAPSHOT`.

[최종 검증 JSON](implementation-evidence/2026-09-07-resume/owned-scope-final/validation.json) · [18프레임 비교 갤러리](implementation-evidence/2026-09-07-resume/owned-scope-final/gallery-2026-09-08/index.html) · [갤러리 manifest](implementation-evidence/2026-09-07-resume/owned-scope-final/gallery-2026-09-08/manifest.json)

업무 앱의 주 사용자는 여러 원천 앱에 처리 책임이 흩어진 임직원이다. 운영 질문은 “지금 어떤 업무를 어떤 순서로 처리하며, 실제 실행은 어디서 하는가?”다. 주 행동은 업무 선택, 근거 확인, Work 소유 명령 또는 원천 앱 이동이며, 화면은 목록–상세와 오늘 계획 워크플로로 구성한다.

## 제공 범위

- `/work/queue`, `/work/action-required`, `/work/day-plan`, `/work/in-progress`, `/work/awaiting-response`, `/work/completed`의 6개 독립 경로.
- Stitch 보관 원본 18개(데스크톱 11, 모바일 7)와 기록 스냅샷의 React 화면 18개를 같은 키로 연결한 갤러리.
- 개인 할 일 생성·편집·삭제·체크리스트·상태, 오늘 계획·순서·버전 충돌 복구, Access Review 결정·권한 반영 상태.
- 결재·서비스의 풍부한 읽기 전용 근거와 검증된 소유 앱 이동, Calendar 이벤트/Work 관계의 독립 수명주기.
- 지원되는 업무의 일괄 실행·정확한 결과·제한된 재시도, 원천별 현재 상태와 읽기 전용 복구.
- Home의 개인 업무/계획 contribution, 선택 업무 AI 읽기·출처·복사·저장된 대화 이어가기.
- Workspace 및 개인 업무에서 Activity의 정확한 원천/객체 기록으로 이동하고 원래 업무·포커스로 복귀.

## 이번 감사로 닫은 동작

1. **Access Review 응답 검증:** fresh ref, subject, role, source, version, 제출 decision/reason과 응답 identity/version+1/remediation/decidedAt을 결속한다. 미리보기 이후 원천이 달라지거나 2xx 본문이 잘못되면 성공·캐시 갱신·queue invalidation을 내보내지 않는다.
2. **생성 요청 복구 저장소:** v2 collection은 SHA256 owner/input와 UUID/timestamp만 저장한다. 원문을 저장하지 않으며 TTL 30분, 최대 8개/8192 bytes, 역순 응답·정확한 항목 제거·v1 migration·만료·저장 실패를 다룬다.
3. **생성 후 오늘 계획 경쟁:** direct submit과 recovery가 coordinator별 같은 직렬 lane에서 최신 계획을 읽는다. loadPlan 이후 PUT 직전에 aggregate/personal READY와 생성된 업무 identity/version을 다시 확인한다. outage/drift 때 plan mutation은 0회이며 confirmation을 acknowledge하지 않고 재시도를 보존한다. 지속 장애의 timestamp 변화로 재시도 루프가 발생하지 않는다. 첫 계획의 정상 초기 `version:0/items:[]/updatedAt:null`은 허용하고 저장 응답의 timestamp는 필수로 검증한다. 실제 브라우저에서 발견한 최초 저장 거절을 고쳤으며 direct/recovery 회귀 2개가 수정 전 실패·수정 후 통과했다.
4. **명령의 최신 권한:** 실패 refetch에 남은 READY 캐시를 권한으로 쓰지 않는다. aggregate/source 상태, 정확하고 유일한 source ID/업무 identity/version/status/action을 확인한 뒤 quick/batch/plan/create/edit/access/personal/runtime 명령을 보낸다. 개인 상태 버튼은 실제 허용 전환과 일치한다. 같은 사용자·업무의 상세 버전 재조회에서도 체크리스트 초안을 보존하고, 최신 서버 내용과 대조한 뒤 명시적으로 교체하도록 한다. 다른 사용자·업무에는 이전 상세를 전달하지 않는다.
5. **Calendar 제출 시점 검증:** 최신 개인 캘린더 목록·생성 capability를 재검증한다. 연결 해제는 새 목록에서 단 하나의 LINKED linkId/work/eventId/version을 확인한다. 이벤트 생성과 Work 관계 저장, 관계 해제와 이벤트 삭제를 구분한다. 같은 명령 범위의 메타데이터 재조회는 사용자가 편집한 일정 제목·시간을 초기화하지 않는다.
6. **장애 중 탐색:** AI·계획·일정·변경 명령을 막아도 원천/Activity 읽기 전용 이동과 기존 선택의 Cancel/Escape는 유지한다. 대화상자 Escape를 가로채지 않는다.
7. **개인 업무 Activity 연결:** `objectType=WORK_ITEM`, `objectId=<task UUID>`, `source=PERSONAL_TASK`를 사용한다. 같은 UUID라도 Workspace와 개인 원천을 혼동하지 않으며 owner/권한/version/TTL 검증 후에만 복귀 포커스를 복원한다.
8. **모바일 상호작용:** 포인터 누름/해제 사이의 사용자 정의 scrollIntoView가 체크박스 click을 잃게 하던 보완을 유지하고 반응형·키보드·포커스 회귀에서 다시 확인한다.

## 최종 결과

| 검증                                                                                  | 최종 결과                                             |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Work 단위 테스트                                                                      | 57파일 · 703 PASS                                     |
| 전체 단위 테스트                                                                      | 518파일 · 4235 PASS                                   |
| 브라우저 13 spec × 2 projects                                                         | 230 PASS · 16 명시적 skip · 실패/불안정 0             |
| 비증분 TypeScript · 전체 build · Workspace build                                      | PASS                                                  |
| API snapshot · architecture/boundaries · 크기 · 디자인 시스템 · i18n/display · ESLint | 전체 build에 포함, PASS                               |
| Prettier · git diff                                                                   | 최종 증거 작성 후 PASS, validation에 결과와 로그 기록 |

전체 검증 전후 비배포 소스 2,851파일 SHA256은 `4cdc185b3d2e0040720a45a21691878a2c48ef6a6f5fa9e1bf1f359fea8f68f2`로 같았다. 갤러리 SHA는 최종 검증 JSON에 고정했다. 초기 실패 실행은 최종 갤러리의 입력으로 사용하지 않았다. 지정 실패 트리 `owned-scope-final/browser-2026-09-08-final/`는 v4 전체 테스트 통과 뒤 제거했다. 이후 일반 viewport 검사에서 AI 버튼 겹침을 추가 수정해 v5로 전체 검증과 갤러리를 교체했다. 원래 삭제 시각과 최종 대체 실행을 정리 기록에 함께 남겼고 다른 과거 기록은 보존했다.

18개 PNG를 직접 열어 검토했다. 모바일 full-page의 고정 탐색 표시와 Home의 부분 데이터 지연을 캡처 해석 한계로 기록했다. 03-D에서 발견한 전역 DWAI launcher 겹침은 Work action 영역에 기존 회피 계약을 적용해 수정했고 실제 viewport 간격을 검증했다. 11-D도 일반 viewport에서 실제 겹침을 확인해 Work AI action 영역을 보완하고 간격 검증을 추가했다. [시각 검사 기록](implementation-evidence/2026-09-07-resume/owned-scope-final/logs-2026-09-08/visual-review.json)

## 검증과 증거 원칙

최종 unit/TypeScript/build/browser/static/format 결과와 exact command, 로그, source hash, 실행 시각을 validation에 기록한다. 동결 전 발견한 포맷 차이와 Meetings의 줄어든 크기 예외는 소유자가 정리했다. 빌드에서 발견한 DWAI sourceTypes 및 Activity objectTypes 표시 사전 문제도 해당 소유자가 수정했고 최종 소스에서 다시 검사한다. 기준을 올려 검사를 통과시키지 않는다.

브라우저는 별도 포트에서 기존 서버 재사용 없이 Chromium과 iPhone 13/WebKit 에뮬레이션, workers=1로 실행한다. 1440/1280/390/320, 한·영, light/dark/forced-colors, reduced motion, 키보드/포커스, 부분 실패를 포함한다. 200% 검증은 CSS zoom·글자 확대·720 CSS px reflow 대체 검증이며 실제 모바일 기기·가상 키보드·브라우저 메뉴 zoom 인증이 아니다. Axe는 명시한 serious/critical 위반 범위를 검사한다.

갤러리는 하나의 완전 통과 실행에서만 만들며 실패 artifact가 없는지 확인한다. 각 원본·구현 PNG의 SHA256와 치수, source spec/project, manifest SHA를 검증한다. controlled fictional fixtures이며 `pixelPerfect=false`, `liveTenant=false`다. 원본의 데스크톱 제목/실제 폭 차이와 실제 320px·dark·forced-colors 원본 부재는 보관 manifest 그대로 명시한다.

## 외부 앱의 남은 책임

기록 스냅샷의 Work 프런트 구현을 막는 미정의 연계 인터페이스는 확인하지 않았다. 남은 책임은 실제 테넌트·배포 조건이다. 권한 검토의 PENDING/MANUAL_REQUIRED 이후 실제 권한 회수는 Identity Governance/App Admin, 결재/서비스 제출은 해당 소유 앱, Calendar 이벤트 관리와 실제 캘린더 권한은 Calendar, 원천 권한을 지킨 AI 응답·대화 저장과 모델 서비스는 DWAI가 소유한다. Work의 성공 테스트를 각 앱의 운영 완료로 확대하지 않는다.

Approval의 실제 로컬 계정 승인/보완 POST 200·버전/상태/return 확인, Calendar 격리 PostgreSQL 130/130, Activity 격리 backend/DB projection 및 양방향 handoff 근거는 별도로 구분한다. Calendar의 덮어쓴 shared XML을 최종 근거로 재사용하지 않는다. Services/App Admin 전체 고도화와 과거 폐기된 Work 서비스 직접 응답은 Work 완료의 직접 차단 조건이 아니다.

정리된 임시 승인 검증 스크립트에 들어 있던 자격 증명은 계정 소유자가 교체해야 한다. 스크립트 삭제를 자격 증명 폐기로 간주하지 않는다.
