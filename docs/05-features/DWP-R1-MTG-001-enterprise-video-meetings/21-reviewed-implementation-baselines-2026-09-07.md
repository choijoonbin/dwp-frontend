# U01–U15 구현 회귀 기준 재검토 — 2026-09-07

## 판정의 범위

이 문서는 새 구현에 맞춰 **구현 회귀 PNG 30개**를 검토하고 갱신한 기록이다. 사용자 승인 원본과의 100% 시각 일치 승인, 모든 기능의 운영 출시 승인, 실제 녹화·AI 종단 검증 완료를 뜻하지 않는다. `approved`가 포함된 기존 테스트/파일명도 구현 스냅샷의 출처 추적 이름이며, 구현 PNG를 원본으로 승격하지 않았다.

- 원본 ZIP: `/Users/a10697/Downloads/stitch_enterprise_grid_calendar_application (10).zip`
- ZIP SHA-256: `0a2fc4d7881a01f9b3ba0e6f164f3b9f980f8aa8afc53c29ea53afecb5d22787`
- 원본 ZIP descriptor, 30개 screen/code hash와 raster, Stitch node/viewport 기록은 변경하지 않았다.
- 해당 원본 기록 선택 영역의 작업 전후 fingerprint: `ed94fdc7b175bd3261bb6054981c3d3ceceea6e96dd667a0a9fb6fca8823147e`로 동일하다.
- 비교 원본 PNG: `/Users/a10697/Work/DWP/output/meeting-design-review-30-2026-09-07/source/U01-D.png`부터 `U15-M.png`까지. 새 구현 30 PNG를 직접 열어 구조·내용·오버레이를 확인했다. 원본 자체를 리사이즈하거나 덮어쓰지 않았다.

## 오래된 검증에서 바로잡은 차이

| 화면 | 복구한 실행 상태 / 정확한 바인딩                                                                                                                                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U01  | 일정·대기 업무·최근 결과·템플릿/개인실 영역. 현재 fixture의 실제 응답 내용과 개수로 검증하며 원본의 가상 값은 주입하지 않는다.                                                                                                                |
| U02  | 모바일 기본 화면에서 inspector는 숨김. 회의 카드 선택 → 상세 dialog → 닫기를 실행하고 기본 목록을 캡처한다. 데스크톱은 선택 카드와 inspector를 함께 보존한다. 새 preparation/schedule/content-plan GET을 실제 알려진 fixture ID에만 연결했다. |
| U03  | 선택한 템플릿의 확인된 이름·개정이 나타날 때까지 기다린다. 시간을 고정해 예약 시작 시간의 날짜 변경 불안정을 제거했다. 모바일 first-fold 검사 후 문서 높이 viewport에서 촬영하여 고정 저장 dock이 긴 PNG의 중간에서 의제를 가리지 않게 했다.  |
| U04  | 목적/스마트 브리핑/의제/자료/회의 전 대화/RSVP/장치/정책 블록을 현재 로드 상태로 보존한다.                                                                                                                                                    |
| U05  | 비공개 preview → 장치 점검 → 실제 입장·정책 동선을 보존한다. 회의 의제/콘텐츠 계획을 현재 API fixture와 연결한다. 모바일 브라우저가 지원하지 않는 배경 처리는 지원 불가로 표시된다.                                                           |
| U06  | 실제 협업 UI와 안건·타이머·투표 fixture를 검증한다. 미디어 transport는 연결 중인 통제 상태이며 실제 다중 참가자 미디어의 성공 증거가 아니다.                                                                                                  |
| U07  | 서버 pagination/즐겨찾기 fixture가 연결된 기록 목록과 선택 preview. 모바일은 목록 우선이며 상세 preview를 강제로 상시 삽입하지 않는다.                                                                                                        |
| U08  | 게시된 요약·결정·후속 작업·근거 rail. 모바일 상세 분석은 열기 → 내용 확인 → 닫기를 실행한 뒤 원래 접힌 화면을 캡처한다.                                                                                                                       |
| U09  | 데스크톱에서 실제 업무 row를 선택하고 상세·출처 영역을 확인한다. 선택 전 빈 inspector를 상세 화면 증거로 사용하지 않는다. 출처 원문은 별도 권한 확인/근거 미리보기 동선이며 자동 노출하지 않는다.                                             |
| U10  | 다중 템플릿, 선택 카드, preview, 목적/범위/권한, 모바일 선택 상세와 템플릿 bottom navigation.                                                                                                                                                 |
| U11  | 현재 개인실, 링크, 입장 통제, 최근 이력/전체 보기, 설정 동선. 초대 URL의 실제 origin과 alias 존재를 확인한 후 환경별 port만 달라지는 URL 텍스트 영역을 한정 mask한다. 링크 권한·회전/QR 검증을 대체하지 않는다.                               |
| U12  | 장치 preview와 audio/video/join/진단/설정 영역. bottom navigation이 아니라 실제 저장 dock을 검사한다. content root와 바깥 PageCanvas가 나눠 소유한 하단 inset을 합산하되 dock 높이+23px 및 실제 마지막 내용 겹침 방지 기준은 유지한다.        |
| U13  | 모바일 signal → 서비스 준비/예외 → 지원 KPI → 선택 진단 inspector 순서. 마지막 의미 있는 내용은 예외 목록이 아닌 진단 inspector이다.                                                                                                          |
| U14  | 모바일 핵심 01–04 펼침 및 추가 05–07 접힘. 정책 경계 disclosure를 열어 내용 확인 후 닫는다.                                                                                                                                                   |
| U15  | 준비 판정·처리 단계·거버넌스·보존 증거. 모바일 상세 disclosure 검증 후 scroll origin을 복원하고 문서 좌표로 종단 여백을 검사한다.                                                                                                             |

공통 제품 shell은 편집하지 않았다. 원본의 가상 인물·건수·전사 내용·인증 배지와 테스트 fixture의 데이터 차이는 레이아웃 차이와 구분한다. 지원하지 않는 데이터·외부 연계의 명시적 비활성 상태는 지우거나 성공 상태로 위장하지 않았다.

## 회귀 기준과 유지보수

- 갱신 대상은 common regression 24개와 U03/U04/U15 owner 6개뿐이다. 기타 dark/zoom/forced-color/기능 단계 PNG는 자동 갱신하지 않았다.
- 변경된 구현 SHA/높이는 `e2e/support/meeting-reviewed-implementation-captures.ts`에 분리했다. 원본 출처/경로의 정본은 `meeting-approved-frame-contract.ts`에 남는다.
- 컴포넌트 분리 뒤 U02 inspector/U05 devices/U08 outcome의 실제 소유 파일을 추적 목록에 추가했다. U09 KPI와 U13 진단의 token도 현재 의미 있는 컴포넌트로 맞췄다.
- 모바일 navigation은 U01/U02/U07/U08/U09/U10/U11이며, U12는 저장 dock이라는 정확한 구분을 matrix가 검사한다.
- 소스 크기: contract 731줄, 구현 captures 291줄, visual-quality 941줄, 분리한 focus/clearance helper 68줄. 기준 상향이나 기계적 압축은 하지 않았다.
- 화면 허용 차이 0.002, 가로 넘침 1px, 기존 종단 여백 128px, 미디어 고정 viewport 등 허용치는 그대로다.

## 실행 증거

Node v24.19.0, macOS, 전용 Vite 4482, 정본 설정을 상속하는 포트별 캐시 격리 설정을 사용했다. Chromium desktop 및 Playwright mobile(iPhone 13) project를 모두 실행했다.

```sh
PATH=/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
DWP_FRONTEND_DEV_PORT=4482 E2E_BASE_URL=http://127.0.0.1:4482 E2E_REUSE_EXISTING_SERVER=true \
MEETING_STITCH_EXPORT_PATH='/Users/a10697/Downloads/stitch_enterprise_grid_calendar_application (10).zip' \
PLAYWRIGHT_OUTPUT_DIR=/tmp/dwp-meeting-golden-final30-r3 \
PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/dwp-meeting-golden-final30-r3.json \
corepack yarn playwright test e2e/video-meeting-approved-frame-regression.spec.ts \
e2e/video-meeting-schedule.spec.ts e2e/video-meeting-preparation.spec.ts \
e2e/video-meeting-admin-intelligence-visual.spec.ts e2e/video-meeting-approved-frame-matrix.spec.ts \
--grep 'executes the reviewed implementation|U03 approved-size|U04 approved-size|blocked AI administration|approved Stitch frame traceability' \
--workers=2 --reporter=json
```

최종 결과: **92 PASS, 2 intentional skip, 실패 0**. 구현 30개와 traceability 31개×2 project이며, U15의 모바일 project 중복 호출 2개는 해당 owner가 Chromium에서 desktop/mobile을 각각 촬영하므로 기존 정책대로 제외된다. 최종 실행에는 `--update-snapshots`가 없다. 각 원본 screen/code는 ZIP에서 직접 읽어 정본 SHA/raster와 검증했다. 전체 non-incremental typecheck, scoped ESLint/Prettier, source-size도 통과했다.

분리한 focus/clearance helper의 양성·음성 브라우저 회귀도 `e2e/video-meeting-visual-focus.spec.ts`에서 8/8 PASS다. 키보드 가시 표시가 없는 입력과 clipping 여백이 없는 요소를 각각 실제로 거부하는지 포함한다. 결과는 `/tmp/dwp-meeting-focus-helper-r2.json`에 남겼다.

전체 `architecture:check`는 제품 권한/60개 PEP/fixture/application architecture 검사 통과 후 공통 `Route composition config is stale. Run corepack yarn routes:sync.`에서 종료되었다. 중앙 소유 생성물은 변경하지 않았으며 루트 통합에 전달했다. 이 전체 Gate를 PASS로 기록하지 않는다.

## 남는 승인 경계

이 검증은 통제 fixture의 구현 회귀를 닫은 것이다. 실계정 데이터, 실제 카메라·마이크/네트워크, LiveKit 녹화, KMS/STT/LLM, 보존·삭제의 운영 종단 검증을 대신하지 않는다. U06 연결 중 상태, U07 공유/검토 필터의 서버 연결 준비, 관리자 텔레메트리/고위험 조치 등 명시적 미제공 상태를 운영 완료로 주장하지 않는다. 과거 `video-meeting-visual-quality.spec.ts` 전체 및 다른 owner의 별도 dark/zoom golden은 이번 30개 재승인 범위가 아니며 자동 갱신하지 않았다.

`video-meeting-visual-quality.spec.ts`에는 19개 테스트 선언이 남아 있으며, 이번에는 focus helper를 동작 변경 없이 분리했을 뿐 전체 19개를 새 디자인에 대해 재승인하지 않았다. 별도 오래된 golden을 새 원본 승인처럼 일괄 수용하는 작업은 하지 않았다.
