# U01 처리 큐·게시 결과·템플릿 및 개인실 원본 재검토

## 범위와 원본

주 사용자는 현재 테넌트의 회의 참여자다. 질문은 “지금 확인할 회의 결과 또는 처리할 업무가 무엇인가?”이며, 주요 행동은 결과 검토·배정된 업무 열기·검증된 후보 검토·템플릿 또는 개인실 진입이다. 화면 유형은 홈 command center의 제한된 처리 큐 및 자원 진입 영역이다.

2026-09-07 사용자가 승인한 Stitch 원본의 `dwp_meetings_today_next_action_1440px_polished`와 `dwp_meetings_mobile_home_390px_polished`의 `screen.png` 및 `code.html`을 직접 대조했다. 이 문서의 범위는 홈 오른쪽 큐와 하단 결과·자원이며 공통 셸/헤더/포커스/타임라인은 루트 소유다.

## 누락 원인과 수정 설계

| 원본 요구                                      | 기존 차이                                            | 실제 보정                                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 하나의 처리 큐 아래 독립된 검토·업무·후보 카드 | 두 개의 별도 섹션 제목/소개/큰 빈 상태와 구분선 목록 | `embedded`로 하위 제목/소개 숨김, 작고 독립적인 white/rounded 카드, 비어 있으면 짧은 상태 문구                 |
| 게시 결과 제목/날짜, 인용, 게시·보존 푸터      | 단순 요약 텍스트, 별도 범위 안내로 높이 증가         | 상단 제목/날짜, soft inset 인용과 왼쪽 강조선, 검증된 게시 상태·보존기한·정확한 보고서 경로                    |
| 세 가지 템플릿별 아이콘/톤                     | 동일한 아이콘, 평면 행                               | 정본 category 기반 Users/Gavel/Message 아이콘, 3열 tonal 카드, 실제 scope/template ID로 인스펙터 진입          |
| 실제 개인실 이름과 보안 링크 복사              | 개인실 및 설정 이동 버튼만                           | 소유자 API의 방 이름, 복사 직전 fresh GET 및 room/version/revision/alias 일치 검사, 같은 origin 초대 URL 복사  |
| 홈 업무 카드가 해당 업무로 연결                | 모든 카드가 기본 업무 목록으로 이동                  | opaque `assignment` URL을 현재 authorized list 멤버일 때만 상세 선택으로 소비                                  |
| 후보 카드가 검토 흐름으로 연결                 | 홈 후보 영역 없음                                    | 최신 published/participants/current version/retention을 통과한 후보만 별도 projection, CANDIDATES 탭 실제 진입 |

모바일에서 공통 SectionHeader의 메타 영역이 별도 행으로 내려가 불필요하게 높아지는 부분을 한 줄의 제목/보조 행동으로 교체했다. 템플릿은 모바일 90px/데스크톱 100px 최소 높이, 설정은 보조 아이콘으로 유지했다. 손가락·키보드 접근성을 위해 CTA는 최소 44px을 보존한다.

## 권한 및 기능 경계

- 결과는 tenant/user/identity-plane와 회의 ID 목록에 결속한다. 조회 중 재검증 상태에는 이전 본문을 숨기고, 취소 신호와 generation fence로 늦은 성공의 복귀를 막는다.
- 홈에는 비공개 DRAFT 원문, 전사, 인용 근거 원문이나 전체 분석 payload를 저장·복사하지 않는다. 검토 큐에는 제목과 정확한 보고서 참조만 보인다.
- 게시 후보는 기존 후보 검증 함수를 재사용하며, 잘못된 보존 날짜와 만료 날짜도 숨긴다. full analysis 대신 현재 승인된 후보 제목/출처 ID/버전/보존 필드만 메모리 query에 projection한다.
- 개인실을 홈에서 새로 만들거나 invitation revision을 변경하지 않는다. 권한/테넌트 변경과 비활성화는 진행 중 복사를 abort하며 늦은 응답은 clipboard에 쓰지 못한다. 링크가 회전됐으면 사용자가 확인한 뒤 다시 복사해야 한다.
- `assignment`는 단일 UUID만 허용한다. 중복 키, 원문 문자열, 현재 목록 밖 UUID는 detail read 권한이 아니며 임의 GET을 하지 않는다.
- 후보의 자동 담당자 배정/Work 생성은 현행 current-authority gate가 제공되지 않아 닫혀 있다. 홈은 생성이 가능한 것처럼 표기하지 않고 검토로 연결한다.
- 녹화/전사 준비 상태, 검토 마감기한, 참가자 승인 수, 가상 개인실 링크 등 API가 제공하지 않은 값을 디자인을 맞추기 위해 생성하지 않는다.

## 검증 기록

- 8개 소유 단위 테스트 suite: 89 PASS. 홈 결과 StrictMode 재검증/403 은닉, 개인실 fresh 복사/회전/버전/403/identity 및 enabled 변경 abort 10개, 후보 source/version/retention/abort 10개 포함.
- 최신 비증분 전체 TypeScript 검사 PASS, 소유 ESLint PASS. 글로벌 source-size 1742개 파일 PASS.
- Chromium 1440 및 mobile 390에서 자원 실제 이동·개인실 링크 회전 후 복사·홈 업무 상세 선택·게시 후보 검토 연결 8 PASS. 두 화면의 홈 접근성 axe 및 overflow 검사 포함.
- 기존 canonical 시각 명세의 HOME 5개도 baseline 비교/자동 갱신 없이 runtime/a11y/키보드/터치/overflow를 통과했다: 1280 English, 390 Korean, 768 English 200% text, 390 Korean dark, 320 English forced-colors. 초기 두 실패는 예전 CTA 이름과 신규 read 미연결 fixture였으며 루트가 실제 계약으로 보정한 뒤 5 PASS로 재회수했다.
- 위 여정과 시각 명세를 최종 동일 트리에서 합쳐 13 PASS, 기존 Chromium 전용 명세의 mobile 중복 5개는 명시적 project skip이다. `/tmp/meeting-home-owner-0907-closed`에 최종 캡처를 남겼고 데스크톱/모바일을 다시 직접 확인했다. 최종 source 개선에는 카테고리별 tonal icon 및 responsive 구분선 색 정합도 포함한다.
- 캡처와 실행 출력: `/tmp/meeting-home-triage-0907-final`. 별도 최신 하단 인용 및 compact header 대조 2 PASS 캡처는 `/tmp/meeting-home-final-look-0907`. 원본 PNG와 직접 대조했으며 golden 자동 수용이나 기준 상향을 하지 않았다.
- 공통 design-system ratchet 및 다른 소유자의 위반은 루트에서 별도로 마감한다. 본 작업은 전역 계약/셸/백엔드/locale 정본을 덮어쓰지 않았다.

이 범위의 기능·정적 검증 PASS는 모든 20개 화면의 최종 디자인 승인이나 외부 LiveKit/녹화/STT/LLM 운영 승인을 뜻하지 않는다. 실제 사용자 데이터로 보이는 내용 및 운영 gate는 통합 검증에서 별도 확인해야 한다.

## 통합 인계 파일

`apps/dwp/src/features/meetings/` 아래 변경 9파일:

- `meeting-home-results.tsx`
- `meeting-home-results-model.ts`
- `meeting-home-results-model.test.ts`
- `meeting-home-results-runtime.test.ts`
- `meeting-home-resources.tsx`
- `meeting-home-resources.runtime.test.tsx`
- `meeting-home-work-queue.tsx`
- `meeting-follow-ups.tsx`
- `meeting-follow-ups-runtime.test.ts`

같은 디렉터리의 신규 6파일:

- `meeting-home-personal-room.tsx`
- `meeting-home-personal-room.runtime.test.tsx`
- `meeting-home-candidate-model.ts`
- `meeting-home-candidate-model.test.ts`
- `meeting-home-candidate-queue.tsx`
- `meeting-follow-ups-navigation.ts`

추가 파일은 `e2e/video-meeting-home-triage-actions.spec.ts`와 이 검토 문서다. 공유 API optional AbortSignal 및 HOME 통합 마운트/locale 정본은 루트가 소유하며 위 목록에 포함하지 않는다.

## 기존 시각 기준 영향

자동 갱신하지 않았다. 통합 담당의 승인 원본 대조가 필요한 canonical home snapshot은 `meeting-home-empty-ko-1440-light`, `meeting-home-sample-en-1280-light`, `meeting-home-sample-ko-390-light`(문서 및 viewport), `meeting-home-next-en-768-text-200`, `meeting-home-live-ko-390-dark`(문서 및 viewport), `meeting-home-blocked-en-320-forced-colors`(문서 및 viewport)다. 실제 변화는 통합 단일 큐, 카드 분리, 제목/보조 동작 한 줄 구성, 인용/보존 푸터, category 아이콘과 개인실 초대 링크 영역이다. 기존 mobile 이름의 비실행 중복 파일은 별도 근거 없이 갱신 대상으로 확대하지 않는다.
