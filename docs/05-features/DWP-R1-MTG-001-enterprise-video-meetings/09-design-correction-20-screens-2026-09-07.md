# Meetings 승인 디자인 20면 재감사와 보정

## 기준과 판정 원칙

2026-09-07 사용자 첨부는 U06–U15의 desktop/mobile 20개다. 같은 [Stitch 프로젝트](https://stitch.withgoogle.com/projects/13391261371843159731)를 브라우저에서 다시 열어 20개 실제 화면명을 확인했고, 사용자 export ZIP의 각 `screen.png`/`code.html`을 담당자가 직접 읽었다. ZIP SHA256은 `0a2fc4d7881a01f9b3ba0e6f164f3b9f980f8aa8afc53c29ea53afecb5d22787`이다. U01–U05를 이 20개에 섞어 수량을 부풀리지 않는다.

기존 `30/30 구조 합격`은 디자인 합격 근거로 철회한다. source hash는 원본 식별만 입증하며, 구현을 다시 찍은 golden은 그 구현의 회귀만 입증한다. 두 증거를 조합해 원본 충실도라고 보고한 수용 기준이 잘못됐다. 이번 검증은 기존 golden을 자동 갱신해 녹색으로 만들지 않고 원본과 변경 후 PNG를 직접 대조한다.

## 원인과 추가 개발 설계

| 화면 D/M           | 확인된 원인                                                                                                            | 수정 설계/연결                                                                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U06 실제 회의실    | shell을 덮는 fullscreen, 거대한 단일 avatar, 읽기 전용 의제+별도 drawer, `--mui` CSS 변수가 실제 `--dwp` 테마와 불일치 | desktop shell 내 slate 무대/하단 참가자/밝은 우측 패널, mobile immersive 유지, 타이머·투표·Q&A를 기존 실제 service 명령으로 패널에 embed, 미디어 없을 때 명확한 대기 무대 |
| U07 기록           | 개별 결과 카드와 필터/inspector를 divider list와 수치로 축소                                                           | 개별 tonal 카드, 주최자/날짜/역할/정렬, 요약·파이프라인·미디어 inspector. mobile 필터만 명시 펼침, 기록은 기본 노출                                                       |
| U08 AI 결과        | cited text를 문자열로 평탄화해 카드별 타임코드 상실, mobile 분석 숨김                                                  | 결정/실행별 원래 citations 연결, 5단계 결과 파이프라인, 모바일 주제·대화흐름·위험 기본 노출                                                                               |
| U09 후속 업무      | 목록 1개/미선택 fixture가 빈 inspector를 정상으로 수용, 후보/업무 맥락 단절                                            | 상태 요약+선택 inspector+담당/기한, 현재 게시 report의 정확한 candidate/version을 확인하는 근거 조회                                                                      |
| U10 템플릿         | 원본 목록+overview+security/share/import 영역을 최소 목록으로 축소                                                     | 다중 카드/선택 상세/공유, JSON import 검증→검토→기존 create, 실제 권한/버전 사용                                                                                          |
| U11 개인 회의실    | identity/정책 inset/session/history/QR를 설명 문장으로 대체                                                            | identity CTA/정책 카드/상태/이력, 외부 전송 없는 실제 초대 URL QR, 초대 회전 시 갱신                                                                                      |
| U12 장치·설정      | 원본 상단5탭+8:4을 3열로 변경, 진단/배경/HD/save dock 삭제                                                             | 상단5탭/저장 범위 banner/8:4 폼+진단, 미지원 설정도 원본 위치에서 이유 노출, mobile 저장 dock와 global nav 중복 제거                                                      |
| U13 운영           | 4대 서비스 카드·컨트롤바·사고 상세를 숫자/행으로 축소                                                                  | 독립 서비스 카드, metadata-only 예외 카드와 진단 inspector, 실제 조회/필터                                                                                                |
| U14 정책           | mobile 정책 대부분 기본 접힘, sidebar grid span 빈 공간                                                                | 원본 순서로 펼친 정책/tonal controls/영향 sidebar/저장 bar, 실제 변경·충돌 경계 보존                                                                                      |
| U15 AI·데이터 관리 | 모델/파기/법적보존/운영 block을 readiness 목록으로 대체                                                                | seven-stage 카드/모델·파기·보존 workbench, mobile cobalt 상태와 원본 상세 노출 방식                                                                                       |

담당자별 상세: `09-review-U07-U09-2026-09-07.md`, `09-review-U10-U12-2026-09-07.md`, `09-review-U13-U15-2026-09-07.md`.

## 구현 경계

새 DB 테이블을 추가하지 않는다. 원본 누락의 주된 원인은 API가 아니라 presentation과 연결이었다. timer/poll/Q&A, published intelligence report, Work assignment, template/personal room/preferences, admin policy/readiness의 기존 권한·버전·보존 계약을 사용한다. QR는 qrcode.react SVG로 클라이언트 내 생성하며 초대 URL을 외부 이미지 서비스에 보내지 않는다.

자료를 숨기거나 가짜로 만들지 않는다. 계약 없는 녹화 미디어/인프라 수치/인증/운영 명령은 원본 visual slot 안에서 연결 필요 또는 비활성 사유로 표시한다. 디자인의 샘플 미디어는 운영 녹화로 사용하지 않는다. UI fixture에서 보이는 데이터는 운영 seed나 provider 준비 증거가 아니다.

## 검증 실행

`e2e/video-meeting-design-review-20.spec.ts`는 각 1440×960/390×844 viewport와 실제 full document를 캡처한다. 임의로 모바일 viewport를 수천 px로 늘려 접힘/고정 버튼 결함을 숨기지 않는다. screenshot을 찍은 뒤 overflow/axe serious·critical/runtime exception을 확인한다. 디자인 차이가 없다는 자동 점수는 생성하지 않는다.

병렬 검토용 `e2e/support/meeting-design-review.vite.config.ts`는 정본 Vite 설정을 재사용하고 최적화 cache만 포트별 분리한다. 서로의 React 최적화 cache를 다시 써 dynamic import/hook 오류를 유발하지 않도록 한다. 공통 Gateway/다른 제품은 수정하지 않는다.

## 2026-09-07 교정 결과와 증거

[20개 원본·구현 비교 보기](/Users/a10697/Work/DWP/output/meeting-design-review-2026-09-07/index.html). 사용자 export 원본 20장과 최신 정본 Yarn 개발 서버(:4200)의 viewport/document 캡처 40장을 보관했다. desktop 1440×960, mobile 390×844를 유지하고 U06은 320px 버튼 도달성도 확인했다. 실제 Chrome의 최준빈 계정에서 템플릿 합성 seed 8개와 상세·가져오기·공유 제어가 렌더되는 것을 확인했다. stale Vite React cache의 `useRef` null 오류는 정본 `yarn dev --force` 재기동 후 사라졌다.

| Gate                                                        | 결과                                                              |
| ----------------------------------------------------------- | ----------------------------------------------------------------- |
| 정본 Yarn :4200 원본 20화면 capture/runtime/axe/overflow    | 20/20 PASS                                                        |
| Meeting+API unit                                            | 71 suites, 770/770 PASS                                           |
| 실제 Conference 권한 초기 거부·철회·금지 전환               | unit 10/10 PASS, 위 집계에 포함                                   |
| U07–09 Work/정확한 보고서 출처·권한 회수                    | 54/54 PASS                                                        |
| CI visual-quality + 라이브러리 필터·dark/200%/고대비        | 27 PASS, project 중복 17 SKIP, 실패 0                             |
| U06 실제 timer/Q&A/vote command + revoke + 좁은 header      | 7 PASS, desktop 중복 1 SKIP, 실패 0                               |
| U10–12 기능/import/share/QR/preferences + 자체 회귀         | 34 PASS, project 중복 4 SKIP, 실패 0                              |
| U13–15 운영/정책/거버넌스, dark/부분 실패/320·390·1280·1440 | 25/25 PASS                                                        |
| Backend `:dwp-meeting-server:check`                         | 523 cases: 522 PASS, 1 SKIP, 실패/오류 0 (PostgreSQL suites 포함) |
| scoped ESLint·Prettier·diff, 전체 i18n/source-size          | PASS                                                              |
| 전체 non-incremental typecheck                              | 0 오류 PASS 회수; 다른 제품 동시 편집 중간 오류는 별도 기록       |
| Vite production compilation                                 | PASS, 전체 `yarn build` PASS와 구분                               |

전체 `yarn build`는 회의 외 Work shell의 디자인 시스템 root-barrel 정적 import 2건에서 차단되었다. 직접 compilation 후 bundle budget도 초기 정적 의존성 raw/gzip/request 한도를 초과했다. 디자인 시스템 신규 회귀는 0이나 기존 JSX 감소 27개의 공통 baseline 하향이 남아 중앙 통합에 전달했다. 다른 제품·공통 기준을 변경하거나 한도를 높이지 않았다.

기존 U06/U10/U11/U12 및 CI 회귀 PNG는 원본 대조로 확인한 변경만 다시 캡처하고, `--update-snapshots=none` 재실행까지 통과했다. 이는 수정된 구현의 회귀 기준이지 사용자의 디자인 승인이나 100% 원본 일치 점수가 아니다. 종전 중앙 `meeting-approved-frame-contract`의 30면/hash/임의 확대 높이 기반 판정은 이번 20면의 최종 수용 증거로 사용하지 않았으며 자동 재승인하지 않았다.

## 추가로 발견하여 보정한 실제 결함

- 라이브러리 주최자·역할이 backend `HistoryItemResponse`와 frontend normalizer에서 유실됐다. 기존 권한으로 조회된 MeetingCard의 `organizerUserId`, `organizerName`, `participantRole`, `canHost`를 additive projection했다. older 응답은 빈 이름/non-host로 호환하고 이름이나 역할 문자열로 추가 권한을 추론하지 않는다. backend projection 6개와 API 2개 새 회귀, 실제 주최자 필터 여정으로 확인했다. 공통 OpenAPI export/sync는 중앙 통합에 변경 필요를 인계했다.
- 새 rail 참가자 탭이 하단 버튼의 권한 경계를 우회했다. tab/filter, 선택 handler, synchronous render 모두 credential permissions로 제한하고 권한 회수 시 즉시 unmount·재허용 자동 재노출 방지를 확인했다.
- inline Modal을 body 기준으로 관리하면 상위 root가 aria-hidden이 되어 화면만 보이고 접근성 트리에서 이름이 사라졌다. portal container를 실제 main으로 제한했고 live 행동 E2E의 접근 가능한 버튼·axe로 재검증했다.
- desktop light rail의 잔여 회색 글자와 dark AI pipeline 녹색 대비, mobile save dock/내비 중복, 320px 나가기 버튼, 배경과 테두리 덮어쓰기, roving focus를 보정했다. mobile 포커스는 rail 탭까지 포함하고 desktop은 해당 inline rail에 갇히지 않는다.
- embedded 도구와 drawer의 title ID를 React useId로 분리했다. preparation cache key를 통일하고 desktop에서 숨겨진 mobile summary의 별도 polling을 비활성화했다.

## 남아 있는 기능 계약과 추가 개발 설계

다음은 완료로 가장하지 않는 명시적 잔여다. 기존 데이터의 권한/보존 경계를 먼저 연결해야 하며 버튼·샘플 값만 만들어 성공으로 표시하지 않는다.

| 화면                                                     | 필요한 정본 설계                                                                                                                                                                                      | 데이터/검증 경계                                                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| U07 기록 즐겨찾기·공유/검토 집계·실제 media availability | 사용자별 `vm_meeting_record_preferences(tenant_id,user_id,meeting_id,favorite,version,updated_at)` 복합키, 공유는 별도 대상·기한·revocation 계약; 목록에는 현재 viewer가 접근 가능한 결과 존재만 투영 | tenant/user/meeting 3중 권한, 삭제 시 개인 projection 정리, 원문/접속 ticket 미저장. 현재 목록 recording/transcript=false를 임의 true로 바꾸지 않음 |
| U08/U09 담당자 표시명·체크리스트·후보 생성/게시          | Work가 checklist/status/assignee의 정본. Meeting은 현재 source report/candidate/version 참조만 유지. 인명은 authorized directory projection, 변경은 Work command+version+idempotency                  | 이중 task table 금지, report retention/게시 철회 시 근거 즉시 제거. 비공개/만료 report 12개 negative unit 유지                                      |
| U10 사용 통계·AI 추천                                    | 템플릿 적용 성공 이벤트를 tenant/template/version 단위 비식별 집계. 추천은 승인 모델/처리 동의 뒤 opt-in 별도 기능                                                                                    | 샘플 사용 횟수/효과/AI confidence 생성 금지. 회의 내용과 참석자를 template export에 포함하지 않음                                                   |
| U12 blur/background/HD 및 연결 품질                      | 미디어 제공자 capability와 브라우저 지원을 확인한 local preview→명시 적용. 실제 연결 품질은 LiveKit stats 기반 별도 metadata 계약                                                                     | 지원 전 disabled 이유 표시, 장치 ID는 브라우저/계정 결속 local preference. 이미지 업로드는 유형·크기·폐기 기준 추가 필요                            |
| U13 telemetry/export/failover                            | tenant-scoped 집계 및 incident 상세 API, export는 bounded artifact job, failover는 idempotent approval command                                                                                        | 미디어/회의 제목 원문 없는 지표, 권한·사유·영향도·감사·복구 계약. 샘플 SLA·지연 생성 금지                                                           |
| U14 domain/부재 timeout/동의·고지/template approval      | 기존 tenant policy에 versioned additive fields; domain child table은 `(tenant_id,normalized_domain)` 유일키. host absence는 실제 lifecycle lease와 결속                                               | authoritative validate→impact preview→승인→fenced update+audit 원자 transaction, stale version/승인 회수 회귀                                       |
| U15 법적 보존/파기 증적/고위험 명령                      | 기존 retention worker와 삭제 evidence 정본을 tenant-scoped bounded read model로 노출. legal hold는 승인 주체·사유·기간·대상 hash·version을 가진 별도 기록                                             | worker heartbeat/lease/fence, 키 폐기 증거, 보존 해제 승인. UI는 원문 열람 권한을 부여하지 않음                                                     |

외부 LiveKit/TURN/Egress/KMS/STT/LLM/실제 삭제 종단은 운영 NO-GO다. 사용자·관리자 20면 presentation 교정 및 검증과 외부 기능 운영 완료를 구분한다. 공통 셸은 다른 앱과 동일한 레이아웃을 보존했으므로 Stitch의 독립 샘플 셸과 픽셀 단위로 동일하지 않다. U14는 기존 협업/수용 기능을 보존해 원본보다 길다. 이 차이들을 포함해 전체 100% 완료로 판정하지 않는다.
