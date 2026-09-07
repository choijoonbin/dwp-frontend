# 통합업무함 디자인 구현 마감

기준일: 2026-09-04

상태: **화면·기능 구현 및 로컬 통합 검증 완료**

## 결과

업무 앱을 여러 앱의 기능을 복제하는 화면에서 **내 처리 책임을 발견하고, 원본이 허용하는 행동과 확인된 결과까지 이어 주는 실행 허브**로 정리했다. 제품 진입점은 `/work/queue` 하나이며 중복된 업무 홈과 폐기된 하위 메뉴를 제거했다. 개인 할 일·오늘 계획·Calendar·AI·원천 상태·일괄 결과는 같은 통합업무함의 상세, 패널, 대화상자와 handoff로 제공한다.

Stitch 01–12의 18개 화면은 목록–상세 관계, 정보 밀도, mobile 여정, form/dialog 구성을 참고했다. 구현은 DWP design token·공통 component·실제 API 계약으로 다시 구성했다. 시안의 영구 6개 하위 메뉴, 임의 KPI·확률, 실시간 동기화, 법적 효력, 감사 로그 완료, AI 자동 반영처럼 확인되지 않은 기능 표현은 채택하지 않았다.

## 완료한 제품 범위

### IA와 route

- `/work/queue`를 canonical Work 경로와 단일 메뉴로 지정했다.
- `/work`, `/work/home` 및 폐기된 Work child route는 지원하는 query를 보존해 canonical 경로로 redirect한다.
- 중복 업무 홈 구현과 dispatcher를 제거하고 Flow는 compact 업무 발견과 큐 진입 역할만 유지한다.

### 통합 조회와 상세

- Workspace, Approval, Service, personal task 등 현재 권한이 허용한 원천을 병렬로 읽고 정확한 원본+의무 identity로 통합한다.
- lifecycle, urgency, due date, 책임 주체, 원천 상태, 오늘 계획 여부를 분리해 표시한다.
- 검색·필터·정렬·선택·상세를 제공하고 URL로 선택 대상을 복원한다.
- bounded source, 부분 실패, 전체 불가, 권한 없음, stale transport failure, 실제 0건을 구분한다.
- 403 refresh 뒤 해당 원천의 이전 항목을 제거한다. 일시적인 transport 불가에서만 이전 항목을 degraded 상태로 보존한다.

### 개인 할 일과 오늘 계획

- 개인 할 일 create/edit, 시작·대기·완료·재개·보관, source link/unlink, paginated timeline을 구현했다.
- version conflict 뒤 최신 task를 다시 읽으면서 사용자의 편집 초안을 보존한다.
- 응답이 불확실한 동일 명령은 같은 UUID와 version으로 복구하고, 성공 뒤 새 명령에는 새 UUID를 발급한다.
- 날짜별 오늘 계획 추가·제거·순서, 최대 100개, version conflict 복구와 날짜 간 요청 race 방지를 구현했다.
- backend가 반환한 opaque `DAY_PLAN_SELECTION`은 plan receipt의 source mapping으로만 해석한다. 접근 불가 항목을 손실 없이 유지·이동·제거하고 token은 사용자에게 노출하지 않는다.

### Calendar, 원천 행동, AI와 일괄 결과

- 개인 비공개 focus event의 timezone·시작·종료를 검토하고 event 생성과 Work link 저장을 분리했다.
- Work UPDATE와 Calendar VIEW 권한을 함께 확인한다. event 생성 뒤 link가 대기 중이면 receipt를 dialog 재개 뒤에도 보존해 link 단계만 다시 시도한다.
- 계약 상한 안의 Calendar 조회, 연결 목록, event 상태, Calendar 이동, 확인 후 link 해제를 제공한다. link 해제는 event 취소가 아니다.
- source-owned approval action은 현재 detail·권한·version을 재검증하고, Access Review와 Service는 기존 소유 앱 흐름으로 이어 준다.
- DWAI·ON에는 선택한 한 건의 허용된 최소 맥락과 사용자가 확인한 질문만 전달한다.
- 지원되는 Workspace batch만 atomic preview 후 실행한다. 전체 요청이 확인되면 항목별 confirmed receipt를 표시하고, 응답이 불명확하면 어느 항목도 임의 성공·실패로 확정하지 않는다. filter 변경 시 선택을 비운다.

### 반응형과 접근성

- desktop list/detail과 mobile full-detail/back-to-queue 흐름을 구현했다.
- 390px·320px reflow, 1280px 기준 200% 확대, 긴 한국어·영어 문구, light/dark, forced-colors, reduced motion을 고려했다.
- dialog focus, 주 행동의 keyboard 접근, 가시적 focus, loading/error/result announcement와 touch target을 적용했다.
- 자동 axe와 viewport 검증은 실제 보조기기·모든 OS 가상 키보드 검증을 대신하지 않는다.

## Stitch 18개 프레임 수용 결과

| 제출 영역 | 확보 결과                                                              | 수용 판정                                                     |
| --------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| 전체      | 18개 `code.html`, 18개 `screen.png`, manifest, checksum, contact sheet | 구성 참고 가능, 기능·운영 계약 증거는 아님                    |
| desktop   | 모든 제목은 1440px이지만 실제 ReactFlow wrapper는 1280px               | 실제 wrapper를 대조 기준으로 기록하고 제품은 유동 grid로 구현 |
| M2        | 제목·본문은 320px이지만 실제 wrapper·HTML·PNG는 390px                  | 320px completeness 불충족, 제품 코드와 E2E로 별도 보완        |
| mobile    | 01–05와 12 M1/M2만 있고 06–11의 개별 mobile 없음                       | 누락 화면을 제품 반응형 구현으로 보완                         |
| 테마·확대 | dark, 강제 고대비, 200% 제출물 없음                                    | DWP token과 자동 상태 검증으로 보완                           |
| overflow  | 04·05 desktop HTML이 1280px 재렌더에서 가로 overflow                   | 해당 고정 폭을 복제하지 않고 reflow 구현                      |

Stitch의 #2563EB, Geist, Material Symbols는 제품 정본이 아니다. DWP color/type/icon token, 한글 시스템 글꼴, Lucide와 기존 셸을 사용했다. 상세 대조는 [Stitch와 구현 비교](design-reference/implementation-comparison.md)에 기록한다.

## 기능·상태 수용 확인

| 위험                        | 구현한 대응                                                                  | 확인 지점                            |
| --------------------------- | ---------------------------------------------------------------------------- | ------------------------------------ |
| 부분 실패를 빈 상태로 오인  | source별 state와 completeness notice, 일부 결과 유지                         | loader·partial notice·foundation E2E |
| 권한 회수 뒤 민감 내용 잔류 | 401/403을 `FORBIDDEN`으로 분류하고 이전 source item purge                    | refresh policy 단위 테스트           |
| 개인 edit 충돌로 입력 손실  | 409 최신 task 재조회, dialog 유지, draft 보존                                | page mutation과 task dialog          |
| 계획 opaque token 오해      | current plan source receipt로만 실제 reference 해석                          | model·controller·Today Plan panel    |
| 계획 날짜 race·409 손실     | request revision guard, 409 뒤 최신 계획 채택, 거절된 이전 draft 재전송 차단 | controller 단위 테스트               |
| Calendar orphan link        | event/link 단계를 분리하고 pending receipt를 reopen까지 보존                 | scheduling·dialog 단위 테스트        |
| Calendar 과도 조회          | backend 최대 기간 안의 lookup range                                          | scheduling helper 단위 테스트        |
| 숨은 batch 항목 실행        | filter 변경 시 selection clear, reviewed eligible snapshot만 실행            | page state·batch preview             |
| timeline 일부만 표시        | `hasMore`가 끝날 때까지 page를 읽고 진척 없음 차단                           | personal detail loader 단위 테스트   |
| 원천 행동 오소유            | owner-specific action 또는 원본 handoff                                      | action controller·source detail      |

## 검증 현황

아래 수치는 최종 전문가 리뷰에서 나온 권한 회수, Today Plan 경쟁, Calendar receipt, timeline, source 표시 사전 보완을 모두 적용한 뒤 같은 작업 트리에서 다시 실행한 결과다.

| 검증                     | 최종 결과                                                   | 해석                                                                                                          |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Work frontend 단위       | 17개 파일·83개 통과, 실패 0                                 | loader·refresh·detail·plan·Calendar·batch와 UI 상태 검증                                                      |
| Work IA 연계 단위        | route·shell·Flow·AI 연계 4개 파일·22개 통과, 실패 0         | canonical route, legacy 수렴, 제품 메뉴와 compact contribution 검증                                           |
| Work backend 대상        | 14개 suite·102개 통과, 실패·skip 0                          | 개인 업무·계획·Calendar·Workspace 정책 검증                                                                   |
| Desktop·Mobile Work E2E  | Chromium 22개·mobile 18개 통과, mobile 중복 4개 의도적 skip | 원천 handoff, 권한, 충돌·불확실 응답 복구, 1440/1280/390/320, dark, 강제 색상, 200%, axe serious·critical 0건 |
| Product artifact runtime | 6개 통과, 실패 0                                            | 빌드된 route·asset와 `/work/home` → `/work/queue` 수렴 검증                                                   |
| Production compile       | Vite 4,930개 모듈 빌드 통과                                 | Work 청크를 포함한 배포 산출물 생성 확인                                                                      |
| 파일 크기 gate           | production 1,627개 파일 통과                                | 신규 소스 1,000줄 한도 준수                                                                                   |
| 정적 gate                | 전체 typecheck·Work scoped ESLint 통과                      | 전체 architecture/i18n/design-system gate의 잔여는 Work 외 DWAION 미연결 작업과 기준선 하향 미반영            |
| 초기 bundle 예산         | raw 1,184.6/1,074.2 KiB, gzip 336.5/317.4 KiB               | Work route는 초기 그래프에 포함되지 않으며, 공유 트리의 별도 공통 변경으로 저장소 전체 예산은 미통과          |

저장소 전체 `architecture:check`는 권한 snapshot, 내부 closure, fixture, 앱 구조, route composition, feature/API 경계와 순환 검사를 통과한 뒤 Work 외 DWAION의 미연결 신규 모듈 17개에서 중단됐다. 전체 i18n과 표시 사전 검사의 잔여 3건도 DWAION artifact/routine에만 있으며 Work 한·영 사전은 1,941개 key가 일치한다. design-system 검사는 Work 위반 없이 제거된 기존 예외 102건의 기준선 하향 갱신만 요구한다.

Vite manifest에서 Work 화면은 94.6 KiB raw·약 25.6 KiB gzip의 dynamic entry이고 한·영 Work 번역도 각각 별도 dynamic chunk다. Work 변경을 제거한 임시 비교 빌드에서는 초기 번들이 오히려 raw 115 B·gzip 110 B 커졌다. 현재 초과분은 공용 `initial-vendor`와 두 `application-shell`에 귀속되므로 Work를 더 분할하거나 예산을 올리지 않고 별도 공통 최적화 대상으로 남긴다.

고정 fixture와 로컬 build는 실제 고객 데이터·Gateway·원천 앱·운영 배포를 증명하지 않는다. 외부 release evidence 37건은 별도 운영 gate에서 `BLOCKED`다.

## 명시적 미지원과 NO-GO

- Meeting owner-source receiver는 내부 resolve/read만 구현됐다. CREATE는 `AUTHORITY_UNVERIFIED`, REASSIGN은 `TARGET_ELIGIBILITY_UNVERIFIED`로 fail-closed이며 현재 **NO-GO**다.
- Mail·Messaging 원문에서 Work 개인 할 일을 생성하는 capture 진입은 구현 범위에 없다. 개인 task가 허용된 source reference를 보존하는 기능과 혼동하지 않는다.
- 모든 결재·서비스·권한 원천에 공통으로 적용되는 직접 승인·반려·보완·완료는 제공하지 않는다. 현재 owner 계약과 authorization으로 검증된 행동만 노출한다.
- 외부 운영 배포, 고객별 원천 연결, 실제 알림 전송, 법적 효력, 감사 시스템 동기화, 실제 보조기기 수용은 별도 증거가 필요하다.

## 근거 문서

- [01–12 구현 확인표](design-ai/implementation-coverage.md)
- [Stitch 원본·치수·completeness](design-reference/README.md)
- [Stitch와 제품 구현 비교](design-reference/implementation-comparison.md)
- [Work Hub 코드 경계](../../../apps/dwp/src/features/work-hub/README.md)
- [기능 구현 보고서](implementation-report.md)
- [Meeting 배정 계약과 NO-GO](meeting-assignment/README.md)

이 문서의 `화면·기능 구현 및 로컬 통합 검증 완료`는 외부 운영 배포 승인이 아니다. 실제 고객 원천·Gateway·보조기기·운영 배포의 별도 증거와 저장소 전체 공통 gate 정상화가 release 전에 필요하다.
