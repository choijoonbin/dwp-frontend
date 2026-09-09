# U08 게시 리캡 배포와 후보 인계 검증 (2026-09-08)

## 판정과 사용자 목표

이 범위의 판정은 `VERIFIED_IMPLEMENTATION_NOT_PRODUCTION_RELEASE`다. 게시된 회의 리캡을 현재 접근권한으로 다시 확인해 JSON 또는 Markdown으로 내려받고, 접근권한을 부여하지 않는 링크를 복사하며, 리캡의 특정 후속 업무 후보를 `CANDIDATES` 작업공간에 정확히 인계하는 코드와 회귀 증거를 완료했다.

- 주 사용자: 게시 리캡을 볼 수 있는 현재 회의 참여자 또는 명시적 ACL 보유자
- 사용자 질문: 이 게시본을 안전하게 배포할 수 있는가, 선택한 후속 업무 후보를 정확히 이어서 처리할 수 있는가
- 핵심 행동: 접근 확인 링크 복사, 버전 고정 JSON/Markdown 내보내기, 선택 후보의 Work 생성 화면 인계
- 화면 원형: 게시 결과 레코드의 governed distribution strip과 evidence-first candidate handoff

## 구현된 배포 경계

링크 복사는 `https` 또는 `http` origin과 정규 UUID만 허용한다. 링크에는 `/meetings/history?meeting=<uuid>&reportId=<uuid>`만 들어가며 보고서 본문, 사용자 정보, ACL 또는 임시 다운로드 URL은 들어가지 않는다. 링크 자체는 권한을 부여하지 않고 대상 화면의 현재 조회 경계가 다시 접근을 판정한다.

파일 내보내기는 다음 계약으로 동작한다.

1. 화면은 게시된 정확한 `reportId`와 관측한 `report.version`을 `POST /v1/meetings/{meetingId}/intelligence/reports/{reportId}/exports`에 보낸다. `expectedReportVersion`은 1 이상의 정수이며 JSON 또는 Markdown만 허용한다.
2. 동작은 `route.meetings.work.intelligence-report-export.action`을 통해 실행되고 서버의 전용 capability와 PEP가 먼저 적용된다.
3. Meeting 서비스는 tenant 내 회의 잠금, 현재 참여자, DENIED 상태, 명시적 ACL, `PUBLISHED`, `MEETING_PARTICIPANTS`, 보존 만료와 legal hold, 정확한 보고서 버전을 다시 확인한다. 실패 시 보고서 존재와 내용을 숨기고 복호화와 감사 기록을 시작하지 않는다.
4. payload protector가 `available`과 `ready`를 모두 충족해야 한다. 복호화한 payload의 SHA-256이 저장된 digest와 다르거나 JSON을 해석할 수 없으면 fail-closed한다. 평문 byte 배열은 사용 후 지운다.
5. 출력은 2,000,000 byte로 제한한다. Markdown의 사용자 텍스트는 active markup을 이스케이프하고, JSON은 export schema, 보고서 식별자·버전·보존 정보와 분석을 구조화한다.
6. 파일을 반환하기 전에 같은 transaction에서 metadata-only `DATA_EXPORT` outbox를 기록한다. 감사 payload에는 형식, 버전, 크기, digest와 객체 식별자만 있고 리캡 또는 전사 본문은 없다. outbox insert가 실패하면 응답 파일도 반환하지 않는다.
7. 응답은 attachment, `no-store`, `no-cache`, `nosniff`, `X-DWP-Report-Version`, `X-DWP-Content-SHA256`을 포함한다. 클라이언트도 저장 전에 Blob 크기·MIME, 정확한 버전 헤더와 WebCrypto SHA-256 digest를 확인한다. 헤더가 없거나 다르면 로컬 파일을 만들지 않는다.

버전과 digest를 클라이언트에서도 확인한 이유는 다운로드 응답이 현재 화면에서 관측한 게시본과 같은 byte인지 마지막 경계에서 확인하기 위해서다. SHA-256 헤더는 서버 서명 대신 같은 TLS·권한 경계에서 전달되는 무결성 증거이며, 서버 또는 TLS 신뢰가 손상된 상황을 독립적으로 인증하는 수단은 아니다.

## 정확한 후보 인계

리캡의 `Review candidate`는 현재 보고서의 `candidateId`, `actionItemIndex`, `sourceVersion` 조합에서만 내용을 연다. 계속 버튼은 `/meetings/follow-ups?scope=CANDIDATES&candidateId=<uuid>`로 이동한다. 목적 화면은 쿼리의 UUID를 신뢰해 바로 상세 조회하지 않고, 먼저 현재 사용자가 볼 수 있는 bounded candidate 목록을 받은 뒤 그 목록에 정확히 존재하는 ID만 선택한다. 알 수 없거나 중복된 `candidateId`는 다른 후보로 대체하지 않으며 읽기 또는 생성 mutation을 보내지 않는다.

선택 이후 Work 생성은 Meeting 후보의 canonical source tuple과 `expectedSourceVersion`, 새 UUID command ID를 owner endpoint에 전달한다. 서버의 현재 authority, source publication/access/version 및 멱등성 판정이 최종 생성 여부를 결정한다.

모바일의 전체 화면 후보 검토 drawer에도 같은 현재 권한 기반 `Create work from candidate` 동작을 둔다. 이 동작은 44px 이상의 터치 영역을 제공하며, drawer가 닫히는 transition이 끝난 뒤 생성 확인 dialog를 열어 두 modal의 focus trap이 경쟁하지 않게 한다. 확인 dialog는 파괴적이지 않은 취소 동작에 첫 focus를 두고, 취소하면 원래 `Review candidate` 동작으로 focus를 복원한다. 동기적인 중복 확인도 하나의 정확한 source/version-bound mutation만 전송한다. 데스크톱 카드의 기존 생성 동작은 유지한다.

이 보정은 전용 `--mode test` 서버의 Chromium·mobile 전체 U09 spec에서 22/22 통과했다. 390px·320px 모바일 검토 화면 2장과 Work 정본 연결 이후 높이가 44px 줄어든 legacy Chromium·mobile 화면 2장만 갱신했고, 같은 서버에서 update 없는 재실행으로 확인했다. 원본 크기 육안 검토와 좌상단 red-pixel 검사에서 Vite checker 배지, focus된 skip link, 가로 overflow가 없었다. 보정 증거와 네 이미지의 SHA-256은 `/Users/a10697/Work/DWP/output/meeting-recap-mobile-create-2026-09-08/manifest.json`에 있다.

## 독립 검증 결과

중복되는 수치를 합쳐 전체 제품 테스트 수로 해석하지 않는다.

| 검증                                                    | 결과                             |
| ------------------------------------------------------- | -------------------------------- |
| frontend distribution/navigation/runtime/API unit       | 5 files, 73/73 PASS              |
| backend export service/controller contract              | 13/13 PASS                       |
| 실제 PostgreSQL `sys_audit_outbox`/access/version fence | 3/3 PASS, skip 0                 |
| Chromium + mobile U07/U08 journey                       | 10/10 PASS, skip/failure/flaky 0 |
| 전체 non-incremental TypeScript                         | PASS, 오류 0                     |
| 소유 파일 ESLint                                        | PASS, 오류/경고 0                |
| 소유 파일 Prettier와 양 저장소 `git diff --check`       | PASS                             |

PostgreSQL 테스트는 Testcontainers PostgreSQL 16과 실제 migration, repository, `AuditOutboxRecorder`, transaction을 사용한다. 성공 시 metadata-only outbox 행이 commit되는 것, DENIED 참여자와 오래된 버전이 payload/audit 전에 거부되는 것, DB trigger로 audit insert를 실패시키면 파일 응답 없이 rollback되는 것을 확인했다. 이는 outbox DB 원자성의 증거이며 downstream audit consumer의 전송 성공 증거는 아니다.

브라우저 최종 실행은 공유 개발 서버를 재사용하지 않고 전용 포트 4478의 fresh `--mode test` 서버로 수행했다. 최종 PNG 4장을 직접 열어 Vite checker 오류 배지와 포커스된 `Skip to main content` 링크가 없고, 390px에서 조작 영역·증거·접힌 상세 분석 순서와 다운로드 성공 피드백이 유지되는 것을 확인했다. 예비 공유 서버 실행의 실패 캡처는 최종 증거로 사용하지 않는다.

## 증거와 재현 경로

- 해시·크기·검증 결과 manifest: `/Users/a10697/Work/DWP/output/meeting-recap-distribution-2026-09-08/manifest.json`
- 최종 Playwright 로그: `/Users/a10697/Work/DWP/output/meeting-recap-distribution-2026-09-08/logs/playwright-final.log`
- 최종 unit 로그: `/Users/a10697/Work/DWP/output/meeting-recap-distribution-2026-09-08/logs/vitest-final.log`
- type/lint/format 로그: `/Users/a10697/Work/DWP/output/meeting-recap-distribution-2026-09-08/logs/typecheck-final.log`, `eslint-final.log`, `prettier-final.log`
- 최종 Chromium/mobile PNG: `/Users/a10697/Work/DWP/output/meeting-recap-distribution-2026-09-08/e2e-pass`
- backend JUnit XML과 요약: `/Users/a10697/Work/DWP/output/meeting-recap-distribution-2026-09-08/backend-test-results`

```sh
# frontend
corepack yarn vitest run \
  apps/dwp/src/features/meetings/meeting-recap-distribution.test.tsx \
  apps/dwp/src/features/meetings/meeting-recap-candidate-model.test.ts \
  apps/dwp/src/features/meetings/meeting-follow-ups-navigation.test.ts \
  apps/dwp/src/features/meetings/meeting-follow-ups-runtime.test.ts \
  libs/shared-utils/src/api/video-meeting-intelligence-api.test.ts
corepack yarn tsc --noEmit --incremental false --pretty false
DWP_FRONTEND_DEV_PORT=4478 \
E2E_BASE_URL=http://127.0.0.1:4478 \
corepack yarn playwright test e2e/video-meeting-library-recap-navigation.spec.ts \
  --project=chromium --project=mobile --workers=1

# backend
./gradlew :dwp-meeting-server:test \
  --tests 'com.dwp.services.meeting.videomeeting.domain.MeetingIntelligenceReportExportServiceTest' \
  --tests 'com.dwp.services.meeting.videomeeting.api.MeetingIntelligenceReportExportControllerContractTest' \
  --tests 'com.dwp.services.meeting.videomeeting.domain.MeetingIntelligenceReportExportPostgresTest' \
  --rerun-tasks
```

## 운영 전제

운영에서는 tenant에 대해 실제 KMS-backed payload protector가 available/ready여야 하고, published report·ACL·retention/legal-hold projection이 정본 DB에 있어야 한다. Product Surface capability/PEP 배포, Gateway 경로, CSRF와 TLS, audit outbox consumer·보존·모니터링도 정상이어야 한다. WebCrypto를 제공하지 않는 브라우저는 파일을 저장하지 않고 실패 상태를 표시한다.

다운로드한 사본은 서비스의 보존 삭제로 자동 제거되지 않는다. 화면은 조직의 정보 취급 정책에 따라 저장·삭제해야 함을 명시한다. 실제 고객 데이터로 KMS 복호화, downstream audit delivery, 보존 만료 삭제, 법적 보존 해제까지 수행한 운영 canary는 이 코드·Testcontainers 검증에 포함되지 않으므로 전체 제품 출시 완료로 판정하지 않는다.
