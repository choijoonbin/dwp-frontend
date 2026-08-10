# People·Provisioning·Provider 구현 및 Gate

> 상태: Local Implementation Baseline v1.0
>
> 기준일: 2026-08-10
>
> 적용 저장소: `dwp-frontend`, `dwp-backend`, `dwp_agent`

## 1. 판정 기준

이 문서는 이번 범위의 구현 완료와 외부 Gate를 구분하는 Delivery Evidence다.

- **Local Baseline 완료**: Schema·API·UI·권한 경계와 위험 기반 자동 Test가 로컬에서
  동작한다.
- **External Gate**: 고객 데이터, 라이선스, Cloud 자원, 운영 Credential 또는 보안
  승인이 없어 실제 연동 완료로 표시할 수 없다.
- **Roadmap Backlog**: 이번 범위가 아니며 후속 Release에서 제품 기능으로 구현한다.

Local Baseline은 Pilot Ready나 Production Ready와 같은 의미가 아니다.

## 2. 이번 구현 완료 범위

### 2.1 Workforce와 People

- 별도 `dwp_people` Database와 Person, Worker, Work Relationship, 유효일 Assignment를
  유지한다.
- Workday `Get Workers` 계열 구조를 참고한 합성 Fixture와 Mapping Profile을 제공한다.
- 통신 운영 조직, 미래 조직 이동, 반도체 Contingent Worker를 포함한다.
- 검색, 상태, 기준일, 상세 Assignment 이력과 HMAC 서명 Cursor를 제공한다.
- 일반 관리자는 Worker Identifier를 Masking하며 Restricted 필드는 조회 모델에서
  제외한다.
- Profile Media는 Object Key만 반환하고 DB BLOB를 사용하지 않는다.

### 2.2 HRIS Connector Control

- Source System, Mapping Profile, Connector Instance, Sync Run과 Redacted Audit를 관리한다.
- Connector는 HTTPS Endpoint, Auth Mode, Secret Reference, Schedule, Lifecycle과 Health를
  가진다.
- Secret 원문은 받지 않으며 `vault://`, `secret://`, `env://`,
  `aws-secretsmanager://` 참조만 허용한다.
- Configuration Check는 Schema와 보안 구성을 검증하지만 외부 Network 호출을 했다고
  가장하지 않고 `externalConnectivityTested=false`를 반환한다.
- 합성 Workday Import는 Idempotency Key, Mapping Revision과 Sync 결과를 기록한다.

### 2.3 SCIM 2.0 Provisioning

- RFC 7643·7644의 User, Group, Filter, PATCH, ResourceTypes, Schemas와
  ServiceProviderConfig 기본 계약을 제공한다.
- Connector Bearer Token은 생성·Rotation 시 한 번만 노출하고 DB에는 Hash만 저장한다.
- Connector Lifecycle과 허용 Operation을 요청마다 검사한다.
- User·Group 생성은 External ID와 Source Ownership을 사용해 멱등 처리한다.
- 비활성화 시 Session을 폐기하고 Group Member는 Tenant와 Source 경계를 지킨다.
- ETag와 선택적 `If-Match`를 검사하며 stale 변경은 `412`로 거부한다.
- 임의 `startIndex`와 RFC 9865 방식의 서명 Cursor를 지원한다.

### 2.4 Access와 Navigation Governance

- Custom Role, Resource, Permission `ALLOW`·`DENY`, Group Role Assignment와 철회를
  관리한다.
- Scope, 유효기간, Group 출처와 실제 Permission을 설명하는 Effective Access 조회를
  제공한다.
- Navigation은 최대 2단계 Tree, BCP 47 Label, Resource·Permission, Draft·Active·Retired,
  Optimistic Version과 순서를 관리한다.
- App Navigation은 활성 APP Registry와 활성 Access Resource만 선택할 수 있으며, Backend도
  같은 참조 무결성과 Root Group 규칙을 검증한다.
- 업무 Shell은 고정 메뉴가 아니라 Runtime Navigation API와 Effective Permission을 소비한다.
  `DENY`를 우선하고 권한 조회 전에는 Fail Closed로 App을 노출하지 않는다.
- Tenant Admin UI는 People, Provisioning, Role·Permission, Group Assignment,
  Effective Access와 Navigation 작업을 실제 API에 연결한다.

### 2.5 Provider Control Plane

- Tenant Admin과 분리된 `/provider` Shell, `dwp-provider-server`, `dwp_provider` Database와
  `PROVIDER_ADMIN` 권한을 사용한다.
- Tenant Estate, Service Tier, Region, Pool·Bridge·Silo, Lifecycle과 Entitlement를
  관리한다.
- Onboarding은 Idempotency Key로 Preview를 만들고 Plan Hash와 Version이 일치할 때만
  실행 단계로 전환한다.
- 로컬 Control Record만 생성하고 Auth·Platform·People·Asset Storage 단계는
  `PENDING_EXTERNAL`로 남겨 실제 개통을 가장하지 않는다.
- Entitlement 교체와 Lifecycle 변경은 Tenant Version을 검사한다.

### 2.6 Agent Administration Contract

- Agent는 자유 형식 SQL이나 임의 URL을 만들 수 없다.
- Access, Navigation, HRIS, SCIM, Provider의 10개 명령만 코드 Allowlist로 허용한다.
- 명령별 Target Type, Parameter Schema, Permission, Service, HTTP Method, Endpoint와
  Catalog Revision을 검증하고 Plan Hash에 포함한다.
- 모든 관리자 계획은 L3, 사람 승인 필요, `mutationAllowed=false`다.
- 감사 Event에는 원문 Prompt·Secret·Source 본문 대신 명령 Key, Revision, 대상 Service와
  최소 Metadata만 남긴다.

## 3. External Gate

| Gate                 | 현재 상태            | 준비되면 수행할 작업                                                 | 완료 증거                               |
| -------------------- | -------------------- | -------------------------------------------------------------------- | --------------------------------------- |
| 실제 HR Sample       | 미제공               | 고객 Payload 분류, Mapping·Code 변환, JML·재입사·복수 발령 검증      | Data Owner 승인 Mapping과 Contract Test |
| HRIS Sandbox         | 미제공               | Workday·Legacy Adapter, OAuth·mTLS, Delta Watermark, Retry·Replay    | Sandbox 동기화와 Reconciliation Report  |
| KMS·Vault            | 미제공               | Restricted PII Envelope Encryption, Credential Resolver·Rotation     | Key Policy, Rotation·복구·권한 Test     |
| S3 호환 Storage      | 미제공               | Tenant Prefix, Signed URL, MIME·Size·Hash, Malware Scan과 삭제       | 격리·Scan·Retention Test                |
| PostgreSQL RLS       | 운영 Role 미확정     | Transaction Tenant Context, Runtime·Migration Role 분리, `FORCE RLS` | Cross-tenant Negative Test와 DBA 승인   |
| Provider Provisioner | 대상 인프라 미확정   | Auth·Platform·People·Storage 개통 Adapter와 보상 처리                | End-to-end Tenant Onboarding Drill      |
| Figma                | 사용자 요청으로 보류 | Token Library와 Feature Frame 연결                                   | 라이선스 준비 후 Library Review         |

RLS는 Migration에 Policy 문자열만 추가한다고 완료되지 않는다. Application Owner가
우회하지 않는 Runtime Role, Connection Pool의 Transaction Context와 운영 Migration Role이
확정된 뒤 적용한다.

## 4. 이번 요청 외 남은 제품 Backlog

- Delegated Admin, 동적 SoD, Eligible Role 승인, Access Review와 Break-glass 운영
- Tenant Localization의 Draft·승인·배포·Rollback과 TMS 연계
- Typed Feature Flag·Rollout·Kill Switch, Secret Provider와 Executable Policy
- Productivity Connector, ACL Search, Knowledge, Durable Workflow와 Event Outbox
- 승인 Token, Agent Tool 실행·취소·보상 Timeline과 AgentOps
- Provider Release Ring, SLO·비용·Support, DR·Private·Hybrid Data Plane
- 디자인 파트너 Pilot, 수동 접근성·보안 승인과 Production Hardening

이 항목들은 누락이 아니라 `프로젝트로드맵.md`의 후속 Release 범위다. 외부 Gate가 없는
항목은 위 순서대로 계속 개발할 수 있다.

## 5. 검증 범위

- Backend Unit·Contract Test: Auth, People, Platform, Provider
- Agent Contract Test: 허용 명령 10개, 미등록·과잉 입력 Fail Closed, Hash Binding
- Frontend: Format, ESLint, TypeScript, i18n Coverage, Unit, Production Build
- Runtime: Database Migration, Gateway Login, People Import·조회, Admin API,
  Provider Preview·Operation과 주요 화면 Desktop·Mobile 확인

### 5.1 2026-08-10 실제 Runtime Evidence

- 합성 Worker 3건을 Import하고 통신·반도체 고용 형태, 미래 발령의 기준일 전후 결과,
  2쪽 서명 Cursor와 변조 Cursor 거부를 Gateway 경로에서 확인했다.
- 임시 HRIS Connector는 HTTPS·Secret Reference 구성을 통과하고 외부 연결을 수행하지 않은
  사실을 `externalConnectivityTested=false`로 확인한 뒤 제거했다.
- SCIM User·Group·Membership, Filter, ETag PATCH와 stale `If-Match`의 `412` 거부를 확인하고
  임시 Connector·Audit·Event를 제거했다.
- 기본 APP Registry 4건, Access Resource 12건, Runtime Navigation 1개 Group·4개 App과
  한국어 Label을 확인했다. 업무 Shell에서 해당 메뉴가 Effective Permission으로 필터링된다.
- Provider Onboarding Preview는 5단계 Plan과 SHA-256 Plan Hash를 생성하고 모든 외부 단계가
  `PENDING_EXTERNAL`임을 확인했다. Stale Entitlement Version은 `409`로 거부됐다.
- Desktop과 Mobile Home·People·Provisioning·Role·Navigation·Provider 화면에서 Overflow와
  Console Error가 없음을 확인했다. 임시 Connector·Operation은 삭제하고 정의된 합성
  Workforce Reference Dataset과 Migration Seed만 남겼다.

## 6. 공식 기준

- [Workday API Overview](https://developer.workday.com/api-overview)
- [Workday Get Workers](https://developer.workday.com/documentation/GUID-1f289b82-801e-434e-9e5a-aef66bc35179/GetWorkers)
- [SCIM Core Schema RFC 7643](https://www.rfc-editor.org/rfc/rfc7643.html)
- [SCIM Protocol RFC 7644](https://www.rfc-editor.org/rfc/rfc7644.html)
- [Cursor-Based Pagination RFC 9865](https://www.rfc-editor.org/rfc/rfc9865.html)
- [AWS SaaS Lens Tenant Onboarding](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/tenant-onboarding.html)
- [AWS SaaS Lens Operations](https://docs.aws.amazon.com/wellarchitected/latest/saas-lens/operate.html)
