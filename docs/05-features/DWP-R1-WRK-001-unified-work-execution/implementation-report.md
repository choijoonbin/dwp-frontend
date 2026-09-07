# 업무 앱 디자인 전 기능 구현·검증 기록

기준일: 2026-09-04. 최초 분석 후 사용자가 요청한 기능 선행 구현 범위이다. 시장 순위를 확인하지 않은 제품을 ‘글로벌 점유율 상위 3개’로 단정하지 않으며, 최초 보고서의 Microsoft 365·ServiceNow·SAP는 업무 관리 패턴 비교 대상이다.

## 1. 구현한 기능

| 영역             | 적용 결과                                                                                                                                                                          | 현재 노출                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| 실제 원본 통합   | 기존 전자결재, 내 서비스 요청, Workspace/Review projection, 새 개인업무 API를 각각 조회해 공통 책임 모델로 결합                                                                    | 기존 업무함/업무 홈 데이터 연결                    |
| 완료 의미        | 원본 소유 항목의 일반 완료를 프런트와 서버·SQL에서 차단. 네이티브 TASK만 Workspace generic command 가능                                                                            | 기존 CTA·일괄 처리 교정                            |
| 유형별 행동      | 개인 상태 변경, 전자결재 claim/decision, 접근권한 검토 결정을 기존 소유 API로 dispatch. 원본 이동은 HANDED_OFF로 구분                                                              | 기존 native/Review 행동 + 새 화면용 controller     |
| 상태 모델        | 진행 단계, 기한 긴급도, 내 차례/상대 차례, 취소·보관을 분리. 기한 없는 항목은 유한 기한 뒤                                                                                         | 공통 모델·기존 표시 교정                           |
| 조회 신뢰성      | 원천별 READY/FORBIDDEN/UNAVAILABLE/NOT_REQUESTED, 수신/원천 시각, 상한 도달 여부, 전체/부분 결과                                                                                   | 부분 실패/갱신 표시와 모델                         |
| 개인 할 일       | 생성·수정·시작·대기·완료·재개·보관·이력. 개인·테넌트 범위, optimistic version, UUID 멱등 명령, 감사·이력 동시 저장                                                                 | API·클라이언트·controller·전용 폼                  |
| 개인 캡처        | 제목/설명을 사용자가 작성하고 원본 식별자를 연결. 서버가 원본 제목·상태·URL 입력을 신뢰하지 않음                                                                                   | API·controller; 각 원본 앱 캡처 버튼은 디자인 대기 |
| 오늘 계획        | 날짜별 최대 100개 선택·정렬·제거, 별도 버전과 멱등성. 접근이 사라진 항목도 개인 선택 참조로 보존·정리                                                                              | API·controller·오늘 계획 패널                      |
| 캘린더 시간 연결 | 편집 가능한 개인 캘린더에 비공개 FOCUS 일정 생성 후 개인 업무 연결 저장. 시간·완료 상태 독립. 일정 성공/연결 저장 실패 분리                                                        | API·controller·연결 대화상자                       |
| AI 연결          | 사용자가 검토한 선택 업무 목록 맥락과 질문을 기존 일회성 question launch로 전달. 원문 전체 자동 전달·처리 성공 단정 없음                                                           | controller·선택 업무 AI handoff 표면               |
| 복귀/재시도      | canonical 참조 링크, 캐시 복귀 후 controller 상태 복원, 날짜 계획의 정상 편집 draft 보존, 409 뒤 최신 계획 채택과 거절 draft 재전송 차단, native 명령과 일정 명령의 동일 키 재시도 | 공통 런타임/명령 모델                              |
| 공개 API 계약    | 새 10개 경로·14개 operation. 인증 context의 query 노출 제거, 기존 이력 스키마와 이름 충돌 해소                                                                                     | Backend OpenAPI와 Frontend generated 계약 동기화   |

기존 업무 홈을 제거하고 업무 앱의 기본 진입을 `/work/queue` 통합업무함으로 정리했다. 이전 Work 경로는 지원하는 query를 보존해 canonical 경로로 이동한다.

## 2. 원본 접근과 데이터 의미

`AVAILABLE`은 서버가 조회 시점의 현재 접근을 확인한 원본 정보다. 변경 명령의 권한까지 보장하지 않는다. `REFERENCE_ONLY`는 개인 북마크의 식별자만 저장한 것이며, 제목·상태·기한·URL을 검증한 값으로 전달하지 않는다. `UNAVAILABLE`은 접근 불가/삭제/지원 불가 등으로 현재 정보를 제공할 수 없다는 뜻이다.

개인 업무와 메일/Workspace에서 직접 검증할 수 있는 자료는 현재 사용자·테넌트의 조회 규칙을 적용한다. 결재·서비스·권한 검토의 개인 참조는 원본 앱의 고유한 Gateway 권한 검사를 보존하기 위해 서버 간 조회를 우회하지 않는다. 클라이언트가 기존 원본 API의 현재 허용된 결과로 표시 정보를 채운다. 실패나 미조회는 검증된 원천으로 승격하지 않는다.

명령에는 원본 API와 그 API의 버전·권한·검토 조건을 적용한다. 권한 회수나 충돌이 발생하면 완료 배지를 먼저 표시하지 않는다. Review의 결정 기록과 실제 권한 회수 remediation 상태도 구분한다.

## 3. 계획과 캘린더의 독립성

오늘 계획의 선택은 원본 마감일이나 진행 상태를 바꾸지 않는다. 연결을 제거해도 할 일이 삭제되지 않으며, 자정을 넘겼다고 이전 계획을 자동 완료하거나 삭제하지 않는다.

캘린더 연결 API는 개인 관계만 저장하며 `calendarAvailability=REFERENCE_ONLY`를 반환한다. 일정의 현재 존재·접근·시간·취소 여부는 캘린더 조회 결과로 확인한다. 조회 범위에 일정이 없다는 사실만으로 삭제됐다고 단정하지 않는다. 연결 해제는 캘린더 일정을 취소하지 않는다.

일정 생성 응답이 불명확하면 동일 idempotency key로 재확인한다. 일정이 생성됐지만 연결 저장이 실패하면 확인된 event ID를 유지해 연결만 다시 저장한다. 일정 생성과 업무 완료는 별도 사건이다.

## 4. 구현 위치

- Frontend `apps/dwp/src/features/work-hub/`: 원천 adapter, loader, 책임/기한 모델, 명령 dispatcher, controller, AI·캘린더 연결.
- Frontend `libs/shared-utils/src/api/`: personal-work API/계약, work-hub-calendar API, Workspace 공유 권한·정렬·참조 정책.
- Backend `dwp-platform-server/.../workhub/personal/`: 개인업무 엔진, 저장소, 원본 resolver, 컨트롤러.
- Backend `dwp-platform-server/.../workhub/calendar/`: 개인 일정 참조 관계와 감사.
- Backend `.../workspace/WorkspaceWorkPolicy.java`: 원본 소유권과 허용 행동, 현재 시각 기반 summary.
- V223: 개인업무·계획·이력·멱등성 테이블. V224: 개인 업무-캘린더 관계. 샘플 업무를 운영 데이터로 추가하지 않는다.

## 5. 검증 증거

아래 개인 업무 기반의 backend 60개·frontend 48개·HTTP/브라우저·빌드 결과는 **선행 구현 당시 snapshot**이다. 원본 JSON 증거를 이후 공유 작업 트리의 전체 결과로 덮어쓰거나 다른 시점의 집계와 합산하지 않는다. 최신 공통 후속 결과는 이 절 마지막에 구분해 기록한다.

- [Backend 60개 테스트](evidence/backend-tests.json): 실패·생략 0. 12개 실제 PostgreSQL 테스트를 포함한다. 동시 명령 단일 적용, 다른 테넌트/사용자 격리, 버전 충돌, source 접근 회수, append-only 이력, 감사 실패 롤백, 원본 상태 독립성을 검증했다.
- [실제 HTTP 검증](evidence/runtime-http-smoke.json): 임시 PostgreSQL·실제 Spring Boot 서버에 요청 35회와 상태 검증 19개, 총 54개 항목 통과. 이 검증은 브라우저 Gateway의 원본 앱 권한 여정을 대신하지 않는다.
- 새 빈 데이터베이스에서 전체 191개 migration을 V224까지 적용하고 Spring Boot 기동을 확인했다. 새 API의 공개 문서에 `context` query 또는 신뢰된 인증 헤더가 노출되지 않는지 확인했다.
- [Frontend 48개 단위 테스트](evidence/frontend-tests.json): 10개 파일, 실패·생략 0. 원천 분리·권한·중복·개인 페이지 순회·계획 복원·명령 재시도·AI 전달·캘린더 부분 성공을 검증했다.
- 전체 TypeScript `tsc --noEmit --incremental false` 통과. API/feature 경계, source-size, production reachability, 국제화 감소 기준, backend 서비스 경계·순환 의존성·미사용 private 검사 통과.
- 공유 로컬 Platform 8002에서도 새 10개 경로와 고유 스키마가 제공되는지 읽기 검증했다. 로컬 DB에 V223/V224가 적용된 상태를 확인했다. 이 작업의 별도 임시 서버·데이터베이스는 검증 후 정리했다.
- [브라우저 회귀 17개](evidence/browser-tests.json): 새 foundation 15개와 기존 일괄 처리 2개 통과. 원본 이동, 개인 명령·동일 키 재시도, 부분 실패, 권한, 링크·캐시 복귀와 완료 후 키보드 포커스를 확인했다. 1440/1280/390/320px, 라이트·다크·고대비, 긴 한영 제목, Reduced Motion, CSS 200%와 axe serious/critical 0건을 확인했다. 고정 API fixture를 사용하는 기존 UI 회귀이며, 실제 브라우저 확대·보조기기 전체 또는 새 화면 디자인 완료를 의미하지 않는다.
- 당시 전체 빌드 과정의 계약·아키텍처·디자인 시스템·국제화·ESLint·TypeScript 검사와 Vite 산출물 생성은 통과했다. 제거된 디자인 시스템 예외 200개는 기준선을 하향 갱신했다. **이 선행 snapshot의 `yarn build`는 마지막 초기 번들 용량 게이트에서 실패했다.** 불필요한 개인업무 API 재내보내기를 제거한 당시 측정은 initial raw 1172.7/1074.2 KiB, gzip 333.4/317.4 KiB, 요청 수 5/5였다. 업무 페이지·WorkHub·개인업무 API·업무 정책이 초기 모듈에 포함되지 않는 것을 확인했고 용량 허용 기준을 올리지 않았다. [당시 빌드 게이트 기록](evidence/build-gates.json)은 보존하며, 이후 공통 보정 결과와 구분한다.

### 공통 후속 마감 — 2026-09-04

[공통 CLOSED / FROZEN 보고서](../DWP-R1-CORE-006-product-surface-separation/11-2026-09-04-closeout.md)는 공유 작업 트리의 전체 단위 **385 files / 2,606 PASS**, 전체 typecheck·ESLint·architecture와 **production build PASS**를 기록한다. 공통 권한 helper와 Approval의 runtime import 보정 뒤 초기 번들은 raw **1,050.5 KiB**·gzip **306.8 KiB**·요청 5개이며 기존 한도 1,074.2/317.4 KiB·5개를 유지했다. 앞선 Work 빌드 실패가 현재 남아 있다는 의미는 아니다.

Work signedWorkload의 정적 registry/checker 등록과 기존 U09의 Work 목록·상세·수락/수행 SDK 코드 소비·도달성 차단도 해소됐다. 이 결과는 새 후보 CREATE/by-source·REASSIGN의 실제 운영 연결이나 Gateway·브라우저 종단 검증 완료를 뜻하지 않는다. [배정 기능의 별도 증거](meeting-assignment/implementation-report.md)를 참조한다.

공통 readiness는 내부 대기 0, **외부 출시 증적 37건 BLOCKED**다. Meeting 원천 승격은 현재 권한·target eligibility·receiver와 승인된 action 계약이 마련되기 전 **NO-GO**다. Work 새 화면·메뉴 개편의 후속 구현과 최종 검증은 [디자인 구현 마감](2026-09-04-design-implementation-closeout.md)에 기록한다. 공통 마감은 해당 공유 트리의 검사 기록이며 immutable release attestation은 아니다. 공통 후속에서 제품별 `build:products` 16종과 backend 전체 check를 재실행하지 않았다는 범위도 유지한다.

## 6. 제공 범위와 이후 단계

1. **디자인 후속 구현 완료**: 통합업무함 새 레이아웃, 유형별 상세, 개인 작성 폼, 오늘 계획, 캘린더 연결, AI 맥락 확인, 원천 상태·일괄 결과, 모바일과 메뉴를 구현했다. 01–12 수용 범위는 [구현 확인표](design-ai/implementation-coverage.md)에 있다.
2. **원본 API의 조회 한계**: 현재 결재 tasks/requests 기본 조회는 50개, 서비스 요청은 200개 상한이다. 상한에 닿으면 부분 결과로 표시한다. 원본 시스템 전체 건수를 완전히 수집했다는 주장은 하지 않는다. 개인업무는 페이지를 순회한다.
3. **Review 운영 반영**: 기존 Identity Governance 소비자는 승인된 온보딩을 전제로 하는 기존 설정을 유지한다. 이번 작업에서 운영 게이트를 임의 활성화하지 않았다. 실제 Review 데이터 유입/회수 처리 운영 검증은 해당 환경 구성에 의존한다.
4. **외부 제품 연동**: Microsoft·ServiceNow·SAP의 기능 패턴을 참고한 것이며, 고객 자격증명·연결 설정 없이 그 제품들에 실제로 연결했다고 주장하지 않는다. 새 코드의 원본은 현재 DWP가 제공하는 API다.
5. **AI**: 이번 범위는 현재 업무 맥락의 검토 가능한 질문 전달이다. AI가 모든 원문을 자동 수집하거나 원본을 무인 처리하는 기능은 제공 완료 범위에 포함하지 않는다.

전문가 역할은 기능·아키텍처 구현, 데이터·트랜잭션 검증, 제품/디자인 계약 및 독립 회귀 검토로 나누었다. 발견한 문제는 역할 간 교차 검토 후 수정하고, 위 증거로 확인한 범위만 완료로 기록한다.
