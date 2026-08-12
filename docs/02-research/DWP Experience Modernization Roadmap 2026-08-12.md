# DWP Experience Modernization Roadmap

- 기준일: 2026-08-12
- 범위: 실제 노출 메뉴 45개와 공통 Shell
- 목표: 글로벌 제품의 기능적 모범 사례를 흡수하되 DWP 고유의 유연하고 살아 있는 업무 경험으로 재구성
- 상세 결함 기준선: `DWP 메뉴별 UI UX 감사 2026-08-11.md`
- 제품 규칙: `DWP Product Experience Rules.md`

## 1. 객관적 판정

현재 DWP의 기능·권한·API 기반은 엔터프라이즈 제품으로 발전할 수준이다. 하지만 화면은
기능 깊이에 비해 다음 세 가지 이유로 실제보다 낮은 완성도로 보인다.

1. 넓은 Canvas에 얇은 선과 작은 Text를 분산해 정보 관계가 끊긴다.
2. 현재값·상태·기술 Event를 그대로 노출하고 변화, 영향, 기준과 다음 행동을 충분히 편집하지 않는다.
3. 모든 메뉴가 비슷한 Header·KPI·Table 문법을 사용해 업무 성격이 달라도 같은 관리자 화면처럼 보인다.

첨부한 Mantis·Minimal 화면은 시각 리듬과 데이터 형태의 다양성은 현재 DWP보다 낫다. 다만
Generic KPI, Card, 장식 Chart가 많아 DWP의 정답은 아니다. DWP는 그들의 **빠른 Scan과 안정된
Grid**를 배우고, PagerDuty·Grafana·Azure Workbooks의 **운영 판단과 연결된 Interaction**을
결합해야 한다.

## 2. 전역 작업 대상

| 대상                | 현재 문제                                                    | 목표                                                                      | 우선순위 |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- | -------- |
| Global Shell        | 제품 영역은 명확하나 화면 Context와 상태가 Header에서 분리됨 | Scope·검색·알림·지원 모드를 유지하고 페이지 Context Bar와 자연스럽게 연결 | P1       |
| Layout Grid         | 초광폭에서 Section이 멀어지고 긴 Divider가 화면을 가름       | Fluid Shell 안에 최대 1600px 내부 12-Column Grid와 역할별 Span 적용       | P0       |
| Surface             | Line-only와 옅은 회색이 대부분의 화면을 지배                 | Canvas·Section·Floating 3단계 Tone과 제한된 Border/Shadow 계약            | P0       |
| Data visualization  | API 모니터링 외에는 시각화가 거의 없거나 단편적              | 의미 기반 Chart Token, 접근 가능한 Summary, Linked Selection 도입         | P0       |
| Operational context | Scope·기간·Freshness·Saved View가 메뉴마다 다름              | `OperationalContextBar` 공통화 및 URL/Saved View 계약                     | P0       |
| State handling      | Empty·Partial·Stale가 넓은 빈 화면이나 전역 오류로 보임      | Healthy Empty, No data, Partial, Stale, Error를 독립 Surface로 표현       | P0       |
| Motion              | Press 외에는 상태 전환과 공간 관계 Feedback이 약함           | Filter·Selection·Inspector·Live Update에 짧은 인과 Motion 적용            | P1       |
| Responsive          | 코드 분기는 있으나 넓은 Grid와 Graph의 실제 검증 편차        | 1440/1280/390/320·200% Zoom Visual Gate 고정                              | P0       |

## 3. Workspace 5개

| 메뉴                 | Archetype·밀도 판단                                                           | 고도화 방향                                                                                                                    | 우선순위 |
| -------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 홈 `/`               | Personal command center · Structured. 단순 Welcome 화면이면 안 됨             | 오늘의 우선 업무·승인·일정·앱을 시간과 중요도로 편집하고, 빈 Widget 대신 다음 설정 행동 제공. 역할별 기본 Layout과 개인화 유지 | P0       |
| Work `/work`         | List-detail · Structured. 전문 업무 목록이므로 표만으로는 부족                | SLA·위험·담당 기준 Saved View, 다중 선택과 일괄 처리, 고정된 Detail Inspector, 관련 사람·앱·감사 Deep Link                     | P1       |
| Ask `/ask`           | Conversational workflow · Structured. 초기 화면은 단순, 실행 후는 깊어져야 함 | 최근 Context와 추천 질문 → Streaming 답변 → 출처 → 실행 계획 → 승인·진행 Timeline. 신뢰 수준과 권한 제외 결과 표시             | P0       |
| Activity `/activity` | Event timeline + inspector · Structured                                       | 사람·System·Agent 사건을 객체별로 묶고 Live/Paused, 필터, Evidence, Retry·Approve와 감사 상관관계 제공                         | P1       |
| Apps `/apps`         | Catalog + launchpad · Structured                                              | Pinned는 빠른 실행, Catalog는 검색·권한 요청·소유자·상태 비교. 사용 빈도는 개인화에 쓰되 감시처럼 보이지 않게 근거 표시        | P1       |

## 4. People 2개

| 메뉴                                | Archetype·밀도 판단      | 고도화 방향                                                                                                              | 우선순위 |
| ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------- |
| 구성원 디렉터리 `/people/directory` | List-detail · Structured | 역할별 Saved View, 사람 Peek, 조직·역량·위치 Filter, 연락·협업 Quick Action. 상세에서 보고 라인·권한·최근 변경으로 연결  | P1       |
| 조직도 `/people/organization`       | Graph explorer · Dense   | 사용자 중심 초기 Focus, 의미 기반 Zoom, Minimap, 경로 Highlight, 변화 Overlay, 조직/보고 라인 전환과 읽기 전용 공유 View | P0       |

## 5. Workforce 6개

| 메뉴                                     | Archetype·밀도 판단                 | 고도화 방향                                                                                              | 우선순위 |
| ---------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| 인력 개요 `/workforce/overview`          | Domain command center · Dense       | 증감·공석·위험·데이터 품질을 시간 기준으로 보여주고 모든 Signal을 사람·조직·실행으로 Drill-down          | P1       |
| 구성원 관리 `/workforce/people`          | Enterprise grid + inspector · Dense | Sticky 핵심 열, 열 Preset, Saved View, 일괄 작업, CSV/비동기 Export, 선택 유지와 사람 Inspector          | P1       |
| 배치 관리 `/workforce/assignments`       | Timeline list-detail · Structured   | 현재/예정 배치, 겸직·공석·충돌 Signal, Effective Date Diff와 승인·취소 Timeline                          | P1       |
| 조직 설계 `/workforce/organization`      | Graph studio · Dense                | 시나리오 Canvas, 제안·비교·비용/FTE·역량 영향, 협업 Comment, 승인·병합, 대규모 Graph 성능과 Minimap      | P0       |
| 기준정보 `/workforce/reference-data`     | Catalog list-detail · Structured    | 소유자·원천·유효기간·동기화 상태, 소비 기능 영향, 변경 요청과 Version Diff. 현재 Master-detail 강점 유지 | P2       |
| 데이터 운영 `/workforce/data-operations` | Integration workflow · Dense        | 연결 → Mapping → Dry run → 품질 검사 → Import → Reconciliation을 단계화하고 실행 이력·재처리·승인 제공   | P1       |

## 6. Tenant Admin Experience 3개

| 메뉴                                        | Archetype·밀도 판단             | 고도화 방향                                                                                                       | 우선순위 |
| ------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| 브랜딩 `/admin/experience/branding`         | Studio · Structured             | Logo·색·문구 편집과 Shell/Login/Email/Favicon의 실제 Desktop·Mobile Preview, 대비 검사, 게시·Rollback 이력        | P1       |
| 홈 경험 `/admin/experience/home-experience` | Studio · Structured             | Focal point·안전 영역·Locale·Theme·Viewport Preview, 이미지 품질 검사, Draft/Publish/History                      | P1       |
| 공지 `/admin/experience/announcements`      | Editorial workflow · Structured | Audience → 작성 → Preview → 예약 Calendar → 승인/게시 → 도달·읽음 분석. 목록은 상태 Pipeline과 Calendar 전환 제공 | P1       |

## 7. Tenant Admin Identity 4개

| 메뉴                                         | Archetype·밀도 판단                      | 고도화 방향                                                                                                         | 우선순위 |
| -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| 접근 제어 `/admin/identity/access`           | List-detail · Dense                      | 직접/그룹/SCIM 부여 근거, Effective Access, 위험·만료, 변경 영향과 승인 필요 여부를 사용자 Inspector에 통합         | P0       |
| 접근 검토 `/admin/identity/access-reviews`   | Review workflow · Structured             | Campaign 진행, 검토 Queue, 근거·최근 사용·위험 Signal, 승인/회수·위임, 기한과 감사 증거                             | P0       |
| 역할 및 권한 `/admin/identity/roles`         | Relationship explorer + editor · Dense   | 역할-리소스-그룹 Graph, 중복·충돌, 사용자 영향 Preview, 권한 Simulation과 Version Diff                              | P1       |
| ID 프로비저닝 `/admin/identity/provisioning` | Guided integration workflow · Structured | Provider 선택, Test, Mapping, Dry run, Sync, 오류 Reconciliation, Secret 회전과 건강 상태. Empty에서 첫 연결로 안내 | P0       |

## 8. Tenant Admin Platform 3개

| 메뉴                                       | Archetype·밀도 판단                 | 고도화 방향                                                                                   | 우선순위 |
| ------------------------------------------ | ----------------------------------- | --------------------------------------------------------------------------------------------- | -------- |
| 기준정보 `/admin/platform/reference-data`  | Catalog list-detail · Dense         | 현재 강점을 유지하고 소유권, 계약, 소비처 영향, 변경 승인·Diff와 Activity 상관관계 강화       | P1       |
| 제품 레지스트리 `/admin/platform/registry` | Catalog + relationship · Structured | 제품-메뉴-권한-API 관계, Version 호환성, 수명주기와 폐기 영향 Preview                         | P1       |
| 내비게이션 `/admin/platform/navigation`    | Tree studio · Structured            | Drag/Keyboard 재정렬, Locale·Role별 실제 Shell Preview, 고아 메뉴·충돌 검사, 변경 Diff와 게시 | P1       |

## 9. Tenant Admin Integration 1개

| 메뉴                                           | Archetype·밀도 판단               | 고도화 방향                                                                                      | 우선순위 |
| ---------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ | -------- |
| 생산성 연결 `/admin/integrations/productivity` | Integration workflow · Structured | Connector별 인증·Scope·Mapping·Test·동기화 상태, 부분 실패, 재동의, 영향 사용자와 Audit Timeline | P1       |

## 10. Tenant Admin Governance 5개

| 메뉴                                               | Archetype·밀도 판단                 | 고도화 방향                                                                                               | 우선순위 |
| -------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |
| API 모니터링 `/admin/governance/api-monitoring`    | Operational dashboard · Dense       | 전역 기간·Service Filter, RED 지표, SLO/Error Budget, 배포·변경 Annotation, 이상 선택에서 Trace/요청 상세 | P0       |
| 감사 개요 `/admin/governance/audit-overview`       | Risk command center · Dense         | 위험 변화, 실패·고권한 행동, 탐지 근거와 조치 Queue, 선택에서 조사 Case 생성                              | P0       |
| 감사 조사 `/admin/governance/audit-investigations` | Investigation workspace · Dense     | Evidence Timeline, 관련 Actor/Object Graph, Task·Note·SLA, Export와 종료 보고서. 부분 API 실패 격리       | P0       |
| 감사 이벤트 `/admin/governance/audit-events`       | Enterprise grid + inspector · Dense | 열 Preset, Saved Search, Row Peek, 상관관계 ID 탐색, 비동기 Export와 Display Dictionary                   | P1       |
| 감사 거버넌스 `/admin/governance/audit-governance` | Policy workflow · Structured        | 보존·Integrity·Checkpoint 정책 Diff, 영향 Preview, 승인·Rollback, 검증 실패에서 Incident 연결             | P1       |

## 11. Provider Control Plane 9개

| 메뉴                                        | Archetype·밀도 판단                     | 고도화 방향                                                                                                                     | 우선순위 |
| ------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 운영 지휘 `/provider/overview`              | Global command center · Dense           | 고객 영향 기반 Pulse, Scope·Snapshot/Live, 의미 있는 Signal, 우선 조치 Queue, 서비스·SLO·배치 상태, Event 상관관계와 Drill-down | P0       |
| 고객 및 테넌트 `/provider/tenants`          | Estate list-detail · Dense              | 회사·환경·리전·등급·격리 Saved View, 비교, 건강·계약 Signal, Tenant 360 Inspector와 온보딩 Workflow                             | P0       |
| 변경 통제 `/provider/operations`            | Change workflow · Dense                 | 계획·영향·승인 Gate·단계 Timeline·Retry/Rollback·고객 공지·Audit Evidence를 한 실행 기록으로 연결                               | P0       |
| 서비스 운영 `/provider/health`              | Reliability command center · Dense      | Service/Region/Cell Scope, SLO/Error Budget, Incident, Topology, Maintenance와 Change Annotation, 고객 영향 Drill-down          | P0       |
| 권한 있는 지원 `/provider/support`          | Privileged-access workflow · Structured | 요청·고객 승인·사유·Scope·시간·세션 표시·강제 회수·사후 검토를 단계화. 빈 상태는 새 세션 정책 안내                              | P0       |
| 구독 및 권한 `/provider/commercial`         | Portfolio list-detail · Dense           | 계약·사용량·Entitlement·갱신 위험·변경 영향, 회사 비교, 갱신 Workflow와 Audit                                                   | P1       |
| 제품 계약 `/provider/code-contracts`        | Catalog + dependency explorer · Dense   | 시스템 전역/테넌트 노출 Scope를 분명히 하고 소유 서비스·소비처 Graph, 호환성·강제 상태·변경 영향 제공                           | P1       |
| 데이터 거버넌스 `/provider/data-governance` | Catalog + graph explorer · Dense        | DB/Domain Catalog, 동적 ER·Data Flow, 품질·소유권·분류·Lineage, Issue Remediation와 Scope별 권한                                | P0       |
| 거버넌스 및 감사 `/provider/audit`          | Cross-tenant investigation · Dense      | 지원 세션·변경·테넌트·운영자 상관관계, Saved Search, Correlation Timeline, 증거 Export와 조사 Deep Link                         | P1       |

## 12. Account 7개

| 메뉴                                      | Archetype·밀도 판단                          | 고도화 방향                                                                                       | 우선순위 |
| ----------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| 프로필 `/account/profile`                 | Focus form · Simple. Chart와 KPI가 필요 없음 | 정보 원천·수정 가능 범위·개인정보 가시성, Avatar/연락처 변경 상태와 저장 Feedback만 정교하게 제공 | P2       |
| 보안 및 세션 `/account/security`          | Security list-detail · Structured            | MFA/SSO 상태, 현재·기타 세션, 위험 로그인, 기기·위치, 개별/전체 종료와 재인증·Audit               | P1       |
| 화면 모양 `/account/settings/appearance`  | Focus form · Simple                          | Theme·Density·Navigation 선택의 즉시 Preview, Auto-save Saving/Saved/Failed, 정책 잠금 설명       | P2       |
| 접근성 `/account/settings/accessibility`  | Focus form · Simple                          | 고대비·모션 감소의 실제 Preview, Screen Reader 도움과 Reset. 장식 Icon Tile 남용 금지             | P2       |
| 언어 및 지역 `/account/settings/language` | Focus form · Simple                          | 언어·시간대·날짜·숫자 Format Preview와 로그인 이후 적용 상태. Header 중복 Control 제거 유지       | P2       |
| 홈 워크스페이스 `/account/settings/home`  | Mini layout studio · Structured              | Widget 표시·순서·초기화, Desktop/Mobile Preview, Role 기본값과 개인 Override 구분                 | P2       |
| 관리형 설정 `/account/settings/managed`   | Policy summary · Simple                      | 읽기 전용 값, 정책 원천·적용 범위·담당자·예외 요청. 변경 Control처럼 보이지 않게 표현             | P2       |

## 13. 실행 순서

### Wave 0 - Foundation

1. 프로젝트 규칙과 Archetype Gate 고정
2. Chart/Surface/Layout Token과 접근성 계약 추가
3. `OperationalContextBar`, `SignalMetric`, `ActionQueue`, `HealthMatrix` 구축
4. Visual Regression Viewport와 Partial Failure Fixture 보강

### Wave 1 - 운영 기준 화면

1. Provider 운영 지휘
2. Provider 서비스 운영·변경 통제·테넌트 자산
3. Tenant API 모니터링·감사 개요·조사
4. Workforce 인력 개요·조직 설계

### Wave 2 - 일상 핵심 Journey

1. Home·Work·Ask·Activity
2. People Directory·조직도
3. 접근 제어·접근 검토·프로비저닝
4. 공지·브랜딩·홈 경험 Studio

### Wave 3 - Catalog와 개인 설정

1. 기준정보·제품/코드/데이터 Catalog의 관계 탐색 통합
2. Apps·Connector·Navigation Studio
3. Account의 Simple/Structured 화면 정교화

### 13.1 2026-08-12 실행 현황

Wave 완료는 화면이 바뀌었다는 의미가 아니라 실제 API, 상태 계약, 연결형 행동, 반응형·접근성
검증이 함께 존재한다는 의미로 사용한다. 외부 계약이나 장기 운영 증거가 남은 항목은 현재 구현
가능 범위 완료와 출시 완료를 구분한다.

| 실행 단위                                  | 현재 상태           | 반영된 범위                                                                                                                                                                                                                                               | 남은 출시 조건                                                                                     |
| ------------------------------------------ | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Wave 0 공통 운영 기반                      | 기반 완료, 전환 중  | 최대 1600px 운영 Grid, Surface·Signal·Context·부분 실패 계약, URL 기간 상태, 320px Reflow와 200% Text-size·Axe 자동 Gate를 Wave 1·Workspace 대표 화면에 적용                                                                                              | 기존 45개 메뉴의 공통 패턴 전환, 실제 Browser Zoom·Screen Reader 및 CI Browser/OS 수동 증거 `D-10` |
| Provider 운영 지휘                         | 현재 가능 범위 완료 | 고객 영향 Pulse, 우선 조치 Queue, 서비스·Reliability·테넌트 Drill-down, Freshness·부분 실패 상태                                                                                                                                                          | 장기 추세, 이상 탐지 품질, 실제 고객 규모 장애 주입                                                |
| Provider 서비스 운영·변경 통제·테넌트 자산 | 현재 가능 범위 완료 | Service/Region 운영 신호와 SLO·Error Budget, 변경 Gate·실행 증거, URL 필터·서버 저장 View·최대 3개 테넌트 비교, Tenant 360, 정상·빈·부분 실패 검증                                                                                                        | Service Topology, 실행기 연계 자동 Rollback·고객 통지 `D-13`, 실제 고객 규모 장애 주입             |
| Tenant API 모니터링·감사                   | 현재 가능 범위 완료 | RED/SLO, 기간·서비스 Scope, 배포·관리 변경 Annotation과 상관관계, 이상→요청 상세, 위험 Queue→조사, Note·Task·SLA, SHA-256 종료 보고서와 종료 후 Case Workspace 전체 불변성·동시성 잠금, 보조 API 장애 격리                                                | 진짜 비동기 대량 Export Worker·WORM 저장소 `D-12`, 실제 보존 규모 성능·복구 시험                   |
| Workforce 조직 설계                        | 현재 가능 범위 완료 | 조직 Graph의 운영 개요, 시나리오 비교·검증·승인·게시, 비용/FTE 영향, 조직 Focus·Inspector·URL 복구                                                                                                                                                        | `D-04` 협업·Bulk·실행 Bridge, `D-05` 역량 영향, 실제 대규모 Graph 성능                             |
| Workforce 인력 개요                        | 현재 가능 범위 완료 | 실제 현재·비교 스냅샷, 공석·조직 위험·품질 Signal, 우선 조치 Queue, 서버 저장 운영 View, 조직·사람·Position·HRIS·시나리오 Drill-down, Healthy Empty와 부분 실패                                                                                           | 장기 변화 시계열과 고객 HRIS 원천 계약 `D-11`, 실제 운영 규모 성능·사용성 시험                     |
| Wave 2 개인화 Home                         | 현재 가능 범위 완료 | 실제 Work Queue로 다음 우선 업무와 열린 업무·마감·진행·대기 신호를 편집하고 앱·위젯을 뒤에 배치했다. Keyboard 진입, Healthy Empty, 국소 장애·재시도, 320px·Axe를 검증했다.                                                                                | Calendar·결재 Connector `D-08`, 고객별 역할 추천 근거·운영 사용성 시험                             |
| Wave 2 Work·Ask·Activity                   | 현재 가능 범위 완료 | Work의 실제 KPI·URL/Saved View·낙관적 단건 및 최대 50건 원자적 상태 변경·감사, Ask의 권한 Relay·근거·정책·감사·URL 재실행·이전 요청 취소와 60초 제한, Activity의 실제 소스·상태 KPI·URL/Saved View·주체/상태 필터·사건 상세가 실제 API에 연결된다.        | 외부 업무 원천 Adapter·SLA/Compensation, 운영 Model·지식 `D-02·D-03`, 서비스별 사건 생산자 `D-07`  |
| Wave 2 People Directory·조직도             | 현재 가능 범위 완료 | 서버 검색과 Cursor 기반 점진 로딩, 부분 실패 복구, 사람 상세와 조직도 Deep link를 연결했다. 조직도는 자동 Focus, 검색, Inspector, URL 복구·공유와 운영 개요를 제공하며 Desktop·Mobile 대표 여정을 검증했다.                                               | 실제 고객 최대 규모 성능·가상화 시험, 개인정보가 포함된 Export·Print 정책 `D-09`                   |
| Wave 2 접근 제어·검토·프로비저닝           | 현재 가능 범위 완료 | 직접·그룹 Role의 Effective Access와 Scope·최근 로그인·활성 Session 근거, Campaign 기반 접근 검토와 불변 Assignment Snapshot·권고·회수 사유, SCIM 2.0 Users/Groups·Credential 수명주기·건강 상태·Provisioning Event를 실제 API와 감사에 연결했다.          | 실제 기업 IdP 선택·Domain/MFA·Mapping·Sandbox Reconciliation `D-01`, 운영 부하·복구 시험           |
| Wave 2 공지·브랜딩·홈 경험 Studio          | 현재 가능 범위 완료 | 공지 상태 Pipeline·검색·Preview·복제·예약과 사용자별 View/Action 증적, Branding의 Shell·Sign-in·Email·Favicon Preview·Accent·품질 검사, Home의 Desktop/Mobile·Light/Dark·KO/EN Preview와 기본 Locale 검증, 두 Studio의 불변 Revision·Rollback을 구현했다. | 미디어 Object Storage·보존 수명주기 `D-14`, 공지 승인·긴급 채널·확인 정책 `D-15`, 실제 브랜드 승인 |

Wave 1의 내부 구현 가능 범위와 Wave 2의 `Home → Work → Ask → Activity`,
`People Directory → 조직도`, `접근 제어 → 접근 검토 → 프로비저닝`,
`공지 → 브랜딩 → 홈 경험 Studio`는 완료했다. 여기서 완료는 외부 고객·보안·인프라 결정을
임의로 대체했다는 뜻이 아니다. `D-01`, `D-08`~`D-15`에 등록한 외부 결정은 안전하게 닫힌
상태로 유지하고, 결정 이후 실제 Sandbox·운영 규모·수동 접근성 증거를 추가해야 출시 완료가 된다.

최종 전수 Gate는 프론트 단위 테스트 106개, 제품 Playwright 250개 중 239개 통과·상호 배타
프로젝트 11개 제외·실패 0개, Storybook 상호작용 18개, 백엔드 Clean Gradle 47개 Task,
Agent Pytest 44개를 통과했다. Auth Flyway V35·Platform V43·People V33·Provider V25와
PostgreSQL·Redis·Auth·Platform·People·Provider·Agent·Gateway·Frontend의 실제 기동 및
HTTP 200도 확인했다. 코드 계약 306개·활성 값 1,138개·바인딩 345개를 전수 대조했고,
세션 활동 갱신과 토큰 회전의 동시 실행도 원자적 갱신으로 검증했다.

### 13.2 외부 결정 체크포인트

아래 항목은 내부 UI만 추가하면 거짓 완료가 되므로 `외부 결정 대기`로 체크하고, 결정 전까지
안전하게 비활성·국소 안내 상태를 유지한다. 결정이 끝나면 ADR, API/데이터 계약, 장애·감사
E2E를 함께 갱신해야 한다.

| 결정 ID | 상태               | 차단 범위                        | 필요한 외부 결정                                                                         | 현재 안전 상태                                                                      |
| ------- | ------------------ | -------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `D-01`  | 외부 결정 대기     | 기업 SSO·SCIM 운영 연결          | Entra/Okta 우선순위, Domain 소유 검증, MFA·복구, JIT/SCIM Mapping과 Break-glass 정책     | 표준 SCIM API·Credential·건강·Event까지만 제공하고 실제 IdP 연결은 활성화하지 않음  |
| `D-08`  | 외부 결정 대기     | Home 일정·결재                   | Microsoft/Google 및 결재 원천 우선순위, OAuth Scope, Webhook·삭제·동기화 SLA             | 샘플 일정을 만들지 않고 Connector 필요 상태 표시                                    |
| `D-09`  | 외부 결정 대기     | 조직도 Export·Print              | 허용 역할·필드 Masking·Watermark·만료·수신자와 다운로드 감사 정책                        | 화면 탐색·권한 유지 Deep link만 제공하고 파일 반출은 제공하지 않음                  |
| `D-10`  | 외부 결정 대기     | 전 메뉴 출시 접근성              | CI Browser/OS 조합, NVDA·JAWS·VoiceOver 승인 절차와 증거 보관 방식                       | 320px·200% Text-size·Axe 자동 Gate 유지                                             |
| `D-11`  | 고객 계약 대기     | Workforce 장기 추세·실행         | 고객 HRIS Mapping, Delta/Full, Reconciliation Owner, 보존 기간·SLA                       | 합성 수집의 운영 사용 차단, 현재/비교 Projection만 표시                             |
| `D-12`  | 인프라 결정 대기   | 감사 대량 반출                   | Queue/Worker, KMS 암호화 Object Storage·WORM/만료, 분할·취소·알림·최대 행 정책           | 현재 동기 Export는 제한 행·사유·SHA-256 증거 범위로만 제공                          |
| `D-13`  | 연동 계약 대기     | Provider 자동 Rollback·고객 통지 | 배포 실행기 Adapter, Idempotency·Compensation, 승인 Gate, 통지 채널·Template·수신자 정책 | 계획·승인·실행 원장과 통지 준수 여부만 제공하고 자동 실행하지 않음                  |
| `D-14`  | 인프라 결정 대기   | Tenant 미디어 운영 수명주기      | Object Storage·KMS·Versioning, Malware Scan, CDN Purge, Revision 보존·삭제 기간          | Local Adapter와 불변 Revision 참조 Asset을 유지하고 자동 삭제하지 않음              |
| `D-15`  | 거버넌스 결정 대기 | 공지 승인·다중 채널·확인 증적    | 승인 분리, 긴급 채널, 수신 확인 기준, 지역별 보존·개인정보와 실패 재처리 정책            | Tenant Admin 단일 게시와 Home View/Action 집계만 제공하고 채널 발송을 가장하지 않음 |

## 14. 완료 판정

- 한 메뉴의 대표 업무를 처음부터 끝까지 수행하고 결과·감사 증거를 확인할 수 있다.
- 화면 유형과 정보 밀도가 업무 성격에 맞으며 불필요한 Card·Chart·빈 영역이 없다.
- Scope·기간·Freshness·Selection이 관련 Surface에 일관되게 반영된다.
- 1440/1280/390/320px, 200% Zoom, Keyboard, Light/Dark/High Contrast/Reduced Motion을 통과한다.
- 정상뿐 아니라 Healthy Empty, No data, Partial, Stale, Error, Permission 상태가 검증된다.
- 실제 API 계약이 없는 Trend·Insight·AI·성공 상태를 만들어내지 않는다.

## 15. 외부 기준

- [Grafana dashboard best practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/)
- [PagerDuty Operations Console](https://support.pagerduty.com/main/docs/operations-console)
- [Azure Monitor Workbooks interactive reports](https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-interactive-reports)
- [Datadog template variables](https://docs.datadoghq.com/dashboards/template_variables/)
- [Google Cloud custom dashboards](https://docs.cloud.google.com/monitoring/charts/dashboards)
- [AWS CloudWatch dashboard widgets](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/create-and-work-with-widgets.html)
