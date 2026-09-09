# Meeting 홈 하단 밀도·안전 시드 보정 기록 (2026-09-08)

## 판정

사용자가 캡처한 기존 화면은 승인 원본 U01의 정보 구조를 일부 따랐지만, 실제
`joonbin@sk.com` 데이터 상태와 1,920px 화면에서 승인 수준으로 볼 수 없었다. 기존 회귀는
풍부한 E2E fixture가 있는 1,440/1,280/390/320px 화면 중심이어서 실제 계정의 AI 결과·Work
업무가 없는 안전 상태와 초광폭 화면의 수직 공백을 놓쳤다.

이번 보정 범위의 상태는 **`VERIFIED_SCOPE_NOT_PRODUCT_RELEASE`**다. 홈 화면의 밀도·반응형,
실제 계정 표시, 데이터 출처 표기와 회귀는 검증했다. 실제 녹화·전사·AI 분석·보존 삭제는
외부 운영 Gate가 없으므로 완료로 주장하지 않는다.

## 적용 내용

- 일반 데스크톱에서는 승인 U01의 2:1 오늘 일정/큐 비율을 유지한다.
- 1,536px 이상에서는 상단 일정/큐도 하단과 같은 7:5 비율로 전환해 타임라인의 과도한 폭과
  오른쪽 빈 공간을 줄였다. 모바일은 기존 단일 열 순서를 유지한다.
- AI 검토, Work 업무, AI 후보의 로딩·건수·오류를 한 큐 헤더에서 집계한다. 세 공급원이 모두
  비었을 때는 서로 무관한 빈 문장 세 개 대신 64px의 단일 사실 상태만 표시한다.
- 권한이 확인된 최근 종료 회의를 최대 4개만 상세 조회한다. 현재 사용자 소유 수동 후속 초안과
  수동 결정을 홈에 표시하되 각각 `수동 후속 · 실제 Work 업무 아님`,
  `수동 기록 · AI 분석 결과 아님`으로 명시한다.
- 수동 결정도 없으면 `게시된 회의록 없음`, `녹화·전사·AI 분석 미제공`이라는 사실만 표시한다.
  보고서 ID, 보존 기한, AI 분석, 녹화·전사 또는 Work 실행 성공을 합성하지 않는다.
- 인증 scope가 바뀌거나 상세 조회가 늦게 완료되면 authorization fence와 query 제거로 이전
  사용자의 결과를 렌더링하지 않는다.

## 실제 계정과 데이터 검증

로컬 `dwp_meetings`에서 tenant 1/user 900018(`joonbin@sk.com`)을 다시 조회했다.

| 항목             | 현재 값 |
| ---------------- | ------: |
| 화면점검 회의    |      30 |
| 종료 회의        |      10 |
| 수동 결정        |      20 |
| 수동 후속 초안   |      20 |
| 녹화 세션        |       0 |
| intelligence run |       0 |
| media operation  |       0 |

수동 데이터는 모두 `[화면점검 · 수동 기록 · AI 결과 아님]` 또는
`[화면점검 · 수동 후속 초안 · 실제 업무 아님]` 원문 표식과
`MANUAL_SEED_NOT_AI`/`MANUAL_SEED_NOT_WORK`, `demo=true`, `synthetic=true`를 가진다.
시드를 다시 실행했을 때 신규 변경은 0건이었다. 적용 전 보호 백업은 로컬 PostgreSQL 컨테이너의
`/tmp/dwp-meetings-pre-manual-outcomes-20260908.dump`에 있다.

오늘 일정 3건이 남아 있던 실제 로그인 화면 1,280px에서는 타임라인 282px, 큐 306px,
높이 차 24px, 열 비율 2.0, 수평 overflow 0이었다. 15:11 KST 재새로고침 시에는 미래 일정이
1건으로 줄어 타임라인도 콘텐츠 높이 193px로 축소됐고, 큐 306px과 수평 overflow 0을 유지했다.
즉 빈 행을 강제로 늘리지 않는다. 큐에는 사용자 소유 수동 후속 초안 1건, 최근 결과에는 수동
결정 1건이 안전 라벨과 함께 표시됐다. 1,920px 자동 회귀에서는 7:5 비율과 타임라인 폭
1,000px 미만을 고정했다.

## 검증 결과

중복 실행 수치는 합산하지 않는다.

| Gate                             | 결과                                                               |
| -------------------------------- | ------------------------------------------------------------------ |
| Meeting 앱 unit                  | 80 files / 806 PASS                                                |
| Meeting shared API unit          | 16 files / 405 PASS                                                |
| 홈 수동 결과 model               | 6 PASS                                                             |
| 승인 홈 디자인                   | 5 PASS / 의도된 project skip 5                                     |
| 실제 안전 데이터 desktop/mobile  | 2 PASS / 의도된 project skip 2; Axe serious/critical 0, overflow 0 |
| 홈 visual-quality no-update      | 10/10 PASS                                                         |
| U01 canonical no-update          | 2/2 PASS                                                           |
| 승인 frame matrix                | 32 PASS / 의도된 project skip 2                                    |
| clean non-incremental typecheck  | 0 오류 PASS                                                        |
| lint / i18n / source-size / diff | PASS                                                               |
| Meeting 소유 경로 format         | PASS                                                               |
| Meeting production build         | PASS; initial 858.4KiB raw/265.4KiB gzip, 5/5 requests             |
| 전체 공유 production build       | Node 24.19 정본 `yarn build` PASS; 모든 bundle budget PASS         |
| backend Meeting check            | 584 tests, failure/error 0, 외부 LiveKit smoke 1 skip              |
| 로컬 PostgreSQL 시드 회귀        | 1/1 PASS                                                           |

공유 전체 `format:check`는 Meeting 검증 뒤 다른 활성 Work 작업이 생성한 실패 캡처 설명
`error-context.md` 4개 때문에 다시 중단됐다. Meeting 소유 경로의 포맷 오류는 0개이며 해당
작업 소유자에게 정확한 4개 경로를 전달했다. 이 외부 소유 파일을 Meeting 작업에서 덮어쓰지 않았다.

최신 U01 구현 캡처 SHA-256은 데스크톱
`47ca8994abe0b84f30b79d237e18a3ed3d52be910d6741a204fb7cf273f7cd8c`, 모바일
`1507cc496d92ad469a156a20d55b1137efc1d0ceaf70c08d288bb60d8a1d51a7`이다. 이는 구현
회귀 캡처의 해시이며 Stitch 원본 이미지와 byte-identical하다는 뜻이 아니다.

## 운영 NO-GO

LiveKit SFU/TURN/Egress, KMS, trusted transcript broker, managed STT/LLM, 정상 audit delivery,
승인된 disposable canary와 실제 보존·삭제 증거가 준비되기 전에는 고객 녹화·음성 분석·AI 결과를
완료로 판정할 수 없다. 현재 0건은 결함을 가리기 위한 빈 데이터가 아니라, 운영 증거를 위조하지
않는 fail-closed 상태다.
