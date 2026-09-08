# U03·U11 선택 정보와 후속 동선 보정

2026-09-07 독립 원본 대조에서 확인한 두 P2만 수정했다. 새 구현 캡처와 테스트 PASS는 원본 디자인의 100% 승인이나 실제 운영 연동 완료를 의미하지 않는다. 승인 Stitch ZIP, screen/code hashes, 공통 approved-frame contract 및 기존 golden 파일은 이 작업에서 변경하지 않았다.

## 원인과 적용 설계

| 화면           | 실제 누락                                                                                                 | 이번 보정                                                                                                                                                   | 권한·명령 경계                                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U03 D/M 예약   | 템플릿 적용 후 제목/안건은 들어가지만 선택 컨트롤은 일반 버튼으로 돌아가 현재 선택명·개정을 알 수 없었다. | 승인 원본의 선택 강조 컨트롤을 복원해 이름, 적용 개정, 조직/개인 범위, 목적을 표시한다. DS ActionButton 안의 명시적 선택 UI이며 기존 선택·확인 흐름을 연다. | 현재 authorized GET 결과의 ID와 개정이 적용 참조와 같을 때만 표시한다. draft에는 표시용 이름/목적을 저장하지 않는다. 변경·오류 시 표시 철회, 401/403이면 기존 revoke 경계로 편집 내용도 폐기한다. |
| U11 D/M 개인실 | 최근 이용 이력의 제목은 읽기 전용이었고 전체보기 동선이 없었다.                                           | 실제 meetingId를 사용한 제목 버튼·Chevron을 복원했다. 제목은 해당 회의 준비 상세로, 전체보기는 현재 내 회의 목록으로 이동한다.                              | 세션 시작 명령과 별도 callback이다. 이력 조회 권한 철회 시 블록을 제거하고 대상 회의 준비 화면도 독립적으로 권한을 재검증한다. 이동으로 세션 생성·미디어 활성화하지 않는다.                       |

템플릿의 탭 복귀, visibility 변경, 30초 foreground refresh는 기존 표시를 먼저 철회하고 재검증한다. AbortSignal과 요청 세대 검증으로 이전 선택·취소·403보다 늦은 응답이 화면을 복구하지 못한다. 현재 개정이 바뀌었다고 새 이름을 기존 적용 개정의 이름으로 제시하지 않는다.

U11의 “내 회의 · 전체 보기”는 현재 정본 `/meetings/mine`을 명시한다. 개인실만으로 필터된 전체 이력을 제공한다고 표현하지 않는다. 기존 개인실 이력 페이지 이동은 유지한다. 원본의 허구 운영값, 참가 인원, AI 결과나 접근 허용은 추가하지 않았다.

## 변경 파일

- `apps/dwp/src/features/meetings/meeting-schedule-template-selection.tsx`
- `apps/dwp/src/features/meetings/meeting-schedule-template-selection.test.tsx`
- `apps/dwp/src/features/meetings/meeting-schedule-source-picker.tsx`
- `apps/dwp/src/features/meetings/meeting-personal-room.tsx`
- `apps/dwp/src/features/meetings/meeting-personal-room-details.tsx`
- `apps/dwp/src/features/meetings/meeting-personal-room.runtime.test.tsx`
- `apps/dwp/src/features/meetings/meeting-context-workspace.tsx` — 제품 전용 준비 경로 callback 한 줄
- `e2e/video-meeting-my-schedule-design.spec.ts`
- `e2e/video-meeting-personal-room.spec.ts`

공통 shell, locale, API, DB, 계약 생성물은 변경하지 않았다.

## 최종 검증

Node 24.19.0 런타임과 정본 Yarn을 사용했다.

- Unit 4 files, 57/57 PASS. 새 선택 표시 회귀 6개와 개인실 이동·철회 회귀 2개 포함.
- 새 기능·권한 중심 Chromium/mobile E2E 14/14 PASS.
- fresh Vite 포트 4482에서 확장 회귀 39 PASS, 1 기존 의도적 skip. desktop/mobile, 1440/1280/390/320, dark/forced-colors/200% text, keyboard focus, serious/critical axe 위반 0, overflow 검사 포함.
- 기존 light golden 2개는 이번 실행에서 제외하고 그대로 보존했다. 새 캡처를 원본 승인으로 자동 등록하지 않았다.
- 전체 `corepack yarn typecheck --incremental false` PASS.
- 변경 9파일 scoped ESLint 0, Prettier PASS, diff-check PASS.
- global source-size 1764 production files PASS, i18n PASS.

```sh
corepack yarn test apps/dwp/src/features/meetings/meeting-schedule-template-selection.test.tsx apps/dwp/src/features/meetings/meeting-personal-room.runtime.test.tsx apps/dwp/src/features/meetings/meeting-schedule-workspace.runtime.test.ts apps/dwp/src/features/meetings/meeting-context-workspace.runtime.test.tsx
DWP_FRONTEND_DEV_PORT=4482 E2E_BASE_URL=http://127.0.0.1:4482 E2E_REUSE_EXISTING_SERVER=true PLAYWRIGHT_OUTPUT_DIR=/tmp/dwp-meeting-u03-u11-p2-final-r3 corepack yarn playwright test e2e/video-meeting-my-schedule-design.spec.ts e2e/video-meeting-personal-room.spec.ts --grep-invert 'personal room light is responsive' --workers=2
```

최초 확장 회귀에서 두 실패가 발생했지만 같은 시각 13:46:35 Vite 로그에 `bootstrap-application.tsx` invalidation과 page reload가 확인됐다. 이를 PASS로 계산하지 않고 서버 재시작 후 전체 해당 40-case를 다시 실행해 위 39 PASS/1 skip을 회수했다.

## 직접 대조한 최종 구현 PNG

아래 각 문서 캡처를 source/U03-D, U03-M, U11-D, U11-M과 직접 열어 대조했다. 같은 폴더에 viewport PNG도 있다. 모바일 document 캡처는 900px viewport에서 fullPage로 찍으므로 fixed dock/nav가 긴 문서 중간에 한 번 합성되어 보일 수 있다. 실제 viewport의 고정 위치·스크롤 접근성은 E2E에서 별도로 검증한다.

- `/tmp/dwp-meeting-u03-u11-p2-final-r3/video-meeting-my-schedule--a9b76-imeboxes-and-four-step-flow-chromium/U03-D-document.png`
- `/tmp/dwp-meeting-u03-u11-p2-final-r3/video-meeting-my-schedule--a9b76-imeboxes-and-four-step-flow-mobile/U03-M-document.png`
- `/tmp/dwp-meeting-u03-u11-p2-final-r3/video-meeting-personal-roo-54ef6-st-without-session-creation-chromium/U11-D-document.png`
- `/tmp/dwp-meeting-u03-u11-p2-final-r3/video-meeting-personal-roo-54ef6-st-without-session-creation-mobile/U11-M-document.png`

## 이전 golden Gate의 별도 잔여

현재 구현과 옛 implementation baseline의 정합 작업은 이번 두 P2의 완료와 구분한다.

1. `video-meeting-approved-frame-regression.spec.ts:127`은 U02 inspector를 모바일에도 상시 노출하도록 기대한다. 현재 승인 원본 흐름은 목록에서 회의를 선택해야 dialog 상세를 여는 구조이므로 desktop 상시 pane과 mobile 선택 상세를 구분해야 한다. 새 `video-meeting-my-schedule-design.spec.ts`는 이 구분을 이미 실행 검증한다.
2. 공통 regression owner는 12화면 D/M 24개, 별도 U03/U04/U15 owner는 각 D/M 2개씩 총 6개로 중앙 registry의 implementation entry는 30개다. 전체 30개가 실패한다고 판정한 것은 아니다. 현재 런타임 재실행 후 바뀐 구현만 직접 검토·회귀 baseline 갱신해야 한다.
3. 선택 정보와 이력 동선 변경으로 이번 소유 범위는 U03 D/M 및 U11 D/M의 중앙 4개 entry를 확인해야 한다. 별도 개인실 light baseline 2개와 예약 spec snapshot 8개도 재실행·차이 분류 대상이다. 후자는 전체가 변경됐다는 뜻이 아니다.
4. `meeting-approved-frame-contract.ts`의 implementation raster/height/hash와 `video-meeting-approved-frame-matrix.spec.ts`의 파일 일치 검증은 실제 검토 완료된 새 구현에만 맞춰야 한다. 승인 원본 ZIP과 sourceArtifact screen/code hashes를 새 구현에 맞춰 바꾸면 안 된다.
5. 테스트명과 문서에서 implementation baseline을 원본 디자인 승인으로 혼동하지 않도록 의미를 유지해야 한다. 원본 대비 운영 차이는 별도 미지원/외부 연동 증거로 남긴다.
