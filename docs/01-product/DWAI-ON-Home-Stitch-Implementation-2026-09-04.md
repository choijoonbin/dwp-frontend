# DWAI·ON 홈 Stitch 디자인 적용

## 범위

- 기준 시안: [DWAI·ON Home: Dynamic Next-Gen Enterprise AI Intelligence Portal](https://stitch.withgoogle.com/projects/13391261371843159731).
- 대상: `/dwaion/home`. 공통 헤더, 사이드바, Agent API 및 접근 정책은 교체하지 않는다.
- 실제 서비스의 기존 API를 그대로 사용한다. 시안의 예시 숫자, 업무, 대화, 에이전트를 제품 코드에 넣지 않는다.

## 반영 사항

| 영역          | 적용                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| 인사 및 신뢰  | 개인화 제목, 기존 DWAI·ON 캐릭터, 현재 권한/원본 정책 안내             |
| 질문          | 전체 너비 컴포저, 명확한 포커스, 음성 입력, 3개 빠른 질문              |
| 업무 신호     | 임박 업무, 대화, AI 제안, 에이전트, 검토형 작업의 5개 이동 가능한 타일 |
| 상태 표시     | 소스별 조회 상태, 확인 시각, 전체/개별 재시도                          |
| 우선 업무     | 미완료 최대 4건, 공통 우선순위/마감 정렬, 출처, 마감 경과, 업무 검토   |
| 최근 대화     | 최근 메시지 시각으로 정렬한 최대 3건, 해당 대화 이동                   |
| 전문 에이전트 | 게시 목록과 앱 권한에 따른 에이전트, 전용 새 대화 진입                 |
| 인터랙션      | 타일 호버 이동, 버튼 피드백, 질문 포커스, 실제 조회 중 새로고침 모션   |
| 접근성        | 키보드 포커스, 한국어/영어, 모바일 재배치, 동작 줄이기, 고대비/다크    |

## 의도적으로 조정한 시안

- `Live v2.5`와 항상 연결된 듯한 펄스는 넣지 않았다. 실제 엔진 연결 상태/버전 API가 없는 상태에서 운영 사실로 표현하지 않는다.
- 임의의 실시간 자동 분석 문장, AI 자동 재정렬 완료 배지, 가짜 진행률은 제거했다. 현재 구현은 공통 업무 우선순위 정책에 따른 정렬이다.
- 장식용 오로라/반복 글로우 대신 집중 가능한 입력 경계와 실제 상태 변경에 반응하는 모션을 사용한다.
- 빠른 질문은 기존처럼 즉시 안전한 대화 진입을 요청한다. 입력창 자동완성으로 동작을 바꾸거나 질문을 URL에 담지 않는다.
- 업무 검토는 원본 시스템 URL을 무조건 열지 않는다. 공통 `workspaceWorkItemRoute`를 사용해 `/work/queue?item=` 및 ID 거버넌스의 opaque owner reference를 보존한다.

## 안전성과 데이터 계약

- 질문은 서버 발급 one-time launch ticket으로 전달한다. URL과 history state에 질문 원문을 추가하지 않는다.
- 실패한 빠른 질문도 컴포저에 보존한다. 중복 클릭은 단일 진행 요청으로 제한한다.
- STT는 변환한 문장을 사용자가 확인한 뒤 전송한다. 자동 실행이나 자동 전송을 추가하지 않는다.
- 조회 실패와 로딩을 정상 `0`건으로 나타내지 않는다. 실패한 소스의 캐시 내용은 홈에 재노출하지 않는다.
- 확인 시각은 성공한 조회들의 가장 오래된 수신 시각이다. 원본 데이터 생성 시각이나 AI 엔진 실시간 연결 시각이라고 주장하지 않는다.
- 에이전트 실행, 권한 확대, 결재 자동 승인 등 백엔드 행위는 이 디자인 변경에 포함하지 않는다.

## 코드 정리

- 기존 `dwaion-home.tsx`의 인라인 `HomeMetric`/`HomeSection` 및 대형 렌더 블록을 제거했다.
- 홈을 질문, 신호, 업무/대화/에이전트 콘텐츠, 상태 표면, 순수 모델로 분리했다.
- 공유 `DwaionWorkspaceComposer`에는 홈 presentation만 추가했다. 기존 새 대화/대화 상세의 동작은 유지한다.
- 사용하지 않는 `dwaionHome.partialLoadError` 번역 키를 제거했다.
- 작업 중 공통 업무 정책이 갱신되어 중복 정렬/경로 구현을 제거하고 최신 공통 정책을 사용한다.
- 다른 작업의 `dwaion-workspace.tsx` 변경 및 shared work policy는 보존했다.

## 검증 증거

- Node `24.19.0`.
- DWAI 단위 테스트: 6 files / 18 tests PASS.
- `e2e/dwaion-home-design.spec.ts` + `e2e/dwaion-agentic-work-os.spec.ts`: Chromium/mobile 합계 38 PASS.
- 1440, 1280, 768, 390, 320px, 640px reflow + 200% 루트 글자 크기, 다크, 강제 고대비 스크린샷과 가로 overflow 검사를 통과했다.
- 홈 axe 검사에서 critical/serious 0건.
- 403 재조회/복구, 실패한 질문 보존 및 ticket 재시도, 빈 데이터, STT/TTS 명시 제어, 기존 grounded fallback/실행 이력/제안함 회귀를 통과했다.
- 홈 전용 ESLint, Prettier, locale validation, diff-check PASS.
- 독립 production Vite build PASS. 홈은 manifest에서 `isDynamicEntry: true`로 유지된다.
- 시각/회귀 검증은 통제된 API fixture를 사용하는 E2E이며 운영 데이터 증거와 구분한다.

## 통합 시 확인할 잔여

2026-09-04 검증 시점의 공유 트리는 다른 앱 작업이 동시에 진행 중이다.

- 전체 source-size: 알림 `notification-center.tsx` 1021 > 1000. 담당 작업에 전달, DWAI 파일 초과 없음.
- 전체 unused exports: 공통 홈/업무 신규 모듈의 10건. DWAI 파일 위반 없음, 담당 작업에 전달.
- 전체 타입 검사는 첫 실행 PASS. 이후 Activity의 `StatePanelSize` 2건은 담당이 수정했다. 마지막 재실행에서는 병행 개발 중인 `work-hub-actions.ts:80`의 `idempotencyKey` narrowing과 `activity-page-merge.ts:87`의 `resumeCursor` 계약 2건으로 실패했으며 각 담당에게 전달했다. DWAI 타입 오류는 없다.
- 공통 초기 번들 budget (마지막 독립 build): raw 1167.5 / 1074.2 KiB, gzip 331.6 / 317.4 KiB. 홈 async 분리는 유지되며 예산을 상향하지 않았다.
- 실제 Chrome `localhost:4200/dwaion/home`은 공통 권한 서비스 판정 실패 화면을 표시했다. 재시도해도 같았으며 정책을 우회하지 않았다. 실계정/API 연결 최종 확인은 권한 서비스 복구 후 필요하다.
- 위 공유 Gate의 실패를 DWAI 홈 자체 테스트 PASS나 전체 출시 완료로 바꾸어 보고하지 않는다.
