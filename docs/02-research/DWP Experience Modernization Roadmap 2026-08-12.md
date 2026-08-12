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
