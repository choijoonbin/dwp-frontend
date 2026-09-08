# U04/U14 모바일 정보 위계 재검토 — 2026-09-07

## 검토 범위와 판정 원칙

`output/meeting-design-review-30-2026-09-07/evidence.json`의 U01/U07/U08/U09/U13/U14/U15 데스크톱·모바일 원본/구현 PNG 28장을 직접 대조했다. 테스트 통과를 디자인 승인으로 해석하지 않았다. 그 결과 U01 제목 크기, U07 사용자별 탐색 축, U08 후보별 업무 연결 및 모바일 순서, U14 제어 그룹의 밀도를 별도 개선 대상으로 전달했다. 이 문서는 추가 승인된 **U04 사전 준비 / U14 정책**만 다룬다.

계정 이름·회의 수·지표 값은 fixture 차이다. 미연결 provider의 `준비 완료`나 미측정 지표를 원본처럼 위조하지 않는다. 공통 셸의 너비·헤더·관리자 모바일 내비게이션은 이 변경 범위가 아니다.

## 원인과 보정

### U04 사전 준비

원본 모바일은 회의 맥락 → 입장 → 브리핑 → 의제 → 간결한 파일행 → 가로 참석자 → 보안 요약이다. 이전 구현은 동일한 입장/출처 경계 문구를 여러 카드 본문에 반복하고, 파일마다 제공자·버전·보존·권한 액션을 항상 펼쳤으며, 참석자를 세로 목록으로 유지했다. 기능 경계를 화면 구조와 분리하지 않은 것이 과도한 스크롤의 원인이었다.

- 입장 CTA를 모바일에서 링크 복사보다 먼저 배치했다.
- 입장/콘텐츠 처리, 브리핑 근거, 사전 대화·장치 안내를 네이티브 `details`로 보존했다. 데스크톱 안내는 계속 펼친다.
- 자료는 파일 형식·제목·등급·미검증/티켓 상태가 보이는 행으로 구성한다. 펼치면 기존 제공자·원본 버전·보존·접근 권한 확인·제거 액션이 나온다. 행을 펼쳐도 파일을 자동으로 열거나 권한 티켓을 자동 발급하지 않는다.
- 참석자 이름과 응답 상태를 가로 아바타 목록에 표시한다. 승인된 현재 응답은 접어 두고, 미응답·재확인·409 충돌은 즉시 펼친다. roster는 키보드 방향키로 스크롤할 수 있다.
- 장치 상세는 펼침으로 보존하되 실제 장치 점검 버튼은 계속 노출한다. 이 화면에서 카메라/마이크를 자동으로 켜지 않는다.

동일 fixture/390px/3배 캡처의 문서 높이: 11,454px → 8,562px, CSS 기준 3,818px → 2,854px(약 25% 감소). 높이 자체가 승인 기준은 아니며 자료·개인 준비 체크리스트·미지원 안내를 삭제하지 않았다.

### U14 정책

이전 모바일은 7개 설정 그룹과 모든 미지원 제어의 설명·공통 연결 경계를 모두 펼쳤다. 원본의 핵심 접근/녹화/AI/보존 제어보다 반복 안내가 우세했다.

- 핵심 4개 그룹은 펼쳐 두고 템플릿·회의 중 협업·수용 한도는 모바일에서 처음 접는다. 변경된 그룹과 검증 오류는 기존 `forceOpen` 경계로 드러난다.
- 미지원 제어는 제목·잠금·현재 값 미보고 상태를 유지하고 상세 설명을 펼치게 한다. 실제 값이나 활성 상태를 만들지 않았다.
- 공통 연결/권한 안내를 상단 한 곳에 모았다. 정책 영향·승인·감사 경계는 사라지지 않는다.
- 우측 정책 경계 보조 영역은 모바일에서 펼침으로 전환하고 데스크톱에서는 기존 별도 카드 배치를 유지한다.
- 저장 미리보기, 버전 충돌, 보존 제약, 녹화 공급자 차단 로직은 변경하지 않았다.

동일 fixture 모바일 문서 높이: 11,814px → 7,848px, CSS 기준 3,938px → 2,616px(약 34% 감소). 미지원 정책의 실제 제어 계약이 미완성인 사실은 디자인 정합으로 해결됐다고 주장하지 않는다.

## 검증 증거

Node 24 환경에서 아래 대상 검증을 실행했다. 초기 U04 가로 roster의 `scrollable-region-focusable` 위반을 발견해 포커스·이름·표시되는 focus ring을 추가한 뒤 재실행했다.

- 대상 unit: 5개 파일 59개 PASS. 신규 `meeting-mobile-disclosures.test.tsx` 5개는 안내의 DOM 보존, 모바일 접힘, 변경/충돌 시 펼침, 데스크톱 펼침, 미지원 AI 값 비활성 상태를 검증한다.
- E2E: `video-meeting-preparation-prejoin-design-review.spec.ts`의 U04 및 `video-meeting-policy-mobile-review.spec.ts`의 U14, Chromium/모바일 4개 PASS. 1440/390 및 320 가로 overflow·axe serious/critical 0, 키보드 roster 스크롤, 파일행 펼침 후 권한 확인 액션, 320 모든 안내 펼침을 포함한다.
- full non-incremental typecheck PASS, 대상 ESLint/Prettier PASS, source-size/i18n/diff-check PASS.
- Design-system 검사에서 신규 도입 위반은 없었다. 공유 트리의 제거된 grandfathered 항목 ratchet 요구는 중앙 소유자에게 인계했다. baseline은 수정하지 않았다.

최종 캡처 디렉터리: `/tmp/dwp-meeting-u04-u14-compact-final-r6`.

재실행 과정도 구분했다. r4에서 모바일 native 방향키 스크롤의 비결정성을 확인해 Arrow/Home/End를 명시적으로 처리했다. r5의 U14 desktop은 13:46:34 공유 `bootstrap-application.tsx` HMR reload와 axe 실행이 겹쳐 context가 사라졌고, 오류를 숨기거나 retry 성공으로 기록하지 않고 이후 같은 4개 테스트를 다시 실행했다.

## 이번 변경 파일

- `apps/dwp/src/features/meetings/meeting-preparation-disclosure.tsx` — 신규 반응형 안내 펼침
- `apps/dwp/src/features/meetings/meeting-preparation-sections.tsx` — 맥락/브리핑/명단/장치 위계
- `apps/dwp/src/features/meetings/meeting-preparation-materials.tsx` — 모바일 파일행/권한 액션 펼침
- `apps/dwp/src/features/meetings/meeting-admin-policy-layout.tsx` — 정책 그룹/연결 안내
- `apps/dwp/src/features/meetings/meeting-admin.tsx` — 추가 정책 그룹의 기본 접힘만 연결
- `apps/dwp/src/features/meetings/meeting-mobile-disclosures.test.tsx` — 신규 단위 회귀
- `e2e/video-meeting-preparation-prejoin-design-review.spec.ts` — U04 가로 명단/자료/안내 회귀
- `e2e/video-meeting-policy-mobile-review.spec.ts` — 신규 U14 desktop/mobile/320 회귀

4개 신규 번역 키는 중앙 소유자가 ko/en에 병합했다. 공유 셸/Gateway/API/backend/계약 생성물은 수정하지 않았으며 부분 커밋을 만들지 않았다.
