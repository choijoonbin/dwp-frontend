# DWP Product Experience Rules

> 상태: R0.7 Product Experience Decision
>
> 기준일: 2026-08-12
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

## 2. 첨부 레퍼런스 판정

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

## 3. 공식 제품 비교에서 확인한 운영 계약

| 제품                         | 검증된 패턴                                                                | DWP 적용                                                              |
| ---------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Grafana                      | Dashboard가 질문에 답하고 일반에서 상세로 내려가며 이상 항목을 우선 표시   | 각 Command Center에 하나의 운영 질문과 계층형 Drill-down 고정         |
| PagerDuty Operations Console | Live 사건 목록, 저장·공유 가능한 보기, 상세 Side Panel, 일괄 조치          | 우선 조치 Queue와 Context Inspector, 실행 상태를 하나의 흐름으로 연결 |
| Azure Monitor Workbooks      | Parameter 변경이 연결된 시각화를 갱신하고 행·Chart 선택이 후속 상세를 제어 | Scope·기간·선택을 화면 전체의 공통 Context로 사용                     |
| Datadog                      | Template Variable, Saved View, Tab으로 같은 Dashboard를 범위별 재사용      | 테넌트·리전·서비스 View를 복제하지 않고 Context로 전환                |
| Google Cloud Monitoring      | 지표, Incident, SLO, Log, Event를 한 Dashboard에서 상관 분석               | 상태 수치 옆에 변경·Incident·Audit Event를 연결                       |
| AWS CloudWatch               | Alarm 변화 우선, Live/기간 제어, Sparkline Number와 연결 Chart             | 현재값에는 추세 또는 기준을, 실시간 값에는 Freshness를 표시           |

## 4. 페이지 Archetype

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

## 5. 화면 밀도 판정

- **Simple**: 하나의 개인 선택, 작은 설정, 확인 중심 업무. 한 Column 또는 짧은 2-Column
  Form이 적절하며 시각화를 추가하지 않는다.
- **Structured**: 검색·비교·상세가 필요한 일상 운영. List-detail이나 단계형 Section을 쓴다.
- **Dense**: 다중 범위·시간·위험·상관관계를 동시에 판단하는 전문 운영. 내부 12-Column
  Grid와 연결된 Data Surface를 쓰되 첫 Viewport의 주 질문은 하나로 제한한다.

빈 공간은 고급스러움이 아니다. 반대로 밀도는 모든 공간을 채우는 것이 아니다. 정보의 관계와
다음 행동이 보이도록 필요한 만큼만 사용한다.

## 6. Layout와 Surface

- Shell의 Workspace Canvas는 Fluid를 유지하되 콘텐츠는 최대 `1600px`의 안정적인 내부
  12-Column Grid로 묶는다. 초광폭에서 관계가 끊기는 긴 직선을 만들지 않는다.
- Command Center는 `4/8/12` Column으로 반응하고, 주 Surface와 보조 Surface의 비율을
  명시한다. 단순히 화면을 반으로 나누지 않는다.
- Surface Level은 세 단계만 사용한다.
  - `canvas`: 제품 배경
  - `section`: 관련 정보를 묶는 낮은 Tone Surface
  - `floating`: Dialog, Menu, Inspector처럼 실제로 떠 있는 Layer
- Card는 반복 객체, 경계가 필요한 도구, 선택 가능한 요약에만 사용한다. Section 전체를
  떠 있는 Card로 만들거나 Card 안에 Card를 넣지 않는다.
- 건강한 반복은 압축한다. 예외가 발생하면 해당 Surface가 확장되어 원인과 영향을 보여준다.

## 7. Color와 데이터 시각화

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

## 8. Motion과 Feedback

- Hover/Press `80-120ms`, 선택·Inspector `160-220ms`, 큰 Pane 전환 `220-280ms`를 사용한다.
- Metric, Row, Graph Node 선택 시 관련 Surface가 같은 Context로 전환되는 원인을 보여준다.
- Live Indicator는 데이터가 실제 갱신될 때만 사용한다. 단순 Pulse Animation으로 실시간처럼
  보이게 하지 않는다.
- 새 데이터는 Layout Shift 없이 Highlight 후 안정 상태로 돌아간다.
- `prefers-reduced-motion`과 개인 설정에서 위치 이동·연속 Animation을 제거한다.

## 9. 운영 Dashboard 완료 계약

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

## 10. 단순 화면 완료 계약

단순해야 하는 화면은 시각적 요소를 늘리는 대신 다음을 완성한다.

- 명확한 Section 이름과 한 줄 설명
- 입력 Control에 맞는 즉시 Validation과 도움말
- Auto-save면 Saving/Saved/Failed 상태, 수동 저장이면 Dirty 상태와 이탈 경고
- 정책으로 잠긴 값의 원천과 예외 요청 경로
- Keyboard, 200% Zoom, 긴 한영 문구에서 안정적인 정렬
- 성공 후 무엇이 반영됐는지 확인 가능한 Feedback

## 11. 공통 컴포넌트 우선순위

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

## 12. 품질 Gate

- 1440, 1280, 390, 320px와 200% Zoom
- Light, Dark, High Contrast, Reduced Motion
- Keyboard-only, Visible Focus, Screen Reader Landmark와 Chart Summary
- 긴 한국어·영어, 큰 수치, 빈 값, Error와 Partial API Failure
- 첫 Viewport의 실제 업무 노출, Overflow와 Layout Shift 0
- Playwright Screenshot과 주요 Canvas Pixel/Content 검증
- 실제 데이터 계약이 없는 Trend, AI 결과, 성공 상태를 화면에 만들지 않음

## 13. 참고 자료

- [Grafana dashboard best practices](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/)
- [PagerDuty Operations Console](https://support.pagerduty.com/main/docs/operations-console)
- [Azure Monitor Workbooks interactive reports](https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-interactive-reports)
- [Datadog dashboard template variables and saved views](https://docs.datadoghq.com/dashboards/template_variables/)
- [Google Cloud custom dashboards](https://docs.cloud.google.com/monitoring/charts/dashboards)
- [AWS CloudWatch dashboard widgets](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/create-and-work-with-widgets.html)
- [Atlassian data visualization color](https://atlassian.design/foundations/color-new/data-visualization-color/)
- [Material canonical layouts](https://m3.material.io/foundations/layout/canonical-examples/overview)
