# 통합업무 앱 Stitch 구현 보완 완료 보고

기준일: 2026-09-09

## 판정

전달받은 [Google Stitch 프로젝트](https://stitch.withgoogle.com/projects/13391261371843159731)의 라이브 캔버스를 사용자 중단 전에 직접 열어 감사했다. 라이브 프로젝트의 **18개 노드가 보관된 기준 manifest의 18개 노드와 모두 일치**했다. 업무 앱의 탐색 계약은 **6개 메뉴·6개 경로**이며, 현재 Work가 소유하고 활성 계약이 제공된 화면·행동·복구 여정은 구현했다.

이 판정은 픽셀 동일성, 실제 테넌트 운영, 외부 원천 승격 또는 배포 완료를 뜻하지 않는다. 정확한 현재 검증 상태와 최종 수치는 [검증 JSON](implementation-evidence/2026-09-08-stitch-completion/validation.json)을 기준으로 한다. 최종 Work 소스 192개 파일은 검증 전후 SHA256 manifest가 일치했고 모든 필수 검사가 통과했다.

## 라이브 디자인 기준 감사

- 프로젝트 ID: `13391261371843159731`
- 라이브 확인 결과: 18/18 노드 일치, 누락 0, 추가 불일치 0
- 보관 manifest SHA256: `a655ec178d0bc03d773a0a21dfc8d717c174ac2d264048171f205bb3eac81cf2`
- 직접 확인 시점: 2026-09-09 사용자 중단 이전의 현재 작업 세션. 정확한 시각은 별도로 기록되지 않았다.
- 중단 이후 재확인: 시도했으나 로컬 Mac 잠금 상태 때문에 UI를 다시 열 수 없었다. 이 실패를 새로운 라이브 감사로 계산하지 않았고, 중단 전 완료한 직접 대조 결과만 기록했다.
- 상세 노드와 제한 사항: [라이브 Stitch 감사 기록](implementation-evidence/2026-09-08-stitch-completion/live-stitch-audit.json)

보관 기준의 18개 프레임은 데스크톱 11개와 모바일 7개다. 디자인 세트 자체에는 실제 dark, forced-colors, 320px, 200% 프레임이 없으므로 이 환경은 제품 브라우저 검증으로 보완했다. 원본과 구현 스크린샷의 구조·행동 대조는 픽셀 오차 0% 인증이 아니다.

## 6개 메뉴·경로

| 메뉴         | 경로                      | 기본 질문                         |
| ------------ | ------------------------- | --------------------------------- |
| 통합업무함   | `/work/queue`             | 지금 확인하거나 처리할 업무는?    |
| 내 조치 대기 | `/work/action-required`   | 지금 내 행동이 필요한 업무는?     |
| 오늘 계획    | `/work/day-plan`          | 오늘 수행하도록 계획한 업무는?    |
| 진행 중      | `/work/in-progress`       | 이미 시작해 수행 중인 업무는?     |
| 응답 대기    | `/work/awaiting-response` | 다른 사람이나 외부 응답 대기는?   |
| 완료된 업무  | `/work/completed`         | 종료된 업무와 결과를 어디서 보나? |

각 경로는 동일한 쿼리 화면을 이름만 바꾼 메뉴가 아니다. 경로별 scope, 결과 수, 필터·정렬·선택, 상세 진입과 모바일 복귀를 유지한다.

## 이번 보완에서 닫은 Work 범위

### Meeting 출처의 Work 배정 업무

- `WORK_ASSIGNMENT`를 통합업무 원천으로 연결하고 `내가 담당`과 `내가 요청`을 별도 scope로 모두 페이지 끝까지 조회한다.
- 목록의 정상 원천 상태는 `NOT_REQUESTED`로 유지한다. 목록 행마다 Meeting 원본을 조회하거나 연결 실패로 표시하지 않는다.
- 상세에서 배정 상태와 수행 상태를 분리하고, 요청자·담당자·현재 capability에 따라 수락, 거절, 시작, 응답 대기, 재시작, 완료, 취소만 노출한다.
- 명령 직전 현재 version과 assignmentRevision을 다시 검증하고 UUID 멱등 키를 사용한다. 응답 유실은 기존 receipt로 확인하며 409 충돌은 자동 재전송하지 않고 최신 상태 검토로 전환한다.
- 원천이 `UNAVAILABLE`이어도 Work가 소유한 확정 조건과 허용된 수행은 유지한다. 원천 reference, route, version은 숨긴다.
- 권한이 회수되면 이전 상세·행·행동을 제거한다. 늦은 응답이나 과거 캐시로 민감 정보를 다시 표시하지 않는다.
- assignment/source/user/event/audit 식별자와 raw reason code를 일반 사용자 문구와 DOM 메타데이터에서 제외했다.
- 개인 할 일의 체크리스트·오늘 계획·Calendar·AI·Activity·일괄 완료 행동을 배정 업무에 잘못 적용하지 않는다.

### 기존 18프레임 계약

- 결재와 서비스 요청은 풍부한 읽기 전용 근거를 제공한 뒤 검증된 소유 앱으로 이동한다.
- 접근권한 검토와 개인 업무는 Work 소유 명령을 최신 권한·version과 결속한다.
- 개인 업무 생성·편집·체크리스트, 오늘 계획, Calendar 시간 연결, 원천 부분 실패·복구, Flow Home 기여, 선택 업무 AI 읽기·출처·복사·이어가기 계약을 유지한다.
- 모바일 전체 상세, 하단 탐색, 목록 복귀 focus, 키보드 dialog 닫기와 focus 복원을 유지한다.

## 의도적으로 활성화하지 않은 외부 계약

Meeting 후보에서의 **CREATE/by-source**와 실제 타인 대상 **REASSIGN**은 현재 **NO-GO**다. 필요한 Meeting 현재 authority, People 대상자 적격성, 허용 대상·정책 선택 계약과 수신부 종단이 제공되지 않았기 때문이다. Work 화면은 서버의 현재 `canReassign=false`와 capability를 그대로 따른다.

이 경계는 Work UI 구현 누락이 아니다. 임의 사용자 ID 입력이나 전체 사원 목록 노출, 광범위 권한 허용으로 빈 계약을 메우면 권한 우회와 잘못된 배정을 만들 수 있으므로 fail closed 상태를 유지한다. Work가 소유한 기존 배정 조회·수락·수행·취소·복구는 이 외부 원천 승격과 독립적으로 동작한다.

## 현재 검증 증거

| 검사                         | 최종 기록                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 배정 중심 단위 검사          | 16 files / 139 tests 통과. [로그](implementation-evidence/2026-09-08-stitch-completion/logs/focused-assignment-unit.log)                                             |
| 배정 브라우저 검사           | 34 등록, 30 통과, 증거 중복 mobile 4개 명시 제외, 실패·불안정 0. [로그](implementation-evidence/2026-09-08-stitch-completion/logs/assignment-playwright.log)         |
| 반응형 증거                  | 1440 light, 1280 CSS 200%, 390 dark, 320 forced-colors. [manifest](implementation-evidence/2026-09-08-stitch-completion/screens/manifest.json)                       |
| 전체 Work 브라우저 회귀      | 346 등록, 322 통과, 사양에 명시된 프로젝트·증거 중복 24개 제외, 실패·불안정 0. [로그](implementation-evidence/2026-09-08-stitch-completion/logs/work-playwright.log) |
| 전체 단위·TypeScript·build   | 546 files / 4,459 tests, 비증분 TypeScript, 전체 정적 gate와 production build 통과                                                                                   |
| 배정 backend                 | 5 files / 42 tests를 `--rerun-tasks`로 새로 실행해 실패·오류·skip 0                                                                                                  |
| format·diff·source integrity | 전체 Prettier와 whitespace 검사 통과. Work 소스 192개 파일의 전후 manifest SHA256 일치                                                                               |

배정 브라우저 검사는 가로 넘침 1px 이하, 보이는 상세 버튼 44×44px 이상, 키보드 진입·Escape·focus 복원, 긴 한국어, 권한 회수, 원천 불가, 충돌·응답 유실 복구를 확인했다. axe 검사는 `main` 범위의 critical/serious 위반 0을 확인한 것이며 모든 WCAG 등급의 위반 0을 뜻하지 않는다.

전체 브라우저 회귀 뒤 10개 Work 파일에는 Prettier가 공백과 줄바꿈만 정규화했다. 그 뒤 최종 production build·비증분 TypeScript·16파일 단위 검사·34건 배정 브라우저 검사와 소스 무결성을 다시 확인했다. 실행 순서와 로그는 검증 JSON에 기록했다.

## 증거의 한계

- `pixelPerfect=false`
- `liveTenant=false`
- `productionDeploy=false`
- 화면과 브라우저 검증은 controlled fictional fixtures를 사용했다.
- 200%는 `document.documentElement.style.zoom = "2"`를 적용한 CSS zoom 근사다. 브라우저 메뉴의 native zoom 인증이 아니다.
- 320px forced-colors 캡처는 reduced motion을 함께 적용했다.
- 실제 Meeting 원문 ACL, People 적격성, Gateway 권한과 운영 자격 증명은 이번 로컬 완료 판정에 포함하지 않는다.
- commit, push, 배포는 수행하지 않았다.

과거 보고서와 갤러리는 변경 이력을 설명하는 **HISTORICAL / SUPERSEDED** 증거로 보존한다. 2026-09-09 현재 판단은 이 보고서, 라이브 감사 기록, 화면 manifest와 최종 갱신된 검증 JSON을 함께 사용한다.
