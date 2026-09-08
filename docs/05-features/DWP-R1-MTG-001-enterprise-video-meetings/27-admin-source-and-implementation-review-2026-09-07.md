# U13–U15 관리자 원본·구현 독립 재검토

검토일: 2026-09-07. 범위는 U13 운영, U14 정책, U15 AI·데이터 거버넌스의 데스크톱·모바일 6화면이다. 이 문서는 **검토된 구현의 회귀 안전 지점**이며 Stitch 원본과 픽셀 단위 동일 또는 전체 기능 운영 준비 완료를 의미하지 않는다.

## 원본 버전과 직접 대조

Stitch 프로젝트: <https://stitch.withgoogle.com/projects/13391261371843159731>.

- U13-D/M, U14-D, U15-D/M: `/Users/a10697/Downloads/stitch_enterprise_grid_calendar_application (10).zip`, SHA-256 `0a2fc4d7881a01f9b3ba0e6f164f3b9f980f8aa8afc53c29ea53afecb5d22787`의 원본 PNG를 직접 열어 검토했다.
- U14-M: 같은 canvas node `7baadb2159e3411db77faaadb0dc52f5`의 최신 `(15).zip`, SHA-256 `39425824a002e9c551df53975828723c0d91b120c9fb3c231df1812a78f351bb`를 사용했다. 최신 원본은 390×942, 4개 선택 칩, 01만 펼침, 02/03/04 요약 아코디언이다. 이전 `(10)`의 4개 동시 펼침 이미지는 비교 기준으로 대체 사용하지 않았다.
- ZIP, HTML, 원본 PNG 및 source provenance/history는 수정하지 않았다. 원본 검증 세부 증거는 문서 25와 68/68 traceability 회귀에 있다.
- 새 갤러리 `/Users/a10697/Work/DWP/output/meeting-design-review-30-2026-09-07/{source,actual}/U13-D.png`부터 `U15-M.png`까지 6쌍을 직접 확인했다. EN 보조 회귀 PNG와 KO 갤러리는 로케일·브라우저·캡처 배율이 다르므로 동일 이미지로 취급하지 않는다.

| 화면  | 원본 계층과 구현에서 확인한 내용                                                                                                                        | 동일 판정에서 제외한 실제 차이                                                                                                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U13-D | 테넌트·시각 문맥 → 사용자 영향 → 4개 서비스 준비 상태 → 예외 큐와 우측 진단 인스펙터. 원문 대신 운영 메타데이터만 표시한다.                             | 시안의 SLA, 손실률, SFU 노드·슬롯 수, FIPS 인증을 실제 증거 없이 채우지 않는다. 미측정/미연결, 비활성 운영 액션 및 DWP 공통 셸은 시안과 다르다.                                             |
| U13-M | 파란 사용자 영향 요약 → 가로 서비스 비교 → 예외 큐 → 메타데이터 인스펙터 순서를 유지한다.                                                               | 실제 미구성 상태 설명으로 문서 높이가 길다. 시안의 관리자 하단 4탭 대신 현재 DWP 관리 내비게이션을 사용한다. 이는 정확한 원본 동일 구현이 아니다.                                           |
| U14-D | 접근, 녹화, AI, 보존, 템플릿 정책과 우측 영향/감사 경계를 대조했다. 실제 저장 가능한 정책과 아직 계약이 없는 설명 항목이 분리돼 있다.                   | 시안의 영향 사용자 수·부서 override·감사 목록·마스킹 등급 값은 연결되지 않은 상태로 명시한다. 실제 협업/수용 인원 섹션 06/07이 추가돼 전체 길이가 다르다.                                   |
| U14-M | 최신 (15)의 4칩과 단일 펼침을 확인하고 각 칩을 직접 열었다. 변경한 접근 값은 다른 섹션 왕복 후 보존된다.                                                | DWP 관리 셸, 접근의 실제 3개 제어, 보조 정책 05/06/07 및 미연결 경계가 있어 원본 390×942보다 길다. 하단 저장은 실제 승인 검토 절차를 표현하며 원본의 즉시 전사 배포 성공을 가장하지 않는다. |
| U15-D | 출시 준비 → 7단계 파이프라인 → 모델/보존 증거 → 운영 조치 → 상세 실행 증거를 확인했다. 신규 회의 기록 보존·삭제 제어는 별도 접힌 disclosure로 추가됐다. | 시안의 100% 가동, HSM 슬롯, 실제 삭제 건수·해시는 외부 증거가 없어 표시하지 않는다. 6개 모바일 예시 체인과 달리 실제 계약은 7단계다.                                                        |
| U15-M | 파란 준비 상태 → 순서 있는 파이프라인 → 수명주기 증거 → 운영 조치 → 접힌 상세 증거. 녹화·원문 접근 권한을 관리 화면에 부여하지 않는다.                  | 신규 보존 제어와 명시적 차단 이유로 높이가 증가했다. READY fixture에서도 회의별 동의는 별도 미검증이므로 100% 준비라고 표시하지 않는다.                                                     |

위 차이 중 외부 증거가 필요한 수치를 만들어 넣는 것은 허용하지 않는다. 메뉴 구성·공통 셸·정보 밀도의 시안 차이는 숨기지 않고 통합 검토에 인계했다. 신규 실제 인프라 activation 또는 고객 데이터 삭제는 수행하지 않았다.

## 발견한 회귀와 최소 보정

1. U14-M의 `summary` 선택이 내부 미지원 기능 disclosure까지 3개를 선택했다. 직접 자식 `:scope > summary`로 좁혔다.
2. 최신 4개 칩, 정확히 1개 열린 핵심 섹션, 44px summary, 각 칩 이동 및 변경 값 유지의 실제 인터랙션 회귀를 추가했다. 녹화 미구성 시 select 비활성, 보존 숫자 입력 3개, 별도 협업 switch 3개, 수용 인원 입력과 미지원 override/감사 설명도 직접 열어 확인한다.
3. 모바일 U14의 sticky 저장 바가 `fullPage` 촬영에서는 문서 중간을 덮는 캡처 문제가 있었다. 실제 390×844 뷰포트와 문서 끝 콘텐츠/저장 바 여유를 먼저 검사·첨부한다. 문서 촬영에만 뷰포트 높이를 문서 높이로 확장하고 복원한다. DOM/스타일을 숨기거나 바꾸지 않는다. 갤러리 소유자에게 같은 캡처 분리를 인계했다.
4. U13-D/M, U14-D/M, U15-M KO 및 U15-M EN dark의 **직접 검토된 구현** PNG 6개만 갱신했다. U15-D는 이미 최신 1440×2423 기준으로 통과해 이번 작업에서 재작성하지 않았다.
5. `meeting-reviewed-implementation-captures.ts`의 U15-M 1개 엔트리만 2168→2233 높이와 새 구현 PNG SHA로 정합했다. 다른 29개 엔트리는 통합 소유자가 관리한다. 원본 SHA 및 허용 차이 `maxDiffPixelRatio: 0.002`는 불변이다.

## 최종 검증

Node 24 및 정본 Yarn webServer를 새로 시작한 :4478에서 실행했다. 기존 서버 재사용, 직접 Vite 우회, snapshot 자동 갱신을 사용하지 않는 최종 명령:

```sh
PATH=/Users/a10697/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH \
DWP_FRONTEND_DEV_PORT=4478 E2E_BASE_URL=http://127.0.0.1:4478 \
E2E_REUSE_EXISTING_SERVER=false \
PLAYWRIGHT_OUTPUT_DIR=/tmp/meeting-admin-final-gate-0907 \
PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/meeting-admin-final-gate-0907.json \
corepack yarn playwright test \
  e2e/video-meeting-admin-surfaces.spec.ts \
  e2e/video-meeting-admin-intelligence-visual.spec.ts \
  --project=chromium --project=mobile --workers=2 \
  --update-snapshots=none --reporter=json
```

결과: **7 PASS, 0 FAIL, 0 flaky, 기존 명시적 project skip 3**, 22.0초. U13/U14 4건은 Chromium 데스크톱과 iPhone/WebKit 모바일 각각 실행됐다. U15 3건은 Chromium에서 1440 KO light, 390 KO light, 390 EN dark를 실행한다. 기존 U15 WebKit project 3개 skip을 통과 수에 포함하지 않았다.

- U13/U14: main/html 가로 overflow ≤1px, 390/320 및 320 200% 텍스트, critical/serious axe 위반 0, 유동 공통 여백 24/16px.
- U14: 실제 저장 바 뷰포트·문서 끝 clearance 증거, 단일 펼침·변경 유지·미지원 기능 fail-closed 회귀 PASS.
- U15: main axe/overflow, 키보드 disclosure, KO/EN raw i18n 키·console/pageerror·HTTP 5xx 0, 명시적 문서 높이/랜드마크 순서/끝 여유 PASS.
- 두 spec 및 U15 구현 메타데이터 scoped ESLint, Prettier, diff-check PASS.
- 실행 완료 후 :4478 listener 0. 부분 커밋 및 공통 런타임/계약 파일 수정 없음.

## 검토된 구현 PNG manifest

아래는 원본 디자인 SHA가 아니라 **구현 회귀 PNG** SHA-256이다.

| 파일 (각 spec의 `-snapshots/`)                                                            | Raster    | SHA-256                                                            |
| ----------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------ |
| `meeting-u13-operations-desktop-chromium-darwin.png`                                      | 1440×1551 | `544c7d6ae32c64c158b395d9381c2168e414ef7afe930717be1e80b8dd6db8b8` |
| `meeting-u13-operations-mobile-mobile-darwin.png`                                         | 390×2521  | `12715497a7116e24070172fd2e25230124a4d8509c7f898720fb368d1bb8a0d1` |
| `meeting-u14-policy-desktop-chromium-darwin.png`                                          | 1440×2662 | `b61561486613addaa3d842c526d3978f115bee6b1467ae23cbe0a1d5588fa584` |
| `meeting-u14-policy-mobile-mobile-darwin.png`                                             | 390×1838  | `068fa383c0abfbad3576b974dbcd3e48f6ae49e7fc18ddbb194c6b293ad66a17` |
| `meeting-admin-intelligence-blocked-ko-1440-light-chromium-darwin.png` (이번 재작성 없음) | 1440×2423 | `b98b96fc650b79dc44def63815faf6f233e5fe6e04581c78196b981e2614c42a` |
| `meeting-admin-intelligence-blocked-ko-390-light-chromium-darwin.png`                     | 390×2233  | `c9dce157868c88b8fca3ae638a1f7dfaa4b321175ba66ab3e001c8386ccd0b77` |
| `meeting-admin-intelligence-ready-en-390-dark-chromium-darwin.png`                        | 390×2203  | `1758d800b8cc629acec21c077470b2ebffff3d8cdeeebcc82ee4a1932a53f267` |
