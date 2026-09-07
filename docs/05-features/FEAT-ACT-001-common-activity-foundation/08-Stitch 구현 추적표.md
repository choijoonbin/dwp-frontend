# Stitch 4개 화면 구현 추적표

기준 프로젝트: [DWP 활동 디자인](https://stitch.withgoogle.com/projects/13391261371843159731), 확인일 2026-09-04.

| #   | Stitch 화면 / node                                               | 수용한 제품 의도                                                             | 실제 구현                                                                                           | 검증 핵심                                                                                                |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 01  | Flow 실행 신호 / `3620110d19ea4e649c3de00322344a2b`              | 현재 실행 총계, 실행 중, 입력 필요, 정책 차단, 최근 신호와 전체 이력 진입    | `/activity/home`; Flow `activity-attention` 신호에 입력 필요·정책 차단 breakdown                    | 과거 사건을 현재 건수로 합산하지 않음; 한 원천 실패 시 부분 합계 비노출                                  |
| 02  | 업무 맥락 공통 활동 이력 / `7e061e5f036c4b09b77e9e2d442bf9ea`    | 서버 필터·URL 보존, 사건 목록, 선택 상세, 목록 필터와 독립된 현재 요약       | `/activity/timeline`; 지원되는 Work 네이티브 Task에서 `objectType=WORK_ITEM&objectId=<UUID>`로 진입 | Work와 Activity 권한 교집합; 결재·서비스 projection에는 거짓 공통 이력 링크 없음                         |
| 03  | 공통 사건·실행 상세 및 예외 / `cef1fbfc3bb84c8289e93b71a42f0ed3` | 사건 의미, 시각, 주체, 객체, 원천, 실행, 감사 근거를 구분; UNKNOWN 중립 처리 | 공통 `ActivityEventDetail` + DWP `DetailInspector`; desktop inline / mobile drawer                  | CHANGE 완료와 workStatus 분리; exact ID; 감사 미연결·제한 상태; 원본 ACL 재검사                          |
| 04  | DWAI·ON 실행 목록·상세 / `aeaa8d7c29584294870c5e6d77983f10`      | 7:5 목록/상세, 상태 필터, 최근 실행 응답, 관련 대화 복귀                     | `/dwaion/activity?run=<UUID>`; `/v1/runs`·`/v1/runs/{runId}`와 공통 Activity 상세 조합              | 최대 100건 최근 응답임을 명시; exact run; 실제 conversationId만 링크; APP.ACTIVITY 없으면 상세 요청 생략 |

## 의도적으로 복제하지 않은 항목

| Stitch 표현                                                                 | 제외 이유 / 대체                                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `Chronos Workplace Mail` shell, Geist, Material Symbols, 고정 256px sidebar | DWP 제품 shell·토큰·Lucide 및 반응형 navigation 유지                                    |
| 의견 제출, 서명 확인, 예외 승인 신청, 승인·취소·재시도                      | Activity 소유 command API가 없음. 실제 행동은 원본 앱에서만 수행                        |
| 4단계 88% 완료, 100% 건강도, 커넥터 78% 같은 고정 값                        | 원천이 보장하지 않는 수치를 합성하지 않음. 실제 event progress가 있을 때만 참고 값 표시 |
| SHA-256/BLAKE3 해시, rule ID, tenant/build ID, 법적 불변성 문구             | 현재 계약에 없는 증거·보장을 만들지 않음. 실제 auditRecordId와 연결 상태만 표시         |
| inference 차트와 전체 reasoning/lifecycle                                   | Agent 원장은 현재 snapshot과 run 응답만 제공. 기록되지 않은 단계를 재구성하지 않음      |
| 여러 예외 상태를 한 상세 화면에 동시에 표시                                 | 디자인 specimen으로 해석. 제품은 선택된 한 사건의 실제 상태만 조건부 표시               |
| 모바일 고정 sidebar와 압축된 본문                                           | 접근 가능한 DWP drawer와 단일 열로 교정                                                 |

## 기능 소유권

- Activity: 무엇이 언제 누구에 의해 어떤 정책·원천 경계에서 일어났는지 확인하고 근거/원본으로 이동한다.
- Flow: 현재 확인해야 할 실행 신호를 발견한다.
- Work: 실제 업무를 처리하며, 공통 원장 지원 범위에 한해 해당 객체의 이력을 연다.
- DWAI·ON: 개인 AI 실행 응답과 정책 결과를 확인하고 실제 연결된 대화로 돌아간다.
- Calendar/Notifications: 각각 시간 배치와 주의 환기를 소유한다. Activity가 그 기능을 복제하지 않는다.

## 구현·검증 증거

- 화면 회귀: [Activity Stitch visual spec](/Users/a10697/Work/DWP/dwp-frontend/e2e/activity-stitch-visual-quality.spec.ts)
- 픽셀 기준선: [10개 baseline 디렉터리](/Users/a10697/Work/DWP/dwp-frontend/e2e/activity-stitch-visual-quality.spec.ts-snapshots)
- 기능 수용: [수용 테스트·출시 게이트](<07-수용 테스트.md>)
- Product Authorization: append-only v5, contract checksum `c69816a06349fcbd45a0d946debfbce1d67e09b3ed87a8b056ec8a43f852109f`, 72 capabilities / 160 routes. Backend·Frontend snapshot과 fixture를 v5로 동기화했고 기존 v1-v4 checksum은 보존했다. v4 운영 closure와 최신 v5 DRAFT가 다르면 release 모드는 fail-closed한다.
