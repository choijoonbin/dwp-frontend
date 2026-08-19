# DWP Product Experience Rules

> 상태: R0.8 Product Experience Decision
>
> 기준일: 2026-08-14
>
> 적용 범위: `dwp-frontend`의 모든 사용자·테넌트 관리자·Provider 화면

## 1. 결정

DWP는 글로벌 엔터프라이즈 제품의 **기능과 통제 방식**은 학습하지만 SAP, Salesforce,
Azure Portal과 같은 시각 스타일을 답습하지 않는다. 또한 Mantis·Minimal 같은 Dashboard
Template의 밝은 색, Card와 Chart를 그대로 복제하지 않는다.

DWP의 제품 경험은 다음 네 가지로 정의한다.

1. **Operational pulse**: 현재 상태가 아니라 무엇이 변했고 누구에게 영향을 주며 무엇을
   먼저 해야 하는지 보여준다.
2. **Connected context**: 지표, 목록, 관계, 상세와 실행이 같은 Scope를 공유한다.
3. **Elastic detail**: 첫 화면은 빠르게 읽히고, 선택할수록 필요한 수준까지 깊어진다.
4. **Calm momentum**: 화면은 조용하지만 정적이지 않다. Live 상태, 변화, 진행과 원인-결과가
   짧고 분명한 상호작용으로 드러난다.

고급스러움은 Glass, 큰 Hero, 그림자나 장식이 아니라 정보 구조의 자신감, 빠른 반응,
정확한 상태, 세밀한 Feedback과 일관된 마감에서 만든다.

## 2. Product Experience Profile

모든 앱이 같은 Admin Theme를 공유하지 않는다. 공통 Shell·Form·상태·접근성 계약은 유지하되,
앱의 핵심 업무가 요구하는 탐색 방식과 정보 밀도를 `Product Experience Profile`로 구분한다.

| 앱        | Concept         | 기본 경험                                   | 시각 신호                           |
| --------- | --------------- | ------------------------------------------- | ----------------------------------- |
| DWP HCM   | `people-flow`   | 사람·여정·지원 행동 중심, 편안한 밀도       | Teal 기준색과 제한된 Coral 신호     |
| Calendar  | `temporal-flow` | 시간축·가용성·충돌 해소 중심, 표준 밀도     | Cobalt 기준색과 Cyan 보조 신호      |
| Approvals | `decision-flow` | 판단 근거·위험·기한·감사 중심, 표준 밀도    | Ink Blue 기준색과 Saffron 주의 신호 |
| Mail      | `message-flow`  | 읽기·분류·회신·후속 조치 중심의 고밀도 목록 | 향후 제품 계약과 함께 확정          |
| Chat      | `presence-flow` | 대화·현재성·맥락 전환 중심의 실시간 흐름    | 향후 제품 계약과 함께 확정          |

Profile은 `concept`, `density`, `canvas`, `accent`, `selection`, `softSurface`만 변경한다.
Button 의미, Focus, Error, 권한, Loading, 반응형 Breakpoint와 Design Token 명명은 앱마다
재해석하지 않는다. 새 Product Shell은 Profile 등록과 상호 차별성 Test가 없으면 배포하지 않는다.

### Product Profile 승인 계약

새 앱은 색상과 아이콘만 바꾼 공통 Admin 화면으로 출시할 수 없다. 구현 전에 다음 계약을
문서와 Test로 고정한다.

1. 사용자가 앱에 들어온 뒤 5초 안에 답해야 하는 대표 업무 질문
2. 구성원·관리자·운영자별 시작 화면과 허용 Navigation
3. 주 Page Archetype과 List·Detail·Workflow 사이의 Context 전달 방식
4. 앱만의 정보 밀도, 선택 상태, Empty·Partial·Error 표현과 핵심 Interaction
5. 공통 Shell·권한·Form·접근성 Token을 침범하지 않는 Profile 범위
6. Desktop·Mobile·Dark·High Contrast Screenshot과 권한·Keyboard E2E 증거

Mail은 `message-flow`에 맞춰 Folder/Label, 고밀도 Message List, Reading Pane, Compose를
연속된 문맥으로 제공하고 Unread·Follow-up·Attachment·Bulk Action을 우선한다. 장식용 KPI
Dashboard를 첫 화면으로 만들지 않는다.

Chat은 `presence-flow`에 맞춰 Space/Channel, 대화, Thread, 검색과 현재성을 중심으로 구성한다.
연결·재연결·전송 중·실패·읽음 상태를 즉시 설명하고, 긴 관리 Table이나 새로고침 중심 경험을
대화 Surface에 이식하지 않는다.

Approvals는 `decision-flow`를 유지해 요청 목록보다 판단 근거, 기한, 위험, 위임, 전자서명과
결정 후 감사 증거를 앞세운다. Calendar는 `temporal-flow`, DWP HCM은 `people-flow` 계약을 같은
방식으로 유지한다.

### HCM `people-flow` Home 계약

- 개인 홈의 범용 오늘 할 일·일정·공지·앱 현황을 HCM Home에 반복하지 않는다.
- 첫 화면은 **Compact Context → 필수 Needs attention → People Rhythm → 선택형 HR 도구** 순서다.
- `Needs attention`은 사용자가 실제 처리할 수 있는 항목만 포함하며 개인화로 숨길 수 없다.
- 화면 이동 링크는 `HR 도구`로 부르고, 현재 화면에서 완료되지 않는 기능을 Quick Action으로
  오인시키지 않는다.
- Manager·HR Operator 정보는 일반 구성원 정보에 누적하지 않고 `나 / 내 팀 / HR 운영`
  Context로 분리한다. Context 전환은 Backend 권한이나 Target Population을 확장하지 않는다.
- 근태는 기록 → 검증 → 제출 단계, 휴가·급여·복리후생·Journey는 실제 다음 이벤트와 진행
  상태로 보여준다. 서로 다른 도메인의 숫자를 장식용 KPI로 나열하지 않는다.
- HCM 색은 업무 범주를 구분할 때만 쓰며 전체 화면을 Teal 단색 Theme로 만들지 않는다.
- 기능이 없는 Chart·가상 추세·Stock Illustration은 넣지 않는다. 실제 Aggregate가 없는
  Insight는 신뢰 가능한 Empty/Unavailable 상태로 설명한다.
- `0`, `Unavailable`, `Reference`, `Partial`, `Error`를 서로 다른 데이터 상태로 표현한다.
- Mobile은 동일 정보를 축소하지 않고 Context → Needs attention → Rhythm → Tools 순으로
  한 Column에 재배치한다.

### 설계 고정과 변경 조건

- 승인된 Product Profile과 첫 화면의 정보 계층은 새로운 경쟁사 Screenshot이나 Template를
  발견했다는 이유만으로 다시 설계하지 않는다.
- 글로벌 제품에서는 업무 수명주기, 역할 분리, 권한 통제, 예외 복구, 감사 방식을 학습한다.
  Tile Portal, Admin Table, Card 배열, 색상 Theme는 그대로 이식하지 않는다.
- 변경은 사용성 실패, 권한·데이터 오류, 접근성·성능 Gate 실패, 고객 정책 또는 System of
  Record 계약 변경 중 하나의 증거가 있을 때만 시작한다.
- 변경 전 문제 증거, 유지할 계약, 영향 역할·경로·API, 회귀 Test와 Rollback 범위를 기록한다.
  막연한 `더 현대적으로` 또는 `경쟁사처럼`은 변경 사유가 아니다.
- 개선은 실패한 업무 범위에 한정한다. 이미 통과한 IA와 공통 Component를 전면 교체해 같은
  문제를 반복 해결하지 않는다.

## 3. 첨부 레퍼런스 판정

### 배울 점

- 안정적인 내부 Grid와 일정한 Section 폭으로 넓은 화면에서도 관계가 유지된다.
- KPI, Chart, Table, Activity를 서로 다른 정보 형태로 표현해 시각적 리듬이 있다.
- 중요 수치에 변화 방향과 비교 기간을 붙여 현재값의 의미를 빠르게 해석할 수 있다.
- 색과 여백이 Section의 목적을 구분하고, 첫 Viewport에서 제품이 살아 있다는 인상을 준다.

### 그대로 채택하지 않을 점

- 업무와 무관한 Welcome Hero, 3D Illustration, Stock Avatar는 운영 지휘 화면에 넣지 않는다.
- 모든 수치를 Card로 만들거나 장식용 Donut, Gauge, Area Chart를 추가하지 않는다.
- 실제 데이터 계약이 없는 추세와 가짜 Demo 수치를 만들지 않는다.
- 색이 많다는 이유만으로 현대적인 것이 아니다. 상태, 범주, 비교라는 의미가 있을 때만 쓴다.

## 4. 공식 제품 비교에서 확인한 운영 계약

| 제품                         | 검증된 패턴                                                                | DWP 적용                                                              |
| ---------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Grafana                      | Dashboard가 질문에 답하고 일반에서 상세로 내려가며 이상 항목을 우선 표시   | 각 Command Center에 하나의 운영 질문과 계층형 Drill-down 고정         |
| PagerDuty Operations Console | Live 사건 목록, 저장·공유 가능한 보기, 상세 Side Panel, 일괄 조치          | 우선 조치 Queue와 Context Inspector, 실행 상태를 하나의 흐름으로 연결 |
| Azure Monitor Workbooks      | Parameter 변경이 연결된 시각화를 갱신하고 행·Chart 선택이 후속 상세를 제어 | Scope·기간·선택을 화면 전체의 공통 Context로 사용                     |
| Datadog                      | Template Variable, Saved View, Tab으로 같은 Dashboard를 범위별 재사용      | 테넌트·리전·서비스 View를 복제하지 않고 Context로 전환                |
| Google Cloud Monitoring      | 지표, Incident, SLO, Log, Event를 한 Dashboard에서 상관 분석               | 상태 수치 옆에 변경·Incident·Audit Event를 연결                       |
| AWS CloudWatch               | Alarm 변화 우선, Live/기간 제어, Sparkline Number와 연결 Chart             | 현재값에는 추세 또는 기준을, 실시간 값에는 Freshness를 표시           |

## 5. 페이지 Archetype

화면을 만들기 전에 다음 중 하나를 선택한다. 둘 이상이 필요하면 주 Archetype과 보조
Archetype을 명시한다.

| Archetype      | 적합한 업무                   | 기본 구조                                               | 피해야 할 것                                     |
| -------------- | ----------------------------- | ------------------------------------------------------- | ------------------------------------------------ |
| Command center | 상태·위험·우선 조치 판단      | Pulse → 핵심 신호 → 조치 Queue → 영향·추세 → Activity   | 동등한 KPI 나열, 전체 정상 항목 반복, 장식 Chart |
| List-detail    | 많은 객체 비교와 한 객체 판단 | Filter/Saved view → List/Grid → Inspector/Detail        | 표만 있는 화면, 선택 후 Context 소실             |
| Workflow       | 생성·승인·변경·복구           | 단계·요건 → 작업 Surface → 검토·영향 → 결과 Timeline    | 긴 단일 Form, 실행 후 결과 단절                  |
| Studio         | Branding·Home·Navigation 편집 | 도구/속성 → 실제 Preview → 품질 검사 → 게시 이력        | 작은 Sample Preview, 저장만 있는 Form            |
| Graph explorer | 조직·관계·데이터 흐름 탐색    | Search/Scope → Canvas → Minimap → Inspector → 영향 경로 | 전체 Fit만 제공, Label이 읽히지 않는 초기 화면   |
| Focus form     | 개인 설정·보안·작은 편집      | 짧은 설명 → Sectioned Form → Auto-save 상태/명시적 제출 | Dashboard 장식, 불필요한 Chart와 KPI             |

## 6. 화면 밀도 판정

- **Simple**: 하나의 개인 선택, 작은 설정, 확인 중심 업무. 한 Column 또는 짧은 2-Column
  Form이 적절하며 시각화를 추가하지 않는다.
- **Structured**: 검색·비교·상세가 필요한 일상 운영. List-detail이나 단계형 Section을 쓴다.
- **Dense**: 다중 범위·시간·위험·상관관계를 동시에 판단하는 전문 운영. 내부 12-Column
  Grid와 연결된 Data Surface를 쓰되 첫 Viewport의 주 질문은 하나로 제한한다.

빈 공간은 고급스러움이 아니다. 반대로 밀도는 모든 공간을 채우는 것이 아니다. 정보의 관계와
다음 행동이 보이도록 필요한 만큼만 사용한다.

## 7. Layout와 Surface

- Shell의 Workspace Canvas는 Fluid를 유지하되 콘텐츠는 최대 `1600px`의 안정적인 내부
  12-Column Grid로 묶는다. 초광폭에서 관계가 끊기는 긴 직선을 만들지 않는다.
- Command Center는 `4/8/12` Column으로 반응하고, 주 Surface와 보조 Surface의 비율을
  명시한다. 단순히 화면을 반으로 나누지 않는다.
- Personal Widget Canvas는 2·3·4·5분할의 최소공배수인 60단위 논리 Grid를 사용한다.
  Desktop Footprint는 `12·15·20·30·40·60`, Tablet과 Mobile은 `60`만
  사용한다. 이 단위는 배치 계산용이며 시각적 60열 Gutter를 만들지 않는다.
- Widget의 보이는 Surface는 배치용 Wrapper가 아니라 내부 `section`이 소유한다. 표준
  `balanced` 간격은 Mobile `16px`, Tablet `20px`, Desktop `24px`이며 `focused`는
  Desktop `16px`, `expressive`는 Desktop `32px`를 사용한다. 가로·세로 간격과 편집
  Outline은 동일한 중앙 Spacing Policy에서 계산하고 화면별 값으로 덮어쓰지 않는다.
- Widget 폭 선택은 `작게·보통·넓게` Text Menu가 아니라 실제 점유 비율을 그린 Icon
  Segmented Control로 제공한다. 모든 Icon에는 `한 줄에 N개` 형식의 Tooltip과 접근성
  이름을 연결하고, Registry가 선언한 최소·최대 Footprint 밖의 선택지는 노출하지 않는다.
- Surface Level은 세 단계만 사용한다.
  - `canvas`: 제품 배경
  - `section`: 관련 정보를 묶는 낮은 Tone Surface
  - `floating`: Dialog, Menu, Inspector처럼 실제로 떠 있는 Layer
- Card는 반복 객체, 경계가 필요한 도구, 선택 가능한 요약에만 사용한다. Section 전체를
  떠 있는 Card로 만들거나 Card 안에 Card를 넣지 않는다.
- 건강한 반복은 압축한다. 예외가 발생하면 해당 Surface가 확장되어 원인과 영향을 보여준다.

## 8. Color와 데이터 시각화

### Section Header와 아이콘

- 독립적인 Workspace 콘텐츠·Widget Section 제목은 디자인 시스템의 `SectionHeader`만 사용한다.
  Page Hero, Navigation과 Launchpad의 구성 Label은 이 패턴을 사용하지 않는다.
- 제목 아이콘은 Lucide 선형 아이콘, `30px` 저채도 Tonal Plate, `17px` Glyph,
  `1.8px` Stroke로 고정한다. 아이콘을 그대로 노출하거나 개별 테두리·배경·크기를 만들지 않는다.
- 제목, 아이콘, 우측 Meta와 하단 Divider의 정렬은 각 화면에서 재정의하지 않는다.
- 같은 계층의 제목 아이콘은 `primary` Tone을 공유한다. 상태·위험·범주 Color는 제목 장식이
  아니라 Meta, Badge 또는 본문 데이터에만 사용한다.
- 아이콘은 제목을 중복 낭독하지 않도록 장식 요소로 숨기고, Section은 실제 Heading ID로
  이름을 갖는다.

### 역할

- Cobalt: 주 Action, 선택, 기준 Series
- Teal: 검증·건강·완료
- Saffron: 주의·예산 소진·예정 변경
- Coral: 실패·고객 영향·즉시 대응
- Cyan: 관찰·정보·보조 비교
- Violet: 독립 범주 비교에만 사용하며 AI의 고정 색으로 사용하지 않음

### 규칙

- 범주형 Chart는 기본 5개, 최대 6개 색으로 제한한다.
- 상태색과 범주색을 같은 Chart에서 혼용하지 않는다.
- 현재 수치에는 비교 기간, 기준, 임계치 또는 `비교 데이터 없음` 중 하나를 제공한다.
- Hover, Keyboard Focus와 선택 상태를 제공하고 선택이 관련 상세를 갱신하도록 한다.
- 색만으로 구분하지 않고 Label, 수치, Pattern 또는 Icon을 함께 제공한다.
- Chart의 핵심 값은 Screen Reader용 요약과 Table/목록 대안을 제공한다.

## 9. Motion과 Feedback

- Hover/Press `80-120ms`, 선택·Inspector `160-220ms`, 큰 Pane 전환 `220-280ms`를 사용한다.
- Metric, Row, Graph Node 선택 시 관련 Surface가 같은 Context로 전환되는 원인을 보여준다.
- Live Indicator는 데이터가 실제 갱신될 때만 사용한다. 단순 Pulse Animation으로 실시간처럼
  보이게 하지 않는다.
- 새 데이터는 Layout Shift 없이 Highlight 후 안정 상태로 돌아간다.
- `prefers-reduced-motion`과 개인 설정에서 위치 이동·연속 Animation을 제거한다.

## 10. 운영 Dashboard 완료 계약

다음 항목이 없으면 Command Center를 완료로 판정하지 않는다.

1. 사용자와 화면이 답해야 하는 운영 질문
2. Tenant/Region/Service 등 Scope
3. 기간 또는 현재 Snapshot이라는 시간 의미
4. Live/Paused/Stale와 최근 성공 갱신 시각
5. 현재값의 Baseline, Threshold, Trend 또는 비교 불가 표시
6. 고객·사용자 영향 우선 표현
7. 위험도·영향·시간으로 정렬된 Action Queue
8. Metric/Row/Graph 선택에서 Detail로 이어지는 Drill-down
9. Incident·Change·Audit Event의 상관관계
10. Loading, Healthy Empty, No data, Partial, Error, Permission 상태

## 11. 단순 화면 완료 계약

단순해야 하는 화면은 시각적 요소를 늘리는 대신 다음을 완성한다.

- 명확한 Section 이름과 한 줄 설명
- 입력 Control에 맞는 즉시 Validation과 도움말
- Auto-save면 Saving/Saved/Failed 상태, 수동 저장이면 Dirty 상태와 이탈 경고
- 정책으로 잠긴 값의 원천과 예외 요청 경로
- Keyboard, 200% Zoom, 긴 한영 문구에서 안정적인 정렬
- 성공 후 무엇이 반영됐는지 확인 가능한 Feedback

## 12. 공통 컴포넌트 우선순위

| 단계 | 컴포넌트                | 제품 계약                                           |
| ---- | ----------------------- | --------------------------------------------------- |
| P0   | `OperationalContextBar` | Scope, 기간, Live/Freshness, 저장된 View            |
| P0   | `SignalMetric`          | 값, 상태, 비교 의미, Mini Trend, Drill-down         |
| P0   | `ActionQueue`           | 영향·위험·시간 정렬, 선택, 일괄/개별 Action         |
| P0   | `HealthMatrix`          | 서비스와 범위별 상태 분포, Exception 우선           |
| P1   | `LinkedInspector`       | 선택 Context, 관련 객체, Timeline, 명령, Focus 복원 |
| P1   | `EventCorrelationLane`  | Incident·Change·Deployment·Audit의 시간 상관관계    |
| P1   | `RelationshipCanvas`    | 조직·권한·데이터·제품 관계의 공통 Graph 조작        |
| P2   | `StudioPreviewFrame`    | Viewport·Locale·Theme 전환, 품질 검사, 게시 비교    |

## 13. 품질 Gate

- 1440, 1280, 390, 320px와 200% Zoom
- Light, Dark, High Contrast, Reduced Motion
- Keyboard-only, Visible Focus, Screen Reader Landmark와 Chart Summary
- 긴 한국어·영어, 큰 수치, 빈 값, Error와 Partial API Failure
- 첫 Viewport의 실제 업무 노출, Overflow와 Layout Shift 0
- Playwright Screenshot과 주요 Canvas Pixel/Content 검증
- 실제 데이터 계약이 없는 Trend, AI 결과, 성공 상태를 화면에 만들지 않음

## 14. 참고 자료

- [Grafana dashboard best practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/)
- [PagerDuty Operations Console](https://support.pagerduty.com/main/docs/operations-console)
- [Azure Monitor Workbooks interactive reports](https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-interactive-reports)
- [Datadog dashboard template variables and saved views](https://docs.datadoghq.com/dashboards/template_variables/)
- [Google Cloud custom dashboards](https://docs.cloud.google.com/monitoring/charts/dashboards)
- [AWS CloudWatch dashboard widgets](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/create-and-work-with-widgets.html)
- [Atlassian data visualization color](https://atlassian.design/foundations/color-new/data-visualization-color/)
- [Material canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
