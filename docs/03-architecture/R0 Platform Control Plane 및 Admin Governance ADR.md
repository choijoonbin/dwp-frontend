# R0 Platform Control Plane 및 Admin Governance ADR

> 상태: Accepted v1.0
>
> 기준일: 2026-08-08
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`, `dwp_agent`

## 1. 결정 배경

DWP는 여러 Tenant의 사용자, 업무 시스템, 앱, Connector와 AI Agent를 연결한다.
따라서 관리 기능은 화면 몇 개가 아니라 제품 전체의 권한, 구성, 배포와 감사 기준을
소유하는 Control Plane이어야 한다. 인증 성공만으로 Tenant 격리가 보장되지 않으며,
각 데이터 접근에서 검증된 Tenant Context를 일관되게 적용해야 한다.

## 2. 결정

### 2.1 Control Plane과 Data Plane을 분리한다

- `dwp-platform-server`는 Tenant 기준정보, 제품 Registry, 정책 Metadata와 관리
  감사 이벤트를 소유한다.
- Gateway는 Browser Session을 검증하고 내부 Service Identity와 검증된 사용자,
  Tenant, Role Header를 Platform Service에 전달한다.
- Agent Runtime은 별도 Runtime Read Token으로 Active Catalog만 조회하며 Admin API에는
  접근할 수 없다.
- Platform Service 직접 호출은 Service Token이 없으면 거부한다.
- 업무 원장, 메일 원문, 문서 본문, Vector와 Agent 실행 데이터는 각 Data Plane의
  명시된 Owner가 소유한다.

### 2.2 관리 경계를 네 단계로 분리한다

| Plane             | 범위                    | 대표 책임                                      | 현재 상태                 |
| ----------------- | ----------------------- | ---------------------------------------------- | ------------------------- |
| Provider Admin    | 전체 제품·Tenant        | Tenant 개통, Entitlement, Release, SLO, 지원   | 설계 기준 확정, UI 미공개 |
| Tenant Admin      | 단일 Tenant             | 조직, 권한, 기준정보, 앱·연동·Agent 정책, 감사 | 기준정보·감사 구현        |
| Delegated Admin   | 단일 Tenant의 위임 범위 | HR·IT 등 Domain별 Catalog와 승인               | RBAC·ABAC 확장 후 구현    |
| User Self-service | 본인                    | 언어, Theme, Density, 알림, 개인화             | 일반 설정으로 분리        |

Provider Admin API는 Tenant Admin API에 Cross-tenant 조건을 추가하는 방식으로 만들지
않는다. 별도 Route, 권한, Service와 감사 정책을 사용한다.

### 2.3 관리 데이터의 성격을 구분한다

| 유형                  | 예시                                    | Source of Truth       | 변경 방식                     |
| --------------------- | --------------------------------------- | --------------------- | ----------------------------- |
| System invariant      | 내부 Error Code, Lifecycle, 권한 연산자 | Source·Migration      | Release Review                |
| Tenant reference data | 우선순위, 지역, 업무 분류               | `dwp_platform`        | Draft, Activate, Retire       |
| Typed runtime config  | 기능 Flag, 제한값, Rollout              | 전용 Schema·Provider  | Schema 검증, 단계 배포        |
| Product registry      | App, Connector, Agent, Tool, Policy     | Catalog + 유형별 상세 | Owner·Risk·Version·Lifecycle  |
| Secret                | OAuth Secret, API Key                   | 외부 Vault            | 참조 ID만 저장, Rotation      |
| Executable policy     | 접근·Agent·보존 정책                    | Versioned Artifact    | 검토, 승인, Publish, Rollback |

System invariant를 편집 가능한 공통코드로 만들지 않는다. Secret 원문을 Platform DB에
저장하지 않는다. 기능 Flag와 정책은 기준정보 Key-Value에 섞지 않는다.

### 2.4 공통 Lifecycle과 감사 계약

- 관리 객체의 기본 Lifecycle은 `DRAFT -> ACTIVE -> RETIRED`다.
- 갱신은 Optimistic Version을 요구하며 충돌은 HTTP `409`로 응답한다.
- 활성 객체만 Runtime API에 노출한다.
- 생성, 변경, 활성화, 폐기, 승인과 거부는 Actor, Tenant, Target, Outcome,
  Correlation ID와 변경 전후 Snapshot으로 기록한다.
- 감사 이벤트는 일반 관리 API로 수정·삭제하지 않는다.

### 2.5 Tenant 격리는 모든 계층에서 적용한다

- Repository Query는 항상 `tenant_id`를 조건에 포함한다.
- Client가 전달한 Tenant Header를 신뢰하지 않고 Gateway가 인증된 Session에서
  다시 생성한다.
- Cache Key, Event Partition, Search Filter와 Agent Context에도 Tenant를 포함한다.
- Production 전 PostgreSQL RLS 또는 동등한 방어 계층을 추가하고 격리 Test를 CI에
  고정한다.

## 3. Admin Information Architecture

| 영역                  | Tenant Admin Capability                              | 목표 단계 |
| --------------------- | ---------------------------------------------------- | --------- |
| Overview              | 구성 상태, 보안 경고, 동기화·실행 Health             | R2        |
| Organization & Access | 사용자, 조직, 그룹, Role, SCIM, 위임                 | R1~R2     |
| Standards             | 기준정보, 분류, 다국어 Label, 유효기간               | R0 완료   |
| Catalogs              | App, Service, Widget, Template, Entitlement          | R1        |
| Integrations          | Connector, Data Source, Credential Ref, Sync Health  | R1~R2     |
| AI & Automation       | Agent, Tool, Model Route, Risk, Approval, Evaluation | R1~R3     |
| Security & Compliance | Policy, Retention, Consent, Audit, Export            | R1~R3     |
| Operations            | Feature Rollout, Notification, Usage, Cost, SLO      | R2~R4     |

현재 동작하지 않는 영역은 Placeholder 메뉴로 노출하지 않는다. 구현과 권한 계약,
Empty·Error 상태가 완성된 영역만 Navigation에 추가한다.

## 4. 구현 순서

1. **P0 Trust Foundation:** Session, CSRF, Gateway Service Identity, Tenant Context
2. **P1 Standards:** Tenant 기준정보, Locale Label, Lifecycle, Audit
3. **P2 Catalog:** App·Connector·Agent·Tool·Policy Registry 공통 Envelope
4. **P3 Identity Governance:** Organization, SCIM, RBAC·ABAC, 위임과 SoD
5. **P4 Integration Operations:** Credential Reference, Sync, Health, Retry, Quota
6. **P5 Agent Governance:** Model Route, Risk Tier, Tool Grant, Approval, Evaluation
7. **P6 Platform Operations:** Feature Rollout, SLO, 비용, 보존, Export와 Support

각 단계는 이전 단계의 Tenant 격리, 감사와 자동 Test를 재사용해야 한다.

## 5. 결과와 Trade-off

- 장점: 제품 운영 기능이 업무 기능과 분리되고, 새 Domain Pack이 공통 통제를 재사용한다.
- 장점: Tenant 관리자와 Provider 운영자의 권한 혼합을 예방한다.
- 비용: 초기부터 Lifecycle, Audit, Schema와 권한 계약을 유지해야 한다.
- 제한: 현재 구현은 Tenant Admin의 기준정보·감사 최소 범위이며 Provider Admin,
  승인 Workflow와 DB RLS는 후속 Gate다.

## 6. 근거

- [AWS SaaS Lens - General design principles](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/general-design-principles.html)
- [AWS SaaS Lens - Tenant isolation](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/isolation-mindset.html)
- [OpenFeature specification](https://openfeature.dev/specification/)
- [SCIM Core Schema, RFC 7643](https://www.rfc-editor.org/rfc/rfc7643)
- [SCIM Protocol, RFC 7644](https://www.rfc-editor.org/rfc/rfc7644)
- [Microsoft 365 Agent Registry](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/agent-registry?view=o365-worldwide)
