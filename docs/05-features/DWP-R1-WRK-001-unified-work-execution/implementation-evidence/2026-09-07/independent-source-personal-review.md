# Work 원천/개인 상세 독립 구현 및 검증 근거 · 2026-09-07

> **제품 격리 정정:** 이 기록의 Approvals·Services 인라인 상세/명령 구현은 독립 제품 asset 경계를 침범해 제거됐다. 현재 정본은 Work 소유 요약과 원본 앱 문서 handoff이며, Work에서 두 제품의 mutation을 전송하지 않는다. 개인 업무와 Access Review의 Work 소유 구현·증거는 계속 유효하다.

소유 화면은 02-D/M, 04-D/M, 05-D/M, 06-D 및 12-M2의 개인 입력 여정이다. 원본은 `docs/05-features/DWP-R1-WRK-001-unified-work-execution/design-reference/manifest.json`에 등록된 18개이며, 24개로 추정해 미확인 모바일 화면을 추가하지 않았다.

| 원본 프레임 | 반영한 화면·기능                                                                                                                                  | 확인한 증거/범위                                                                                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 02-D / 02-M | 결재 책임·원천 상태 요약과 Approvals 원본 진입                                                                                                    | `work-hub-source-owned-detail.tsx`; `OPEN_SOURCE` 문서 handoff. `e2e/work-source-decisions.spec.ts`가 Work발 결재 POST 0회와 canonical source URL 이동을 검증함.                                                                          |
| 04-D / 04-M | 서비스 요청 책임·원천 상태 요약과 Services 원본 진입                                                                                              | `work-hub-source-owned-detail.tsx`; `OPEN_SOURCE` 문서 handoff. `e2e/work-source-decisions.spec.ts`가 Work발 서비스 POST 0회와 canonical source URL 이동을 검증함.                                                                        |
| 05-D / 05-M | 개인 상태 4분할 선택·수정일·전폭 설명·복수 원천 참조·체크리스트 진행률/토글/추가/저장·이력·삭제 확인                                              | 새 개인 API의 checklist/sources/delete를 모두 연결. 제목 편집 양식에서 항목 이름·정렬·삭제 가능. 최신 task version 재조회 후 실행하며 task 선택 변경/해제 뒤 늦은 preflight는 취소. 1440/1280/390/320 캡처 및 실사용 명령 E2E 통과.       |
| 06-D        | 실제 생성/편집 FormDialog, 제목/설명, 우선순위 4분할, 날짜/시간, 체크리스트 편집, 접근 가능한 원천 검색/복수 연결, 오늘 계획 선택, 저장/입력 보존 | `work-task-dialog.tsx`와 checklist/source editor. 보이지 않는 원천은 임의 제거하지 않음. 명시적 제거 동의 전에는 전체 연결 교체를 막고, 다른 필드 저장은 원천 유지. 기존 singular 참조와 plural 참조를 동시에 전송하지 않음.              |
| 12-M2       | 모바일 개인 할 일 입력·체크리스트 Enter 추가·고정 제출 영역·작은 높이에서 스크롤/제출                                                             | 390px 및 320px, 높이 440px로 축소한 뷰포트에서 실행. 체크리스트 Enter가 전체 양식을 제출하지 않으며 저장 후 실제 생성 receipt 확인. 이는 OS 가상 키보드 실기기 검증을 대신하는 뷰포트 회복 테스트이고 실제 키보드 캡처라고 주장하지 않음. |

## 검증 결과

- `corepack yarn typecheck`: 전체 PASS (`/tmp/work-final-type.txt`).
- 소유 구현/테스트 파일 ESLint PASS (`/tmp/work-personal-eslint-delivery.txt`).
- 개인 업무 테스트와 `work-hub-source-owned-detail.test.tsx`는 최신 실행 결과를 정본으로 사용한다. 삭제된 인라인 원천 상세 테스트 수치는 더 이상 현재 증거가 아니다.
- `e2e/work-personal-design-actions.spec.ts`: 8/8 PASS (`/tmp/work-personal-delivery.txt`). 4개 화면폭 시각 검증 + 체크리스트 version4→복수 원천 version5→삭제 version6 여정 + 390/320 입력 회복 + VIEW-only 변경 차단.
- Feature boundary PASS. 결재 workflow/timeline 공통 helper는 `components`로 추출했고 Work→Approvals 구현 직접 import를 제거했다. source 권한 경계 또한 공통 surface facade를 사용한다.
- Source size budget PASS. 소유 파일 DS 신규 위반 없음. radius는 잘못된 문자열 경로 대신 `borderRadius: (theme) => \`${theme.shape.borderRadius}px\``로 실제 CSS 값이 계산되게 수정했다.

## 원본과 실제 화면의 차이 및 한계

- 원본이 정적으로 보여 주는 첨부 목록/파일 다운로드, ERP 잔액, 단말 보안 통과 배지 등의 실제 데이터 계약은 현재 원천 API에 없다. 해당 섹션을 지우거나 사실처럼 예시 데이터를 넣지 않고 원본에서 증빙 확인/제공 데이터 없음 상태를 유지한다.
- 결재 반려의 tenant별 최소 사유 길이는 현재 DTO에 노출되지 않는다. UI는 기본 8자, 보완 요청 4자를 안내·검증하고, 더 엄격한 원천 정책으로 400이 오면 입력을 보존한 채 검증 거절로 안내한다. 서버 검증을 우회하지 않는다.
- 원본 05의 연결 원천 타일 2개는 실제 source 배열이 있을 때 표시된다. 현재 시각 fixture의 sources가 빈 배열이므로 캡처에는 빈 상태가 나온다. 임의 ERP 연결을 채우지 않았다.
- 원본보다 실제 화면은 변경 이력, 원천 장애, 삭제 영향 안내가 데이터 상태에 따라 길어진다. 개인 본문을 전폭으로, 체크리스트 상세 행을 간결하게 정리해 불필요한 세로 길이를 줄였다. 동일 콘텐츠/동일 뷰포트의 픽셀 오차율 0%는 확인하지 않았으며 “100% 픽셀 동일”이라고 보고할 근거는 없다.
- 6개 Work 메뉴와 Work 소유 상세는 유지한다. Approvals·Services의 제품 고유 상세 조작은 각 소유 앱에 두고 Work는 검증된 원천 진입을 제공한다. 이는 화면 축소가 아니라 독립 배포·권한·asset 경계를 보존하는 책임 분리다.

## 증거 경로

- 최종 개인 캡처: `/tmp/work-personal-delivery/` 아래 `05-personal-detail-{1440,1280,390,320}.png`, `06-personal-edit-{1440,1280,390,320}.png`, `personal-capture-{390,320}-keyboard-reflow.png`.
- 번역 병합 입력: `/tmp/work-source-details-i18n.json`, `/tmp/work-personal-details-i18n.json` (root 소유 work.json에는 직접 편집하지 않음).

## 중단 후 재개 검증 · 11:52 KST

- 독립 검토에서 체크리스트 편집 중 refetch가 새 version을 전달하면 기존 초안을 새 CAS 버전으로 올려 쓰는 경합을 발견해 수정했다. 첫 편집 시 draftVersion을 고정하고 최신 version과 다르면 저장을 막는다. 최신 체크리스트를 비교해 사용하거나, 현재 초안으로 대체하기를 명시적으로 검토한 뒤에만 새 버전 저장이 가능하다. 검토 후 다른 version이 들어오면 다시 차단한다.
- `work-personal-checklist.test.tsx` 동시성 4건 포함 개인 단위 22/22 PASS (`/tmp/work-resumed-personal-unit.txt`). 타입 전체 및 소유 ESLint PASS (`/tmp/work-resumed-personal-typecheck2.txt`; 테스트 helper의 포괄 mock 타입을 명시적 onSave 함수 타입으로 수정한 최종 결과).
- `e2e/work-personal-design-actions.spec.ts` 최신 9/9 PASS (`/tmp/work-personal-resumed-final.txt`): 원천 최신 version5 preflight로 v4 저장 차단, 최신 항목 비교, 명시적 대체 검토, v5 실제 PUT까지 검증했다.
- 최종 05/06 캡처는 `/tmp/work-personal-resumed-final/`이며 06 모달은 viewport 캡처로 기록해 fullPage 합성 왜곡을 제외했다.
- 추가 번역 4키: checklist.conflict/latest/useLatest/replaceLatest. `/tmp/work-personal-details-i18n.json`에 포함, root가 locale 파일에 병합한 것을 확인했다.

- root 최종 서버 `http://localhost:4211`에서도 동시성 브라우저 여정 1/1 PASS (`/tmp/work-personal-concurrency-4211.txt`).

## 폐기된 인라인 원천 상세 실험

- 당시 결재·서비스 상세를 Work에서 직접 평가·실행하던 실험과 전용 boundary 테스트는 제품별 번들·권한 경계를 침범해 제거했다. 이 섹션의 과거 수치는 현재 릴리스 증거가 아니다.
- 현재 회귀는 Workspace 빌드의 foreign route-contract 0건, Approvals·Services canonical URL 문서 handoff, Work발 foreign POST 0회를 검증한다. Work 소유 Access Review는 기존 governed-context 실행 경계를 유지한다.
