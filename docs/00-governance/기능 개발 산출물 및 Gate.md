# DWP 기능 개발 산출물 및 Gate

> 상태: Governance Standard v1.0
>
> 적용 범위: Frontend, Backend, Agent, Database, Figma와 운영 문서
>
> 기준일: 2026-08-08

## 1. 원칙

1. 외부 화면·사이트·문서는 복제 대상이 아니라 검증할 가설과 Pattern의 근거다.
2. 메뉴를 먼저 만들고 문서를 사후 작성하지 않는다.
3. 화면, 데이터, API, 권한, Audit와 Agent 실행은 하나의 Feature 계약으로 설계한다.
4. 구조화된 업무는 결정적 UI로 유지하고 AI가 임의로 변경하지 않는다.
5. Source of Record와 데이터 소유권이 없는 기능은 구현하지 않는다.
6. Light·Dark·High Contrast, 세 가지 Density, 한국어·영어와 주요 Viewport를 함께 설계한다.
7. 구현 완료가 아니라 사용자 Outcome과 Release Gate 통과를 완료로 본다.

## 2. Feature Package

각 기능은 다음 구조를 사용한다.

```text
docs/05-features/FEAT-<domain>-<number>/
  README.md
  01-기획 정의.md
  02-화면 설계서.md
  03-디자인 정의.md
  04-데이터 설계.md
  05-API 권한 계약.md
  06-AI Agent 계약.md
  07-수용 테스트.md
  decisions/
  assets/
```

AI를 사용하지 않는 기능도 `06-AI Agent 계약.md`에 `Not applicable`과 판단 근거를
남긴다. Database를 직접 소유하지 않는 기능은 `04-데이터 설계.md`에 원본 System,
Cache·Index·보존·삭제 계약을 기록한다.

## 3. 단계별 Gate

### G0. Evidence

- 사용자 문제, 빈도, 현재 처리시간과 오류 비용
- 참고 제품에서 관찰한 동작과 DWP 적합성
- 법무·License·개인정보·Security 초기 위험
- Build, Embed, Connect 중 권장 방식

**종료 조건:** 해결할 문제가 기능 이름이 아니라 측정 가능한 Outcome으로 정의된다.

### G1. Product Definition

- Persona, JTBD, Trigger와 End State
- In Scope, Non-goal과 실패·예외 Flow
- KPI Baseline, Target과 Analytics Event
- Entitlement, Role, Tenant와 산업 Pack 경계

**종료 조건:** Product Owner와 Domain Owner가 `01-기획 정의.md`를 승인한다.

### G2. Experience and Technical Design

- 주 사용자, 화면이 답할 업무 질문, 주 행동과 Page Archetype
- Route·Navigation·Page Title과 정보구조
- 정보 밀도를 Simple·Structured·Dense 중에서 선택한 근거
- Desktop·Tablet·Mobile 화면, 상태와 Keyboard Flow
- Dashboard의 Scope·기간·Freshness·Baseline·Drill-down 또는 단순 화면 유지 근거
- Figma File·Page·Frame URL과 Design System Component Mapping
- Table·Entity·Index·Migration·Retention·Deletion 설계
- API, Error, Idempotency, Permission, Audit와 Observability 계약
- Agent Source, Tool, Risk Tier, Approval, Stop·Retry·Rollback 계약
- Accessibility와 Performance 예산

**종료 조건:** Design, Frontend, Backend, Agent, Data와 Security Review가 완료된다.

### G3. Build Ready

- Storybook 또는 Prototype으로 핵심 상태 검증
- OpenAPI·Event·Schema Contract 승인
- Migration Rollback과 Test Data 준비
- Unit, Integration, Contract, E2E와 Evaluation 계획 승인
- Feature Flag, Rollout과 운영 Owner 지정

**종료 조건:** 구현 Issue가 승인된 문서·Figma Node·수용 기준에 연결된다.

### G4. Release Ready

- 자동 Test, Axe, Keyboard, Zoom과 Visual Regression 통과
- 1440·1280·390·320px와 200% Zoom에서 첫 Viewport·Overflow·Partial Failure 증거 확보
- 실제 계약이 없는 Trend·Insight·AI·성공 상태가 화면에 없음을 검증
- Security·Privacy·License·SBOM 검사 통과
- SLO, Dashboard, Alert, Runbook과 Support Handoff 완료
- Pilot KPI와 Feedback 수집 준비
- Rollback 또는 Kill Switch 검증

**종료 조건:** Release Owner가 증거 링크와 함께 승인한다.

## 4. Figma 운영 계약

- DWP Foundation File과 Feature Design File을 분리한다.
- Foundation은 Variable, Token, Component와 Variant만 소유한다.
- Feature File은 Flow, 화면, Annotation과 Prototype을 소유한다.
- Frame 이름은 `<feature-id>/<viewport>/<state>` 형식을 사용한다.
- 구현 Issue에는 File URL이 아니라 Node가 포함된 Frame URL을 연결한다.
- 승인 Component를 임의 Detach하지 않는다.
- Code Connect는 Public Component API가 안정된 뒤 연결한다.
- Figma 변경과 Source 변경은 동일 Feature ID와 Version을 사용한다.

## 5. 참고 자료 사용 계약

- Screenshot, URL, 관찰일, 접근 범위와 License 상태를 기록한다.
- `좋아 보임` 대신 해결하는 문제, 동작, Trade-off와 측정 가설을 기록한다.
- 외부 Asset, Source, 문구와 화면 Layout을 그대로 저장소에 복사하지 않는다.
- 채택 시 DWP Token, Component, 접근성, 권한과 데이터 계약으로 다시 설계한다.
- 기각한 Pattern도 사유를 남겨 같은 논의를 반복하지 않는다.

Frontend Experience 판단과 화면별 완료 계약은
`docs/04-design-system/DWP Product Experience Rules.md`를 필수 기준으로 사용한다.

## 6. 변경 통제

문서 승인 후 범위가 바뀌면 해당 Feature의 Decision Log에 문제, 근거, 영향받는
화면·API·Table·Agent·Test와 Rollback 영향을 기록한다. Production Hotfix는 예외로
먼저 복구할 수 있으나 24시간 안에 변경 문서와 Test를 보완한다.
