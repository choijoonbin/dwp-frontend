# Work Stitch 구현 독립 QA · 2026-09-07

검증 대상: `/Users/a10697/Work/DWP/dwp-frontend/e2e/work-stitch-design-sync.spec.ts`.

재개 후 최신 코드 검증 결과: **10개 테스트 모두 통과, 56.2초**.

실행 환경: `http://127.0.0.1:4211`, Vite `--mode test`, Chromium. 동작 데이터는 명시적인 가상 API 응답이며 실테넌트/실제 AI 운영 연결에 대한 검증은 아니다. 실제 앱 컴포넌트와 요청 직렬화·응답 검증·권한·원천 변경 경계를 사용한다.

## 확인한 흐름

| 범위         | 확인 결과                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 6개 메뉴     | 통합업무함/내 조치 대기/오늘 계획/진행 중/응답 대기/완료된 업무의 독립 경로와 제목 유지. 모바일 더보기에서 마지막 3개 진입 가능     |
| 01 목록      | 1440/1280/390/320/720 CSS px에서 업무 노출, 상세 선택, 가로 넘침 없음                                                               |
| 07 오늘 계획 | 목록과 별개 화면. 선택한 개인 할 일과 결재 업무 표시. 실행 상태와 별도 계획 참조 유지                                               |
| 08 수행 시간 | 선택 업무를 포함한 모달, 편집 가능한 개인 Calendar 선택, 생성 버튼 활성. 모달을 여는 것만으로 Calendar POST 발생하지 않음           |
| 09 원천 상태 | 전체 원천 조회 상태와 재조회 버튼. 모바일 전체 화면 모달과 하단 닫기/재조회 조작 가능                                               |
| 11 업무 AI   | 선택 서비스 상세 유지, 기존 Ask SSE 응답 검증 통과, 출처 표시. 적용 클릭 전 폼 미변경. 클릭 후 message만 반영되고 원천 mutation 0건 |
| 10 Flow 기여 | 개인 할 일 및 오늘 계획 카드 표시. 할 일 클릭→해당 Work 상세, 브라우저 뒤로→오늘 계획 클릭→계획 화면의 동일 업무 확인               |
| 확대         | 1440 physical/720 CSS px/DPR 2 전체 흐름 + 실제 CSS zoom 2/1280px 상세 제목·시작 버튼·모바일 메뉴 Drawer 확인                       |
| 접근성       | 다크 및 강제 고대비, reduced-motion, 키보드로 더보기 열기/Escape 닫기/트리거 포커스 복귀. Work main/nav axe serious·critical 0건    |

## 최종 시각 검토

- 01 데스크톱: 사이드바 6개 메뉴, 목록/상세 2열, 원천 식별자/제목/상태 및 기한/실행 조작 열이 정렬된다. 1440×1000에서 5개 업무가 첫 화면에 모두 노출된다. 기본 행 높이는 약 78px로 축소되었다.
- 01 모바일: 필터·정렬은 접혀 있으며 390×844에서 2개 행 전체와 3번째 행 대부분이 보인다. 320px에서도 첫 업무가 보인다. 5개 하단 탭은 카드에 고정 겹침을 만들지 않도록 본문 여백을 갖는다.
- 11: 소스 상태 전용 라벨, 실제 답변용 입력 필드, 출처/적용/복사 조작이 구현되었다. 반복 답변을 없애 밀도를 낮췄고 토큰 기반 파란 보조 표면 및 둥근 모서리를 적용했다. 모바일 패널 시작점이 고정 헤더 아래에 오도록 scroll margin을 적용했다.
- 기존 200% 확대 실패는 CSS zoom 후에도 media query가 1280px로 남아 데스크톱 너비를 고정하던 원인이었다. 셸의 실제 CSS 레이아웃 폭을 ResizeObserver로 읽고 메뉴/본문/헤더 offset 및 WorkPage 1열 전환에 반영하여 해결했다.

## 남아 있는 시안과의 차이

- 10 Flow는 전사 홈의 기존 공통 구조를 유지한다. 원본 10의 Work 사이드바와 전용 작업 대시보드를 통째로 복제하지 않았다. 이번 범위는 개인 업무/계획 기여와 canonical 상세 연결이며, 동시 진행 중인 Activity/Flow 홈의 전체 디자인을 변경하지 말라는 root 지시에 따른 경계다.
- 01에는 원본의 열 이름 헤더 대신 `확인된 업무 N건`과 업무 선택 조작이 있다. 색상, 글꼴, 셸 브랜딩은 DWP 디자인 시스템을 따른다. 원본 HTML의 픽셀 단위 동일성을 주장할 수 없다.
- 11의 왼쪽 서비스 상세는 실제 원천 필드 및 조회/권한 설명을 포함하여 시안보다 길다. 서비스 폼은 스크롤 후 표시되지만 AI 적용 전후에도 유지된다. 하드코딩된 예상시간·완료확률·가짜 출처·사용량은 이식하지 않았다.
- 이 독립 spec은 01/07/08/09/10/11과 공통 메뉴/접근성을 담당한다. 02/03/04/05/06/12의 전체 원천 결정·작성 테스트는 다른 담당 검증과 합쳐야 18개 참조 화면의 전체 커버리지가 된다.

## 증거

최종 산출물 루트: `/tmp/work-stitch-resumed-final`.

- [01 desktop 1440](/tmp/work-stitch-resumed-final/work-stitch-design-sync-de-e44b0--source-status-11-inline-AI-chromium/01-unified-queue.png)
- [01 mobile 390](/tmp/work-stitch-resumed-final/work-stitch-design-sync-mo-a964c--source-status-11-inline-AI-chromium/01-unified-queue.png)
- [01 mobile 320](/tmp/work-stitch-resumed-final/work-stitch-design-sync-mo-1649f--source-status-11-inline-AI-chromium/01-unified-queue.png)
- [10 Flow](/tmp/work-stitch-resumed-final/work-stitch-design-sync-10-bb1bf-with-canonical-return-links-chromium/10-flow-work-contribution.png)
- [11 desktop](/tmp/work-stitch-resumed-final/work-stitch-design-sync-de-e44b0--source-status-11-inline-AI-chromium/11-selected-work-ai-assist.png)
- [11 mobile 320](/tmp/work-stitch-resumed-final/work-stitch-design-sync-mo-1649f--source-status-11-inline-AI-chromium/11-selected-work-ai-assist.png)
- [CSS zoom 200%](/tmp/work-stitch-resumed-final/work-stitch-design-sync-CS-e6c23-ource-and-drawer-navigation-chromium/05-personal-task-css-zoom-200.png)

각 화면에는 `-full.png` 전체 페이지 캡처도 있으며, Playwright 첨부에 layout JSON 및 접근성 위반 결과가 포함되어 있다.

## 관련 범위 검사

- navigation/model/AI/mobile unit 4파일 17개 통과; AI panel 수정 후 2개 재검증 통과.
- 소유 파일 범위 ESLint 통과.
- DS 검사에서 AI/Layout 소유 파일 신규 부채 없음(`var(--dwp-shape-borderRadius)`, `caption.fontSize` 사용).
- 전체 typecheck에서는 동시 편집 중인 Meetings 및 root AccessReview 오류가 관측되었으며 소유 파일 오류는 없었다. 이 내용은 전체 저장소 최종 타입 검증 결과를 대체하지 않는다.

추가 독립 리뷰에서 발견한 체크리스트의 dirty draft/version 불일치 위험은 개인 상세 담당자에게 전달했다. 해당 담당자의 수정 및 테스트 결과를 최종 기능 검토에 포함해야 한다.
