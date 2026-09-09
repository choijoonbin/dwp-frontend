# DWAI·ON A01~A08 관리자 수용 기록 · 2026-09-08

이 기록은 공통 디자인 계약과 `13-admin-overview.md`~`20-admin-audit-retention.md`의
관리자 여정을 현재 API 계약으로 대조한다. 브라우저 데이터는 명시적인 합성 fixture이며,
운영 서버의 연결·모델·승인·원본 데이터 접근 성공을 증명하지 않는다.

아래 검증 수치와 캡처는 결함을 찾고 수정한 진단·수리 과정의 기록이다.
최종 통합 승인 결과는 완료된 Chromium 보고서와 갤러리를 확인한 뒤 문서 말미에 별도로 기록한다.

## 사용자와 작업

| ID  | 주요 사용자·운영 질문                                  | 주 행동·화면 구조                                                     | 구현 파일·경로                                                                                                               | 실제 API                                                                   |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A01 | 운영자: 사용자 영향과 준비 문제가 무엇인가             | 기간 선택→실패/차단/근거 상태→담당 관리 화면                          | `dwaion-admin-overview.tsx`, `/dwaion/admin/overview`                                                                        | `GET /api/agent/v1/admin/overview?period_days=1..90`                       |
| A02 | 편집자·게시자: 어떤 리비전을 제공할까                  | 검색/상태 필터→선택 inspector→초안/게시 확인                          | `dwaion-admin-agents.tsx`, `dwaion-admin-agent-history.tsx`, `/dwaion/admin/agents`                                          | `/api/platform/v1/admin/dwaion/agents`, 항목 이력·revision·activate·retire |
| A03 | 소스 운영자: 어떤 범위를 참조하는가                    | 검색/상태 필터→정책 inspector→변경 비교·사유→저장                     | `dwaion-admin-sources.tsx`, `/dwaion/admin/sources`                                                                          | `GET /admin/sources`, `PATCH /admin/sources/{sourceKey}`                   |
| A04 | 행동 정책 운영자: 어디서 최종 확정하는가               | 실행 방식/권한/위험 검토→정책 비교·사유→저장                          | `dwaion-admin-actions.tsx`, `/dwaion/admin/actions`                                                                          | `GET /admin/actions`, `PATCH /admin/actions/{actionKey}`                   |
| A05 | 안전 정책 담당자: 차단/인계와 예산을 어떻게 설정하는가 | 고정 원칙·편집 설정 구분→사유→버전 저장                               | `dwaion-admin-safety.tsx`, `/dwaion/admin/safety`                                                                            | `GET/PATCH /admin/safety`                                                  |
| A06 | 평가 담당자: 어떤 제한된 규칙이 통과했는가             | 활성 세트→케이스/이력→실행→표본 결과/CSV                              | `dwaion-admin-evaluation.tsx`, `dwaion-evaluation-set-list.tsx`, `dwaion-evaluation-history.tsx`, `/dwaion/admin/evaluation` | `/admin/evaluations`, 세트·케이스·runs·export                              |
| A07 | 구성자·검증자·독립 승인자: 필요한 증거가 있는가        | 환경→13개 Gate 상태→선택 상세→기존 증거/검증/승인 dialog              | `dwaion-admin-gates.tsx`, `dwaion-gate-dialogs*`, `/dwaion/admin/gates`                                                      | `/admin/gates?environment=...`, 항목·evidence·validation·decision          |
| A08 | 감사자·보존 담당자: 누가 무엇을 바꾸었는가             | 서버 검색/범주/페이지→사건 메타데이터→범위가 표시된 CSV; 독립 보존 폼 | `dwaion-admin-audit.tsx`, `dwaion-admin.tsx`, `/dwaion/admin/audit`                                                          | `/admin/audit`, `/admin/audit/export`, `GET/PATCH /admin/retention`        |

위 `/admin/...` API 접두사는 `/api/agent/v1`이다. 공유 선택 상세는
`dwaion-admin-registry.tsx`로 구현하며 선택 식별자만 `entry` URL 매개변수에 보존한다.
질문·답변·메일 원문을 URL이나 감사 메타데이터에 추가하지 않는다.

## 디자인 수용 체크리스트

- [x] A01 기간 선택·생성 시각·새로고침은 서버 값과 연결한다. 실행 완료 비율은 실제 분모를,
      대화 수는 보존 범위를 설명한다. 조회 실패를 0으로 바꾸지 않는다.
- [x] A02 첫 100건 범위를 명시하고, 이름/담당자/위험 등 조회된 메타데이터 검색과 상태 필터를 제공한다.
      선택 상세에서 실제 revision 이력을 조회한다. 초안만 수정하며 게시/퇴역 전에 영향 확인창을 연다.
      취소 시 mutation을 전송하지 않고, 확인 시 기존 서버 version을 전송한다.
      초안 충돌은 현재/요청 metadata를 비교하며 명시적으로 최신 revision을 다시 읽는다.
      이미 게시된 revision은 입력을 보존하면서 저장을 차단한다.
- [x] A03 설정 상태·접근 모드·분류·connector 참조·정책 버전·수정 시각을 상세에 표시한다.
      `CONNECTED`는 “연결 설정됨 / Configured connection”이며 실시간 검사 결과와 구분한다.
      실제 7개 source key/provider/classification을 사용하며 bootstrap 차단 상태도 분리한다.
      BLOCKED와 enabled의 모순을 차단하고, 현재/요청 값·사유·expectedVersion을 검토한다.
- [x] A04 USER_HANDOFF/APPROVAL_HANDOFF/BLOCKED·필요 권한·위험·확인 필수·정책 버전을 표시한다.
      실제 등록된 action key에서 확인한 담당 앱을 함께 제공한다.
      최종 업무 변경의 권위는 원본 앱에 있음을 설명하며, 정책 저장을 업무 실행이나 승인 완료로 표시하지 않는다.
      A03/A04 version 충돌 복구는 입력·사유를 유지하고 명시적 재조회 후 현재 version으로 검토한다.
      닫기/다른 편집/새 저장/해제 후 도착한 이전 재조회는 새 편집기의 version과 오류 상태를 바꾸지 않는다.
- [x] A05 고정 차단/근거 원칙을 장식 스위치로 만들지 않는다. 변경 가능한 처리 방식과 소스/도구 예산은
      키보드로 조작하며 이름을 제공한다. 변경 사유와 서버 정책 버전을 전송한다.
- [x] A06 규칙 검사 표본 수와 관측된 grounding/expected-term 결과를 제공한다.
      데이터셋·모델·정책·평가 규칙의 동등성이 없는 상태에서 품질 향상/퇴보 비교를 단정하지 않는다.
      실행/내보내기 권한을 구분하고 활성 세트에서만 실행한다.
      899.95px 이하에서는 세트 이름·상태·케이스 수·최근 실행 결과를 44px 이상 native button 목록으로
      모두 표시한다. desktop 비교 표와 양쪽 Enter 선택을 유지한다. 수리 대상 재검증에서 정상·변형 7개 캡처와 필드 경계 검증이 통과했다.
- [x] A07 환경 변경이 portfolio/API 범위에 반영된다. 모바일에서도 항목을 선택해 필요한 검토 행동을 읽는다.
      readiness는 필수 Gate 승인 비율이고 SLA나 자동 진단 결과가 아니다.
      검증자가 기록한 PASS/FAIL과 독립 승인 자격을 구분하며 자기 승인 사유를 표시한다.
- [x] A08 5종 지원 정책 감사 범주·서버 검색·서버 페이지와 사건 메타데이터 inspector를 제공한다.
      CSV의 `X-DWP-Export-Limit`, `X-DWP-Export-Truncated` 실제 헤더를 보존한다.
      헤더 부재/불량은 범위 미확인으로 남기며 전체 내보내기 완료로 치환하지 않는다.
      감사 VIEW/EXPORT와 보존 VIEW/UPDATE/MANAGE는 독립한다.
- [x] A02/A03/A04/A07/A08 선택 목록은 표 오른쪽 끝의 숨은 버튼에 의존하지 않는다.
      desktop은 목록/상세, 모바일은 전체 화면 ContentDialog를 사용한다.
- [x] 공통 shell/menu/Work/Meeting 코드를 변경하지 않았다. 해당 작업의 기존 dirty 변경을 보존했다.
- [x] 모든 이번 소유 source/test 파일은 500줄 미만이다.

## 확인한 실패와 수정

초기 정상 데이터 검사에서 A05의 두 선택 상자에 접근 가능한 이름이 없어 axe serious 위반을 발견했다.
A06의 선택된 실행 이력 배지는 4.25:1 대비, A08의 비활성 사유 도움말은 2.33:1 대비였다.
각 결함을 수정했으며 관련 검사는 계속 유지한다. A02~A04 검색 칸이 flex 안에서 가늘게 접힌 현상은
실제 screenshot 육안 검토로 발견했고, 명시적인 responsive grid로 수정했다.

A07의 기존 모바일 표는 page overflow 검사를 통과해도 검토 행동이 수평 스크롤 바깥에 있었다.
전체 레지스트리 선택 상세 구조로 변경해 중요한 사용자 행동이 화면 폭 안에 있도록 수정했다.
A08도 사건 원문 대신 메타데이터를 선택해 읽는 방식으로 변경했다.

독립 사본의 A06 390px 캡처에서 평가 세트의 케이스 수·최근 실행 열이 내부에서 잘린 것을
추가로 발견했다. document overflow와 axe만으로 잡히지 않는 결함이므로 feature-local
`DwaionEvaluationSetList`를 추출했다. 좁은 목록의 각 필드와 native button 경계를 직접 검사하고,
로딩/실패 중 빈 세트 성공 안내가 나타나지 않도록 유지했다. API 조회·명령 계약은 바꾸지 않았다.

## 진단·수리 과정: 중간 검증과 증거

초기 실행 환경: Node 24 runtime, test-mode Vite `http://127.0.0.1:4300`, Chromium.
공유 Work 검증을 보호하기 위해 진단·수리용 중간 검증은 독립 사본 `/tmp/dwaion-final-checkout-20260908`와
Vite `http://127.0.0.1:4455`에서 root가 단일 runner로 수행했다. 명시적인 공유 source freeze 해제 뒤
소유 12개 파일의 기존 SHA-256과 검증 사본 SHA를 사전 확인하고 공유 원본에 반영했다.
사후에도 12/12 shared=copy 일치를 확인했다. 증명서는
`/tmp/dwaion-admin-shared-merge-receipt-20260908.json`이다. 공유 원본 전체 빌드·회귀 검증 결과는
통합 기록 `06-screen-acceptance-2026-09-08.md`에서 관리한다.

이 절의 264개 실행, 관리자 92/93 결과, 수리 대상 24/24 결과와 정적 검사는 각 실행 당시의
진단·수리 증거다. 이 수치들을 합산하거나 최종 통합 실행의 결과로 재사용하지 않는다.

| 실제 명령/검사                                                                                                                                                                    | 결과                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 소유 변경 파일 `prettier --write`                                                                                                                                                 | PASS, parse-safe                                                                                                                                               |
| 소유 관리자 source 8개·admin API·전용 E2E/fixture 대상 ESLint                                                                                                                     | PASS                                                                                                                                                           |
| `vitest run libs/shared-utils/src/api/agent-admin-api.test.ts libs/shared-utils/src/api/agent-admin-export-api.test.ts apps/dwp/src/features/dwaion/dwaion-admin-metrics.test.ts` | 독립 사본 3 files / 7 tests PASS (912ms)                                                                                                                       |
| 최초 `typecheck --incremental false`                                                                                                                                              | DWAI 소유 오류 없음; `use-work-hub-personal-command.test.tsx`의 기존 공유 범위 오류 4건 기록                                                                   |
| 최초 정상 데이터 `--grep normal-data`                                                                                                                                             | 8 PASS / 8 FAIL. 위 a11y 결함과 source locator 불일치를 수정                                                                                                   |
| 기능 상태 `--grep-invert 'normal-data\|reflow'`                                                                                                                                   | 27 PASS / 5 FAIL. 모두 다른 소유 A06 파일을 편집하던 중의 일시적 JSX 모듈 실패                                                                                 |
| 다음 전체 전용 suite                                                                                                                                                              | 66 PASS / 6 FAIL, 3.0분. A06 편집 중 실패·정직한 “AI accuracy를 측정하지 않음” 문구에 대한 잘못된 금지 정규식·403 표시 대기 타이밍을 분리하여 수정             |
| 독립 사본 root 통합 Chromium 전체 264개, `--project=chromium --workers=1 --reporter=line,json`                                                                                    | 전체 253 PASS / 11 FAIL (645.54초). 관리자 전용은 92 PASS / 1 FAIL. A02 퇴역 확인창의 실제 destructive `alertdialog`를 테스트가 `dialog`로 찾았던 오류를 수정. |
| A06 responsive 추출 후 소유 3파일 `prettier --check`·`eslint`                                                                                                                     | PASS. 부모 385줄, 신규 목록 154줄, 전용 coverage 495줄.                                                                                                        |
| 수정 후 `playwright test e2e/dwaion-stitch-coverage.spec.ts e2e/dwaion-admin-conflicts.spec.ts --list --project=chromium`                                                         | 93 tests / 2 files 수집 PASS.                                                                                                                                  |
| 수리 대상 24개 재실행 `admin-final-v1`                                                                                                                                            | **24/24 PASS**, 54.7초, retry/flaky 0. 정상 12개·퇴역 1개·충돌 4개·A06 reflow 5개·A06 API503/empty 2개.                                                        |

전용 suite: `e2e/dwaion-stitch-coverage.spec.ts` 89개와
`e2e/dwaion-admin-conflicts.spec.ts` 4개. Node 24 ESM JSON import attribute를 명시하여
`--list --project=chromium`에서 93개/2파일 수집에 성공했다.
수집 성공은 브라우저 여정 통과를 의미하지 않는다. 전체 264개 결과는
`/tmp/dwaion-final-20260908/all-chromium-v2.result.json`에 실제 전체 argv·시작/종료시각·exit code가,
`all-chromium-v2.json`과 `all-chromium-v2.log`에 개별 결과가 있다. 관리자 단위/format/lint 기록은
`/tmp/dwaion-admin-copy-vitest-20260908.log`, `/tmp/dwaion-admin-a06-prettier-20260908.log`,
`/tmp/dwaion-admin-a06-eslint-20260908.log`, `/tmp/dwaion-admin-copy-collection-20260908.log`다.
root가 수행한 독립 사본 `corepack yarn tsc --noEmit --incremental false`는
`isolated-typecheck-v2.result.json`에서 exit 0이다. A06 responsive 추출 당시 사본의 전체 nonincremental
타입 검사와 DS/i18n/display dictionary도 root가 PASS로 확인했다. 후속 로그는
`isolated-typecheck-final.log`, `ds-final.log`, `i18n-final.log`, `display-final.log`다.
타입이 있는 합성 API fixture: `e2e/support/dwaion-admin-stitch-fixtures.ts`.
CSV 헤더 경계 단위 검사: `libs/shared-utils/src/api/agent-admin-export-api.test.ts`.

모든 A01~A08에 정상 1440px·390px, API 503, VIEW 없음, 빈 값/미측정, 1920px English,
390px Korean, 320px dark,
1280px forced-colors, 640px 200% text reflow 검사를 선언한다. 200%는 좁아진 CSS viewport와
root text 200%를 함께 사용한 text/reflow 검증이며 실제 브라우저 메뉴 zoom과 동일하다고 주장하지 않는다.
정상/고대비/확대 화면의 main과 열린 dialog/alertdialog에서 serious/critical axe 위반 및 document overflow를 검사한다.
A06에서는 목록 각 필드의 viewport 경계·내부 overflow·44px native button·Enter 선택을 추가 검사한다.
A02/A03/A04/A07/A08 390px 선택 상세는 fixed full-screen dialog가 실제 화면 밖의 배경과 혼합되지 않도록
viewport 캡처를 사용하며, 닫기 후 선택 행의 초점 복귀를 확인한다.

`test-results-dwaion-admin-final-20260908/`에는 1440/390/320/dark/forced/200% 캡처가 있다.
이 폴더는 DS ContentDialog 교체 직전의 진단·수리용 반복 실행 증거다.
진단·수리 과정의 캡처 선택 목록은 `/tmp/dwaion-admin-final-captures-20260908.json`이다.
66개 PNG 각각의 SHA-256·실제 테스트 제목·PASS 결과·출처 report를 기록했다. 같은 이름은
두 중간 실행 중 나중인 `admin-final-v1-screens`의 파일을 우선하고, 당시 변경이 없었던
A01/A05와 다른 reflow는 `all-chromium-v2-screens`의 통과 결과를 유지했다.
이는 중간 비교용 원장이며, 경로에 `final`이 포함되어 있어도 최종 통합 승인 캡처나 갤러리를 뜻하지 않는다.
앞선 92/93 실행에서 발견한 A02 locator 실패와 이후 변경 범위를 24/24 재검증한 기록으로,
관리자 전체 93개가 하나의 최종 실행에서 통과했다는 증거로 사용하지 않는다.

해당 24개 수리 대상 재실행의 실제 명령은 다음과 같다. 환경은 `E2E_BASE_URL=http://127.0.0.1:4455`,
`E2E_REUSE_EXISTING_SERVER=true`, Node 24이며 독립 사본 cwd에서 실행했다.

```sh
corepack yarn playwright test \
  e2e/dwaion-stitch-coverage.spec.ts e2e/dwaion-admin-conflicts.spec.ts \
  --grep 'A0[234678] normal-data|A02 searches loaded entries|late version recovery|A02 conflict compares|A06 reflow|A06 API 503|A06 empty or unmeasured' \
  --project=chromium --workers=1 --reporter=line,json
```

`/tmp/dwaion-final-20260908/admin-final-v1.result.json`은 전체 argv·exit 0·UTC 시작/종료시각과
프로세스 총 55.74초를 보존한다. `admin-final-v1.json`의 테스트 집계는 24 PASS, 0 FAIL,
54.654초다. 진단·수리용 PNG는 `/tmp/dwaion-final-20260908/admin-final-v1-screens`에 있다.

| 진단·수리 과정에서 직접 읽은 실제 이미지                                                  | 당시 확인 결과                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A06 정상 1440·390, 1920 wide, 390 Korean, 320 dark, 1280 forced-colors, 640 text200 (7개) | 세트 이름·상태·케이스 수·최근 실행이 모두 표시됨. desktop grid·mobile native button의 키보드 선택과 보이는 focus를 확인. 관측 결과와 비교 불가 설명이 일치하며 내용 잘림·겹침·가로 누락 없음.             |
| A02/A03/A04 inspector 각 1440·390 (6개)                                                   | 실제 revision history, source provider/access/classification/version, owning app/permission/confirmation/version을 확인. 모바일에는 선택 상세와 닫기 버튼만 보이고 fixed dialog 뒤 배경이 이어 붙지 않음. |
| A07/A08 inspector 각 1440·390 (4개)                                                       | Gate의 owner/evidence/정책/만료/검토 행동과 감사 target/actor/time/reason/correlation metadata가 읽힘. Enter 선택·axe·닫기 후 원래 행의 초점 복귀는 정상 테스트에서 통과.                                 |

이전 통합 실행에서는 A01 1440·390, A05 390·text200, A03/A07/A08 모바일 정상과
A02 Korean/A03 forced-colors/A04 dark도 실제 이미지로 검토했다. 당시 수동 검토 17개를
자동 생성된 전체 66개 이미지 모두의 개별 육안 검사로 확대 주장하지 않는다.

## Stitch 원본 이미지와 실제 화면 대조

2026-09-08 Stitch UI ZIP으로 받은 A01~A08 `screen.png` 8개를 실제 이미지로 읽었다.
원본 루트는 `/Users/a10697/Work/DWP/output/dwaion-design-2026-09-08/reference/stitch`이며,
`manifest.json`이 PNG/HTML 경로·크기·SHA-256을 보존한다. HTML 텍스트만 읽고 검수했다고
대체하지 않았다. 초기 이전 캡처 대조 뒤 독립 사본 `all-chromium-v2-screens`의 실제 정상·inspector·reflow 이미지를
추가로 육안 검토했다. A01 1440/390의 기간·시각 배치를 확인했고, A06 1440의 실제 평가 경계를 확인했다.
A06 390에서 내부 잘림을 발견해 responsive 목록으로 수정했고 `admin-final-v1`의 새 캡처와
필드 경계 검증에서 해소를 확인했다. 이전 A06 좁은 캡처는 위 중간 비교용 manifest에서 제외했다.

| 화면 | 원본에서 확인한 시각적 작업 의도                                     | 실제 구현과 적용 판단                                                                                                                                                                                                                                                                                             |
| ---- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01  | 기간·갱신 시각을 헤더 바로 아래, 집계와 예외/관리 이동을 연결        | 서버 기간·생성 시각·실제 분모·권한별 관리 이동을 사용. 원본의 live 수집 지연/개별 component 가용률·보존 배치 성공은 계약 없이 만들지 않음. 좁게 접혔던 생성 시각은 root 수정 후 최신 1440/390 실제 이미지에서 해소 확인.                                                                                          |
| A02  | 필터가 있는 버전 레지스트리와 오른쪽 설명/이력/영향 inspector        | 실제 수명주기·담당자·위험·리비전 목록과 선택 상세, 게시/퇴역 영향 확인. 현재/요청 draft metadata 비교와 version 충돌 복구를 추가. 원본 IN_REVIEW, 승인 단계, 모델 binding, WORM 5년 보장 등 미지원 항목은 복제하지 않음.                                                                                          |
| A03  | 7개 소스의 설정 범위 비교와 선택한 소스 정책/참조 상세               | 7개 실제 source key/provider/classification fixture, 목록/inspector와 변경 비교. CONNECTED는 설정 연결로 해석. 원본 AES-256·ABAC100%·실시간 probe·sync latency·CMEK 보장은 현행 API 증거가 없어 표시하지 않음.                                                                                                    |
| A04  | 앱·위험·권한·handoff 방식에 따른 행동 레지스트리와 원본 앱 최종 권위 | 실제 4개 action key의 담당 앱을 표시하고 최종 사용자/원본 앱 검토 경계 유지. 정책 비교·사유·최신 version 재검토 제공. 원본 앱 health·dry run·연결 agent 영향 건수는 미지원.                                                                                                                                       |
| A05  | 고정 원칙과 수정 가능한 정책을 분리하고 검토 가능한 저장             | 고정 차단/근거 상태를 읽기 전용으로 유지하고 처리 방식·예산·변경 사유를 편집. 중복 Select 시각 라벨은 이름을 유지한 aria-label로 정리. live simulator·100% masking·confidence75%·2인 서명은 만들지 않음.                                                                                                          |
| A06  | 평가 세트/케이스와 선택 실행의 expected/observed 증거                | 실제 set/case/run 목록·관측 grounding/term 표본과 CSV를 사용. 94.2% 정확도/+1.8% 향상·동일 조건 회귀 비교를 만들지 않고 비교 불가 사유를 표시. history의 회귀 비교 설명 모순은 root 수정 후 1440에서 해소 확인. 좁은 세트 표는 responsive 버튼 목록으로 수정 후 정상/확대/언어/대비 변형과 직접 이미지 검수 통과. |
| A07  | 환경 범위·Gate 준비 상태·증거/검증/독립승인 순서와 선택 상세         | 13개 실제 Gate, 환경 API 변경, compact 4단계 절차, owner/evidence/policy/expiry 상세. 사용자 기록 검증과 승인자 자격을 사용. 원본 자동진단·health probe·서명체인·WORM 영구보장은 복제하지 않음.                                                                                                                   |
| A08  | 감사 조회를 우선하고 사건 metadata inspector 및 독립 보존 편집       | 감사 서버 검색/범주/페이지를 위에, 보존 폼을 뒤로 배치하고 중복 로컬 필터 제거. 실제 export cap/truncation 헤더를 보존. 원본 암호학적 무결성100%·물리 삭제 완료·WORM·서명 검증은 API 증거 없이 주장하지 않음.                                                                                                     |

원본에 나타난 파란 선택 배경·목록/상세의 위계·업무 경계의 문맥은 현재 DWP design-system
컴포넌트로 구현한다. 원본 serif fallback 글꼴, 과도한 요약 카드, 접힌 라벨이나 잘린 텍스트를
pixel 단위로 복제하는 것은 목표가 아니다. 실제 API에 없는 숫자로 비어 있는 공간을 채우지 않았다.

## 외부 운영 조건과 범위

운영 모델 연결·실제 connector 연결 시험·source ACL 진단·관리 KMS·조직 DLP·독립 승인자·
실제 물리 삭제 실행 증거는 운영 환경에서 별도로 확인해야 한다. 이 작업은 관련 성공 상태를 만들지 않았다.

A02의 별도 다단계 게시 승인/실행 Studio, A03의 실제 연결 검사·지연, A04의 사용자별 무변경 정책 시험,
A05의 정책 시뮬레이션·런타임 강제 증적, A06의 버전 동등성 판정·비동기 취소,
A07의 자동 진단 실행·서명된 결과 수집, A08의 삭제 영향 건수·삭제 완료 증거는 현재 계약으로
제공되지 않는다. 이 목록은 화면으로 가장한 구현 완료가 아닌 외부/신규 계약 경계다.

## 최종 통합 승인 증거

통합 Chromium v3는 전체 **291/291 PASS**이며, 관리자 두 spec은 **93/93 PASS**다
(`dwaion-stitch-coverage.spec.ts` 89개 + `dwaion-admin-conflicts.spec.ts` 4개).
관리자 재시도·flaky·skipped는 모두 0이다.

- [최종 통합 Chromium v3 보고서](implementation-evidence/2026-09-08/final-gallery/reports/run-1.json)
- [최종 승인 갤러리](implementation-evidence/2026-09-08/final-gallery/index.html)
- [갤러리 캡처·테스트 연결 및 SHA manifest](implementation-evidence/2026-09-08/final-gallery/manifest.json)

A02/A03/A04/A07/A08 inspector의 1440px·390px PNG 10장을 독립적으로 직접 검수했고,
각 v3 정상 case의 passed 결과 연결과 원본·갤러리·manifest SHA 일치 **10/10**을 확인했다.
