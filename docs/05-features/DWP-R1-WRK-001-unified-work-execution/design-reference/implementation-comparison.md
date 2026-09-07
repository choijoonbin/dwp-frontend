# Stitch 시안과 Work Hub 구현 비교

기준일: 2026-09-04. 대상은 확보한 Stitch 18개 프레임과 현재 `/work/queue` 구현이다. 화면의 문구·fixture·버튼은 기능 계약이나 운영 증거로 사용하지 않는다.

## 전체 판정

현재 구현은 Stitch의 역할 중심 목록–상세 구조와 주요 01–12 여정을 제품 코드에 반영했다. DWP design token과 공통 component로 다시 구성했고, 데이터·권한·명령은 실제 소유 API 계약에 맞췄다. 중복 업무 홈과 6개 영구 하위 메뉴는 제거했으며, 개인 할 일·오늘 계획·Calendar·AI·원천 상태·일괄 결과를 통합업무함의 상세·패널·대화상자로 제공한다.

시안은 공식 completeness gate를 통과하지 못했다. 제목과 달리 desktop은 실제 1280px이고 M2는 실제 390px이다. 06–11의 개별 mobile과 실제 320px, dark, 강제 고대비, 200% 확대 결과도 없다. 구현은 이 공백을 반응형 코드와 자동 검증으로 보완했지만, 디자인 이미지나 fixture E2E를 운영 원천·실제 보조기기 수용 증거로 해석하지 않는다.

## 화면별 대조

| 번호               | 제품 구현                                                                                                                                  | Stitch와 일치하는 경험                                                      | 의도적으로 달라진 내용                                                                      | 판정                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------- |
| 01 통합업무함      | canonical `/work/queue`, 다중 원천 집계, 검색·필터·정렬, source/completeness 상태, desktop split detail, mobile full detail, URL 선택 복귀 | 첫 화면에서 실제 업무와 원천·상태·기한·책임을 판단하고 상세로 이어지는 구조 | 6개 하위 메뉴와 중복 업무 홈 제거. 실시간·전체 정상 수치 단정 제거. 원천 일반 완료 제거     | 구현                                |
| 02 결재 상세       | 결재 역할·근거·상태를 표시하고 현재 계약이 허용한 owner action 또는 원본으로 handoff                                                       | 근거 우선 위계와 현재 사용자 조치 강조                                      | 법적 효력·감사 로그·엔진 동기화 보장, 계약 없는 범용 직접 승인/반려 제거                    | 조건부 구현                         |
| 03 접근권한 검토   | 큐에서 기존 Access Review 상세·결정 계약으로 이동하고 복귀 맥락 유지                                                                       | 대상·권한·근거·결정의 단계와 mobile 전환                                    | ERP 즉시 차단·세션 종료 알림·모든 고객 환경 remediation 성공 단정 제거                      | handoff 구현                        |
| 04 서비스 상세     | 내 역할·요청 상태를 표시하고 기존 Service 상세로 이동                                                                                      | 보완 사유와 요청 진행 상태 분리                                             | Work 자체의 범용 보완 제출·담당자 알림·ITSM live 단정 제거                                  | handoff 구현                        |
| 05 개인 할 일 상세 | 설명·우선순위·기한·출처·timeline, lifecycle, 편집, 계획, Calendar, AI 행동                                                                 | 개인 업무의 내용과 다음 행동을 한 상세에서 처리                             | ERP 잔액·원천 승인 완료·하위 작업 등 fixture 필드 제거                                      | 구현                                |
| 06 생성·캡처·편집  | create/edit dialog, validation, dirty-close, source 유지·명시적 unlink, 생성 후 계획 추가                                                  | 집중 form과 저장·오류·취소 계층                                             | Mail·Messaging 캡처 진입과 Markdown·메시지 ID·preset 지원 단정 제거                         | Work form 구현, 외부 capture 미지원 |
| 07 오늘 계획       | 날짜별 후보·선택·순서·제거, opaque selection 해석, version 충돌 복구                                                                       | 원본 기한과 독립된 개인 선택·정렬                                           | 예상 소요·성공 확률·자동 배치·추천 제거                                                     | 구현                                |
| 08 Calendar 연결   | Work UPDATE와 Calendar VIEW 권한 확인, 비공개 focus event 생성, link receipt 복구, 조회·상세 이동·link 해제                                | 시간대·시작·종료 확인과 event/link 단계 구분                                | 가용성 자동 확인, `준비 완료`·Direct 성공 단정 제거. link 해제를 event 취소로 표현하지 않음 | 구현                                |
| 09 원천·복구·일괄  | source status inspector, stale/degraded/forbidden 상태, atomic batch preview, 항목별 terminal/unknown receipt                              | 원천별 상태와 항목별 결과를 분리                                            | 모든 원천 공통 일괄 완료·승인, timeout의 임의 확정 제거                                     | 지원 대상에 한해 구현               |
| 10 Flow 업무 요약  | Flow의 compact contribution에서 통합업무함으로 진입하는 경계 유지, Work Home 제거                                                          | 중요한 업무 발견과 큐 연결                                                  | 독립 Work dashboard, KPI·차트·AI 자동 요약 제거                                             | 경계 반영                           |
| 11 선택 업무 AI    | 선택 한 건의 최소 맥락 preview, 질문 validation, DWAI·ON handoff                                                                           | 전송 전 맥락·질문 확인과 안전 문구                                          | 실시간 분석·검증된 초안·자동 폼 반영·감사 기록 완료 제거                                    | handoff 구현                        |
| 12 모바일·접근성   | 390/320 반응형, mobile 상세 복귀, dialog focus, 상태 announcement, 긴 문구, dark/forced-colors/200% reflow                                 | M1/M2 여정 순서와 작은 화면의 주 행동 접근                                  | 시안의 WCAG·0px overflow 자기 선언은 증거로 채택하지 않음                                   | 코드·자동 검증으로 보완             |

## 제품 계약을 우선한 차이

1. 개인 업무 완료는 연결된 원본 업무를 완료하지 않는다.
2. 오늘 계획은 원본 마감·상태와 Calendar 일정을 변경하지 않는다.
3. Calendar 관계 저장과 event 생성은 서로 다른 단계다. link 해제는 event 취소가 아니다.
4. `AVAILABLE`은 현재 접근 가능성이고 모든 mutation 권한이 아니다.
5. `REFERENCE_ONLY`는 개인 참조다. 원본 검증 전 제목·상태·기한·URL을 합성하지 않는다.
6. `UNAVAILABLE`, `FORBIDDEN`, bounded source, 부분 실패와 미조회는 정상 0건으로 표시하지 않는다.
7. timeout·요청 접수·AI 응답·원본 열기는 최종 성공이 아니다.
8. 권한 회수 refresh 뒤 해당 원천의 이전 민감 내용과 수치를 제거한다.
9. 개인 명령, 계획 저장, Calendar link는 version·UUID·receipt의 각 재시도 계약을 지킨다.
10. filter가 바뀌면 batch 선택을 비우고 preview로 검토한 지원 항목만 실행한다.

## 디자인 completeness 보완

| 디자인에서 빠진 증거         | 구현·검증에서 보완한 범위                                                                                            | 남는 한계                                        |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 실제 1440px과 1280×800       | 유동 workspace 안의 안정된 desktop grid와 list/detail reflow                                                         | Stitch 픽셀 대조 기준은 실제 1280 wrapper로 제한 |
| 실제 320px M2와 06–11 mobile | 320px page reflow, mobile full detail, form/dialog/계획/Calendar 흐름                                                | 모든 OS 가상 키보드 실기기 검증은 별도           |
| dark·강제 고대비             | DWP semantic token과 forced-colors 상태 검증                                                                         | 실제 사용자 테마 조합과 보조기기는 별도          |
| 200% 확대                    | 1280 기준 200%에서 가로 overflow와 주 행동 접근 검증                                                                 | 브라우저·OS별 확대 조합은 별도                   |
| 실패·권한 회수·충돌·receipt  | source notice, permission purge, 개인 편집 draft 보존, 계획 409 최신본 채택·거절 draft 차단, Calendar·batch recovery | 실제 운영 원천 장애 주입은 별도                  |

04·05 desktop HTML은 1280px Chrome 재렌더에서 각각 약 1440px·1480px의 실제 가로 폭을 만들었다. 해당 overflow는 구현에서 복제하지 않았다. 시안의 #2563EB·Geist·Material Symbols도 DWP 제품 token·한글 시스템 글꼴·Lucide로 합치했다.

## Meeting 및 운영 경계

Meeting owner-source receiver는 내부 resolve/read만 구현됐다. CREATE는 `AUTHORITY_UNVERIFIED`, REASSIGN은 `TARGET_ELIGIBILITY_UNVERIFIED`로 fail-closed이며 현재 **NO-GO**다. Stitch의 버튼이나 fixture로 Meeting 생성·재배정을 활성 기능으로 표시하지 않는다.

Mail·Messaging 원문 캡처 진입, 모든 결재·서비스의 범용 직접 처리, 외부 운영 배포와 고객 원천 검증도 이번 화면 구현 범위에 포함되지 않는다. 상세 검증 상태는 [디자인 구현 마감](../2026-09-04-design-implementation-closeout.md), 전체 기능 행렬은 [구현 확인표](../design-ai/implementation-coverage.md)를 따른다.
