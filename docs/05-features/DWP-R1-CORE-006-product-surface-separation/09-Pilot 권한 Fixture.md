# DWP-R1-CORE-006 Pilot 권한 Fixture

## 1. 목적과 기준 시각

Persona 이름을 인가 근거로 사용하지 않는다. Unit, Contract, E2E와 Security Test는 이 문서의
동일 Fixture를 재사용한다.

- 고정 Test Clock `T0`: `2026-08-21T09:00:00Z`
- 기본 Tenant: `T_A`
- 다른 Tenant Negative Target: `T_B`
- 정상 만료: `2026-12-31T15:00:00Z`
- Opaque Key는 Test 전용 Symbol이며 Production ID 형식을 모사하지 않는다.

## 2. Fixture Schema

```json
{
  "fixtureId": "FX-A-DESIGNER",
  "actorId": "U_A100",
  "decisionRevision": "FX-A-DESIGNER-R1",
  "sourceRevisions": {
    "auth": "AUTH-R1",
    "policy": "POLICY-R1",
    "productRelationship": "REL-R1",
    "targetPopulation": "POP-R1",
    "support": "SUPPORT-R0"
  },
  "activeAccessMode": "NORMAL",
  "testRegistryOverrideRef": null,
  "tenantRoleCodes": [],
  "personBinding": "P_A100",
  "appEntitlements": ["APP.APPROVALS:VIEW"],
  "scopes": [
    {
      "key": "S_APPROVALS",
      "tenantId": "T_A",
      "actorId": "U_A100",
      "kind": "RESOURCE_SET",
      "resourceRef": "RS_APPROVALS",
      "isDefault": true,
      "readOnly": false,
      "status": "ACTIVE",
      "validUntil": "2026-12-31T15:00:00Z"
    }
  ],
  "surfaceGrants": [
    {
      "grantKind": "CAPABILITY",
      "surfaceKey": "approvals.admin",
      "accessMode": "NORMAL",
      "capabilityContractKey": "approvals.design.read",
      "resolvedCapabilityCode": "ADMIN.APPROVAL_DESIGN:VIEW",
      "authorityMode": "PERMISSION",
      "responsibility": {
        "code": "APP_CONFIG_ADMIN",
        "resourceSetKey": "RS_APPROVALS",
        "validUntil": "2026-12-31T15:00:00Z"
      },
      "responsibilityRequirement": "REQUIRED",
      "requiresProductEntitlement": false,
      "scopeRefs": ["S_APPROVALS"],
      "readOnly": true,
      "activationState": "ACTIVE",
      "validFrom": "2026-08-21T00:00:00Z",
      "validUntil": "2026-12-31T15:00:00Z"
    }
  ],
  "relationships": [],
  "supportSession": null,
  "explicitDenies": []
}
```

필드가 생략되면 빈 값으로 해석하며 허용으로 추론하지 않는다. Capability는
Stable Contract Key와 Registry가 Resolve한 `resource:exact-action`을 함께 가진다. Scope Ref는
같은 Grant 안에서만 사용하고 `MANAGE` Implication을 Fixture에서 만들지 않는다.

`testRegistryOverrideRef`는 기본 null이며 `PS-G006`과 `PS-G010`만 08 구현 설계의 서명된
Contract-test Bundle에 있는 정확한 `test.*` Key를 가질 수 있다. Production Bundle·Runtime
Loader·E2E Session에는 이 필드와 `test.*` Key를 금지한다.

`explicitDenies` Element는 다음 Typed Schema다.

```ts
type ExplicitDenyFixture = {
  denyKind: 'APP_ENTITLEMENT' | 'CAPABILITY_CONTRACT' | 'ACCESS_POLICY' | 'SCOPE' | 'OBJECT';
  productKey: string;
  surfaceKey?: string;
  deniedKey: string;
  scopeKey?: string;
  validFrom: string;
  validUntil?: string;
};
```

Deny는 같은 Product·Surface·Scope의 Allow보다 먼저 평가하고 Role Label·접두사·빈 문자열로
대상을 추론하지 않는다.

아래 Component의 쉼표 목록은 Builder 입력이다. Builder는 Contract Key 하나당 위
Schema의 `CAPABILITY` Grant 하나를 만들고 Registry의 Active Exact Code를 결속한다.
Entitlement·Relationship·Support Component는 `POLICY` Grant로 만들며 인공 Capability를
생성하지 않는다. Work Policy는 `authorityMode=ENTITLEMENT`, HCM Team은
`ENTITLEMENT_AND_RELATIONSHIP`, Named Reviewer는 `RELATIONSHIP`, Support는
`SUPPORT_SESSION`을 사용하고 모든 Policy Grant는 Registry의 Opaque `policyDecisionRef`를 갖는다.
각 Persona Builder는 고유 `actorId`를 발급하고 Scope Template의 `issuedTo`를 그 Actor로
재발급한다. `personBinding`과 Relationship Template의 Actor·Person·Team·Scope Ref도 같은
Builder Actor와 의도된 Persona Target으로 함께 Rebind하며 다른 Persona의 ID를 묵묵히
재사용하면 Fixture 생성을 실패시킨다. `S_FOREIGN`과 Provider Support Template만 Catalog의
Actor·Tenant를 그대로 유지한다.

Scope Catalog의 `readOnly`는 Template 기본값이고 최종 기대값은 Component 조립 뒤 현재 유효한
Mutation Grant를 기준으로 다시 계산한다. Mutation Grant가 0개면 true이며, 하나 이상이어도
Policy Lock·Support Mode가 쓰기를 금지하면 true다. `HCM_DIRECTORY_ONLY`, Signature Reader,
Auditor와 Read-only Support는 true여야 한다. Builder 계산값과 기대값이 다르면 생성 실패다.

### 2.1 Scope Catalog

`isDefault`는 해당 Fixture Context 안의 값이다. 다음 Symbol을 외부 ID로 조합하지 않는다.

| Scope Key                     | Tenant / Issued To     | Kind / Resource                     | Default | Read-only | Status / Valid Until            |
| ----------------------------- | ---------------------- | ----------------------------------- | ------: | --------: | ------------------------------- |
| `S_APPROVAL_SELF`             | `T_A / U_A100`         | `SELF / P_A100`                     |       1 |         0 | ACTIVE / normal expiry          |
| `S_APPROVALS`                 | `T_A / U_A100`         | `RESOURCE_SET / RS_APPROVALS`       |       1 |         0 | ACTIVE / normal expiry          |
| `S_APPROVALS_AUDIT`           | `T_A / U_AUDITOR`      | `RESOURCE_SET / RS_APPROVALS_AUDIT` |       1 |         1 | ACTIVE / normal expiry          |
| `S_APPROVALS_OVERSIGHT`       | `T_A / U_TENANT_ADMIN` | `RESOURCE_SET / RS_APPROVALS`       |       1 |         1 | ACTIVE / `2027-02-28T14:59:59Z` |
| `S_COMM_SELF`                 | `T_A / U_A100`         | `SELF / P_A100`                     |       1 |         0 | ACTIVE / normal expiry          |
| `S_SERVICES_SELF`             | `T_A / U_A100`         | `SELF / P_A100`                     |       1 |         0 | ACTIVE / normal expiry          |
| `S_COMMUNICATIONS`            | `T_A / U_A100`         | `RESOURCE_SET / RS_COMMUNICATIONS`  |       1 |         0 | ACTIVE / normal expiry          |
| `S_COMMUNICATIONS_SUPPORT`    | `T_A / PV_1`           | `RESOURCE_SET / RS_COMMUNICATIONS`  |       1 |         1 | ACTIVE / T0 + 30m               |
| `S_SERVICES`                  | `T_A / U_A100`         | `RESOURCE_SET / RS_SERVICES`        |       1 |         0 | ACTIVE / normal expiry          |
| `S_SELF_A100`                 | `T_A / U_A100`         | `SELF / P_A100`                     |       1 |         0 | ACTIVE / normal expiry          |
| `S_TEAM_A`                    | `T_A / U_A100`         | `TEAM / TEAM_A`                     |       1 |         0 | ACTIVE / normal expiry          |
| `S_TEAM_B`                    | `T_A / U_A100`         | `TEAM / TEAM_B`                     |       1 |         0 | ACTIVE / normal expiry          |
| `S_LEGAL_A_TIME`              | `T_A / U_A100`         | `LEGAL_ENTITY / LEGAL_A:TIME`       |       1 |         0 | ACTIVE / normal expiry          |
| `S_LEGAL_B_TIME`              | `T_A / U_A100`         | `LEGAL_ENTITY / LEGAL_B:TIME`       |       0 |         0 | ACTIVE / normal expiry          |
| `S_LEGAL_A_WORKFORCE`         | `T_A / U_A100`         | `LEGAL_ENTITY / LEGAL_A:WORKFORCE`  |       1 |         0 | ACTIVE / normal expiry          |
| `S_LEGAL_A_WORKFORCE_SUPPORT` | `T_A / PV_1`           | `LEGAL_ENTITY / LEGAL_A:WORKFORCE`  |       1 |         1 | ACTIVE / T0 + 30m               |
| `S_HCM_CONFIG`                | `T_A / U_A100`         | `RESOURCE_SET / RS_HCM_CONFIG`      |       1 |         0 | ACTIVE / normal expiry          |
| `S_HCM_REFERENCE`             | `T_A / U_A100`         | `RESOURCE / HCM_REFERENCE`          |       1 |         0 | ACTIVE / normal expiry          |
| `S_HCM_INTEGRATION`           | `T_A / U_A100`         | `RESOURCE / HCM_INTEGRATION`        |       1 |         0 | ACTIVE / normal expiry          |
| `S_LEGAL_A_EXPORT`            | `T_A / U_A100`         | `LEGAL_ENTITY / LEGAL_A:EXPORT`     |       1 |         0 | ACTIVE / normal expiry          |
| `S_EXPIRED_TIME`              | `T_A / U_A100`         | `LEGAL_ENTITY / LEGAL_A:TIME`       |       1 |         1 | EXPIRED / T0 - 1s               |
| `S_FOREIGN`                   | `T_B / U_B200`         | `RESOURCE_SET / RS_APPROVALS_B`     |       1 |         0 | ACTIVE / normal expiry          |

Default 0개와 2개 오류는 별도 Negative Builder로 만든다. `FX-N-SCOPE-NO-DEFAULT`는
`S_LEGAL_A_TIME + S_LEGAL_B_TIME`의 Default를 둘 다 0으로, `FX-N-SCOPE-TWO-DEFAULTS`는
둘 다 1로 Override한다.

### 2.2 Target Population·Object Evidence Catalog

Target Population Snapshot은 고정 Clock T0의 Product PEP 입력이다.

| Key                    | Bound Scope / 허용 Target                                          | 반드시 거부할 Control Target                 |
| ---------------------- | ------------------------------------------------------------------ | -------------------------------------------- |
| `TP_TEAM_A`            | `S_TEAM_A`; `P_A201`, `P_A202`; Time/Absence Object                | `P_B201`, `TIME_B_1`, `ABSENCE_B_1`          |
| `TP_TEAM_B`            | `S_TEAM_B`; `P_B201`; Delegated Time/Absence Object                | `P_A201`, `TIME_A_1`, `ABSENCE_A_1`          |
| `TP_LEGAL_A_TIME`      | `S_LEGAL_A_TIME`; `TIME_A_1@v3`, `P_A201`, `LEGAL_A`               | `TIME_B_1@v2`, `P_B201`, `LEGAL_B`           |
| `TP_LEGAL_A_WORKFORCE` | `S_LEGAL_A_WORKFORCE`; `P_A201`, `ASSIGNMENT_A_1@v4`               | `P_B201`, `ASSIGNMENT_B_1@v2`                |
| `TP_LEGAL_A_EXPORT`    | `S_LEGAL_A_EXPORT`; `DS_HCM_CORE@v12`, Population `LEGAL_A_ACTIVE` | `DS_HCM_PAY@v8`, Population `LEGAL_B_ACTIVE` |

Object Party Evidence는 Step-up Challenge·SoD·Optimistic Version을 같은 Fixture에서 판정한다.

| Object Key                   | Version | Party Evidence                                                                      |
| ---------------------------- | ------: | ----------------------------------------------------------------------------------- |
| `WF_1`                       |       7 | `makerId=U_WF_MAKER`, `publisherId` 미지정                                          |
| `FORM_1`                     |       5 | `makerId=U_FORM_MAKER`, `publisherId` 미지정                                        |
| `POL_1`                      |       4 | `makerId=U_POLICY_MAKER`, `publisherId` 미지정                                      |
| `OUT_1`                      |       2 | `eventOriginatorId=U_EVENT_ORIGINATOR`, `assignedAuditorId=U_AUDITOR`               |
| `ORG_1`                      |       5 | `makerId=U_ORG_MAKER`, `publisherId` 미지정                                         |
| `REF_1`                      |       9 | Reference Update 대상, Scope `S_HCM_REFERENCE`                                      |
| `CONN_1`                     |       6 | `ownerId=U_CONNECTOR_OWNER`, Scope `S_HCM_INTEGRATION`                              |
| `DS_HCM_CORE`                |      12 | Dataset Contract `HCM_CORE`, Classification, Population `LEGAL_A_ACTIVE`            |
| `APPROVAL_HOME_PREF_1`       |       8 | ownerActor `BUILDER_ACTOR`, fixed Surface `approval-home`                           |
| `HCM_HOME_PREF_1`            |       9 | ownerActor `BUILDER_ACTOR`, fixed Surface `hcm-home`                                |
| `FORM_PUBLISHED_1`           |       3 | PUBLISHED, Actor에게 제출 가능                                                      |
| `APR_REQUEST_DRAFT_1`        |       4 | ownerActor `BUILDER_ACTOR`, DRAFT                                                   |
| `APR_REQUEST_SUBMITTED_1`    |       5 | ownerActor `BUILDER_ACTOR`, SUBMITTED                                               |
| `APR_REQUEST_NEEDS_INFO_1`   |       6 | ownerActor `BUILDER_ACTOR`, NEEDS_INFO                                              |
| `APR_REQUEST_OTHER_1`        |       2 | ownerActor `U_OTHER`; Actor Scope 밖 Control Target                                 |
| `DELEGATION_SELF_1`          |       3 | ownerActor `BUILDER_ACTOR`, ACTIVE, Policy Window 유효                              |
| `DELEGATION_OTHER_1`         |       2 | ownerActor `U_OTHER`; Actor Scope 밖 Control Target                                 |
| `TASK_CLAIM_1`               |       2 | PENDING, unassigned, `candidateActors=[BUILDER_ACTOR]`, requester `U_REQUESTER`     |
| `TASK_DECIDE_1`              |       3 | PENDING, assignee `BUILDER_ACTOR`, requester `U_REQUESTER`, Window Active           |
| `TASK_SELF_1`                |       1 | PENDING, assignee/requester `BUILDER_ACTOR`; Self-approval Control Target           |
| `WORK_ITEM_1`                |      11 | PENDING, campaign `CAMP_1` ACTIVE, reviewer `BUILDER_ACTOR`, decision Window Active |
| `WORK_ITEM_OTHER_1`          |       4 | PENDING, campaign `CAMP_1` ACTIVE, reviewer `U_OTHER`; Control Target               |
| `WORK_ITEM_REVOKED_1`        |       6 | PENDING, campaign `CAMP_1` ACTIVE, reviewer Assignment REVOKED at T0-1s             |
| `SERVICE_REQUEST_ASSIGNED_1` |       3 | assigneeActor `BUILDER_ACTOR`, IN_PROGRESS, 허용 Transition Set                     |
| `SERVICE_REQUEST_OTHER_1`    |       2 | assigneeActor `U_OTHER`, IN_PROGRESS; 타 담당 Control Target                        |
| `COMMUNICATION_VISIBLE_1`    |       4 | PUBLISHED, Audience에 `BUILDER_ACTOR`, Reader Action 허용                           |
| `ANNOUNCEMENT_DRAFT_1`       |       3 | DRAFT, ownerActor `BUILDER_ACTOR`, EDITABLE·PUBLISHABLE                             |
| `ANNOUNCEMENT_PUBLISHED_1`   |       4 | PUBLISHED, ownerActor `BUILDER_ACTOR`, ARCHIVABLE                                   |
| `SERVICE_CATALOG_ITEM_1`     |       5 | ACTIVE, Scope `S_SERVICES`, EDITABLE                                                |
| `TIME_CARD_SELF_1`           |       3 | ownerPerson `BUILDER_PERSON`, Scope `S_SELF_A100`, EDITABLE·SUBMITTABLE             |
| `TIME_CARD_OTHER_1`          |       2 | ownerPerson `P_B201`; Self Scope 밖 Control Target                                  |
| `ABSENCE_SELF_1`             |       4 | requesterPerson `BUILDER_PERSON`, WITHDRAWABLE                                      |
| `ABSENCE_OTHER_1`            |       2 | requesterPerson `P_B201`; Self Scope 밖 Control Target                              |
| `TALENT_GOAL_SELF_1`         |       5 | ownerPerson `BUILDER_PERSON`, EDITABLE                                              |
| `TALENT_GOAL_OTHER_1`        |       2 | ownerPerson `P_B201`; Self Scope 밖 Control Target                                  |
| `EXPORT_REQ_CANCEL_1`        |       6 | Dataset `DS_HCM_CORE@v12`, Population `LEGAL_A_ACTIVE`, CANCELLABLE                 |
| `EXPORT_REQ_RETRY_1`         |       7 | Dataset `DS_HCM_CORE@v12`, Population `LEGAL_A_ACTIVE`, FAILED·RETRYABLE            |

Positive Publisher·Operator Fixture의 Builder Actor는 위 Maker·Originator·Auditor와 서로 다른
ID다. Same-actor 및 Party 누락은 별도 Negative Delta로만 만든다. Target Population·
Object Version·Party Evidence가 없으면 Product PEP는 Fail Closed한다.

#### 2.2.1 Command Payload·Projection Evidence

| Key                                    | Positive Contract                                                          | Control / 기대                                                                  |
| -------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `PAYLOAD_APPROVAL_HOME_PREF_UPDATE_1`  | `APPROVAL_HOME_PREF_1@v8`, `surfaceKey=approval-home`, If-Match 8          | 다른 Surface·Expected Version은 Route/Version 검사에서 거부                     |
| `PAYLOAD_HCM_HOME_PREF_UPDATE_1`       | `HCM_HOME_PREF_1@v9`, `surfaceKey=hcm-home`, If-Match 9                    | 다른 Surface·Expected Version은 Route/Version 검사에서 거부                     |
| `PAYLOAD_HRIS_CONNECTOR_CREATE_SAFE_1` | 허용 Type·Config Scope·Idempotency, Client `credentialReference` 필드 없음 | `PAYLOAD_HRIS_CONNECTOR_SECRET_1`은 해당 Field를 포함해 Request Validation 거부 |
| `PAYLOAD_EXPORT_PREVIEW_1`             | `DS_HCM_CORE@v12`, `LEGAL_A_ACTIVE`, 허용 Field Group                      | `HcmControlledExportPreviewV1`; Masked Aggregate만, 원문 Row·금지 Field 0       |

Command Payload Symbol은 Capability가 아니다. Route Profile·Predicate·Request Schema·Expected
Version과 결합하는 Test Evidence이며 Builder가 Grant로 물리화하면 실패다. Preview 응답이
`hcm.controlled-export.preview.v1` Projection의 Field Allowlist/Schema Hash를 벗어나면 응답 전송 전에
Fail Closed한다.

### 2.3 Relationship·Support·Revision Catalog

| Key                     | Type              | Actor / Target / Scope                                                                                                | Validity                   |
| ----------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `R_DIRECT_TEAM_A`       | `DIRECT_REPORT`   | `U_A100 / TEAM_A / S_TEAM_A`                                                                                          | T0 active, normal expiry   |
| `R_DELEGATED_TEAM_B`    | `DELEGATED_TEAM`  | `U_A100 / TEAM_B / S_TEAM_B`                                                                                          | T0 active, normal expiry   |
| `R_REVIEW_ITEM_1`       | `NAMED_REVIEWER`  | `U_A100 / CAMP_1 / WORK_ITEM_1@v11 / item scope`; Campaign ACTIVE                                                     | T0 active, campaign expiry |
| `SUPPORT_HCM_READ_1`    | `SUPPORT_SESSION` | `PV_1 / T_A / S_LEGAL_A_WORKFORCE_SUPPORT`; exact scope `WORKFORCE_READ`; approved reason/evidence; Read-only         | T0 active, T0 + 30m        |
| `SUPPORT_COMM_CONFIG_1` | `SUPPORT_SESSION` | `PV_1 / T_A / S_COMMUNICATIONS_SUPPORT`; exact scope `TENANT_CONFIGURATION_READ`; approved reason/evidence; Read-only | T0 active, T0 + 30m        |

`SUPPORT_HCM_READ_1`은 `WORKFORCE_READ`, Reason, Approval Evidence, Read-only와
`PROVIDER_SUPPORT` Active Mode를 가진다. 같은 Actor의 NORMAL Grant가 있어도 해당 Session Fixture에서
평가·합산하지 않는다.

각 Fixture는 `authRevision`, `policyRevision`, `productRelationshipRevision`,
`targetPopulationRevision`, `supportRevision`을 가지고 Builder가 이 다섯 Source의 Opaque
Composite `decisionRevision`을 생성한다. Client·Test가 Source
Revision을 직접 조합하지 않는다. Revoke Fixture는 시작 Revision과 변경 Revision을 둘 다 고정한다.

### 2.4 Step-up Challenge Catalog

| Key                                 | Policy                    | Capability / Decision Revision                     | Actor / Scope / Target                                                                   | Canonical Public Command Binding                                                                                            | Freshness·Nonce / 상태                       |
| ----------------------------------- | ------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `STEPUP_HIGH_WORKFLOW_PUBLISH_1`    | `STEPUP-MGMT-HIGH-V1`     | `approvals.design.publish` / `D-A-WF-PUB-R1`       | Fixture Actor / `S_APPROVALS` / `WORKFLOW:WF_1@v7`                                       | `POST /api/approvals/v1/admin/workflows/WF_1/publish`, `IK_WF_1`, `SHA256:C_WF_1`                                           | `auth_time=T0-60s`, `N_HIGH_WF_1`, ACTIVE    |
| `STEPUP_HIGH_FORM_PUBLISH_1`        | `STEPUP-MGMT-HIGH-V1`     | `approvals.design.publish` / `D-A-FORM-PUB-R1`     | Fixture Actor / `S_APPROVALS` / `FORM:FORM_1@v5`                                         | `POST /api/approvals/v1/admin/forms/FORM_1/publish`, `IK_FORM_1`, `SHA256:C_FORM_1`                                         | `auth_time=T0-60s`, `N_HIGH_FORM_1`, ACTIVE  |
| `STEPUP_HIGH_POLICY_PUBLISH_1`      | `STEPUP-MGMT-HIGH-V1`     | `approvals.policy.publish` / `D-A-POL-PUB-R1`      | Fixture Actor / `S_APPROVALS` / `POLICY:POL_1@v4`                                        | `POST /api/approvals/v1/admin/policies/POL_1/publish`, `IK_POL_1`, `SHA256:C_POL_1`                                         | `auth_time=T0-60s`, `N_HIGH_POL_1`, ACTIVE   |
| `STEPUP_HIGH_RECOVERY_1`            | `STEPUP-MGMT-HIGH-V1`     | `approvals.operations.execute` / `D-A-OPS-R1`      | Fixture Actor / `S_APPROVALS` / `OUTBOX_EVENT:OUT_1@v2`                                  | `POST /api/approvals/v1/admin/operations/events/OUT_1/retry`, `IK_OUT_1`, `SHA256:EMPTY`                                    | `auth_time=T0-60s`, `N_HIGH_OPS_1`, ACTIVE   |
| `STEPUP_HIGH_ORG_PUBLISH_1`         | `STEPUP-MGMT-HIGH-V1`     | `hcm.org-design.publish` / `D-H-ORG-R1`            | Fixture Actor / `S_HCM_CONFIG` / `ORG_CONFIG:ORG_1@v5`                                   | `POST /api/people/v1/workforce/organization/scenarios/ORG_1/publish`, `IK_ORG_1`, `SHA256:C_ORG_1`                          | `auth_time=T0-60s`, `N_HIGH_ORG_1`, ACTIVE   |
| `STEPUP_HIGH_INTEGRATION_EXECUTE_1` | `STEPUP-MGMT-HIGH-V1`     | `hcm.integration.execute` / `D-H-INT-EXEC-R1`      | Fixture Actor / `S_HCM_INTEGRATION` / `CONNECTOR:CONN_1@v6`                              | `POST /api/people/v1/workforce/data-operations/hris/connectors/CONN_1/executions`, `IK_CONN_EXEC_1`, `SHA256:C_CONN_EXEC_1` | `auth_time=T0-60s`, `N_HIGH_INT_1`, ACTIVE   |
| `STEPUP_CRITICAL_FRESH_1`           | `STEPUP-MGMT-CRITICAL-V1` | `hcm.controlled-export.create` / `D-H-EXP-R1`      | Fixture Actor / `S_LEGAL_A_EXPORT` / `EXPORT_DATASET:DS_HCM_CORE@v12` + `LEGAL_A_ACTIVE` | `POST /api/people/v1/workforce/exports`, `IK_EXP_1`, `SHA256:C_EXP_1`                                                       | `auth_time=T0-30s`, `N_CRIT_1`, ACTIVE       |
| `STEPUP_CRITICAL_EXPORT_RETRY_1`    | `STEPUP-MGMT-CRITICAL-V1` | `hcm.controlled-export.retry` / `D-H-EXP-RETRY-R1` | Fixture Actor / `S_LEGAL_A_EXPORT` / `EXPORT_REQUEST:EXPORT_REQ_RETRY_1@v7`              | `PATCH /api/people/v1/workforce/exports/EXPORT_REQ_RETRY_1/retry`, `IK_EXP_RETRY_1`, `SHA256:C_EXP_RETRY_1`                 | `auth_time=T0-30s`, `N_CRIT_RETRY_1`, ACTIVE |
| `STEPUP_CRITICAL_CONSUMED_1`        | `STEPUP-MGMT-CRITICAL-V1` | `hcm.controlled-export.create` / `D-H-EXP-R1`      | Fixture Actor / `S_LEGAL_A_EXPORT` / `EXPORT_DATASET:DS_HCM_CORE@v12` + `LEGAL_A_ACTIVE` | 위 Export Create Command와 동일                                                                                             | `N_CRIT_USED`, CONSUMED                      |

Challenge는 Actor·Tenant·Risk Policy·Capability Contract·Scope·Target Type/ID·Expected Object
Version·Canonical Method/Path·Idempotency Key·Canonical Payload Digest·`decisionRevision`에
결속한다. 다른 Fixture·Scope·Target·Version·Command·Payload·Revision에 재사용할 수 없고
Auth는 서명된 Challenge를 발급하고 Approval/People Service는 각각 Local Replay Ledger에
`(challengeId, nonce)`를 Domain Commit과 같은 Local Transaction으로 Insert한다. 두 서비스가
Auth DB와 분산 Transaction을 만들지 않는다.
Export Create의 서버 UUID는 Command 결과이므로 Challenge Target이 아니다. Challenge는 승인된
Dataset Contract Version, Target Population, Scope, Canonical Payload와 Idempotency Key에 결속하고
People Service가 Request UUID 생성 직전 이를 다시 검증한다.

Reference Publish와 Integration Secret Rotation은 Pilot Active Challenge Catalog에 존재하지
않는다. `STEPUP_HIGH_REFERENCE_PUBLISH_1`, `STEPUP_CRITICAL_SECRET_ROTATE_1` Symbol을 Fixture에
주입하면 미등록 예약 Contract로 Fail Closed해야 한다.

## 3. 공통 Component

### 3.1 Technical Canary

`COMM_WORK`는 `APP.COMMUNICATIONS:VIEW`, Policy `communications.work-access.v1`,
`authorityMode=ENTITLEMENT`, `S_COMM_SELF`, Read-only=false, Normal Validity를 가진다.
`SERVICES_WORK`는 `APP.EMPLOYEE_SERVICES:VIEW`, Policy `services.work-access.v1`,
`authorityMode=ENTITLEMENT`, `S_SERVICES_SELF`, Read-only=false, Normal Validity를 가진다.

| Component                   | Capability Contract Keys                                                                          | Requirement / Scope                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `COMM_CONTENT_READ`         | `communications.content.read`                                                                     | REQUIRED `APP_CONFIG_ADMIN@RS_COMMUNICATIONS` / `S_COMMUNICATIONS` |
| `COMM_CONTENT_EDITOR`       | `communications.content.read`, `communications.content.create`, `communications.content.update`   | REQUIRED `APP_CONFIG_ADMIN@RS_COMMUNICATIONS` / `S_COMMUNICATIONS` |
| `COMM_CONTENT_PUBLISHER`    | `communications.content.read`, `communications.content.publish`, `communications.content.archive` | REQUIRED `APP_CONFIG_ADMIN@RS_COMMUNICATIONS` / `S_COMMUNICATIONS` |
| `SERVICES_CATALOG_READ`     | `services.catalog.read`                                                                           | REQUIRED `APP_CONFIG_ADMIN@RS_SERVICES` / `S_SERVICES`             |
| `SERVICES_CATALOG_EDITOR`   | `services.catalog.read`, `services.catalog.create`, `services.catalog.update`                     | REQUIRED `APP_CONFIG_ADMIN@RS_SERVICES` / `S_SERVICES`             |
| `SERVICES_OPERATIONS_READ`  | `services.operations.read`                                                                        | REQUIRED `APP_CONFIG_ADMIN@RS_SERVICES` / `S_SERVICES`             |
| `SERVICES_OPERATIONS_AGENT` | `services.operations.read`, `services.operations.update`                                          | REQUIRED `APP_CONFIG_ADMIN@RS_SERVICES` / `S_SERVICES`             |

`COMM_SUPPORT_CONFIG`는 `SUPPORT_COMM_CONFIG_1`, Entry Policy
`communications.management-entry.v1`(`MODE_BRANCH`), Child Policy
`communications.content-route-access.v1`, `PROVIDER_SUPPORT`, Read-only를 사용한다. NORMAL
Capability Grant를 같은 Context에 넣지 않는다.

### 3.2 Approvals Work

`AP_WORK_MEMBER`:

- App: `APP.APPROVALS:VIEW`
- Contract Keys: `approvals.work.task.read`, `approvals.work.task.update`,
  `approvals.work.task.approve`, `approvals.work.request.read`,
  `approvals.work.request.create`, `approvals.work.request.update`,
  `approvals.work.delegation.read`, `approvals.work.delegation.manage`
- Surface Scope: `S_APPROVAL_SELF`; Task/Request ID는 Child DATA/ACTION의 Object Target Binding
- Action Test는 `TASK_CLAIM_1`, `TASK_DECIDE_1`, `TASK_SELF_1`,
  `FORM_PUBLISHED_1`, `APR_REQUEST_DRAFT_1`, `APR_REQUEST_SUBMITTED_1`,
  `APR_REQUEST_NEEDS_INFO_1`, `APR_REQUEST_OTHER_1`, `DELEGATION_SELF_1`,
  `DELEGATION_OTHER_1` Evidence를 Route별로 하나씩 결속한다.
  Component에 Capability가 있어도 Claimable·Decidable·Own Request·Published Form·Policy Window
  Predicate를 통과하지 못하면 허용하지 않는다.

### 3.3 Approvals Management

모든 위임형 관리 Component는 별도 표기가 없으면 다음을 공통으로 가진다.

- Responsibility: `APP_CONFIG_ADMIN@RS_APPROVALS`
- Requirement: `REQUIRED`
- Scope: `S_APPROVALS`
- Access Mode: `NORMAL`
- Validity: T0에 Active, 정상 만료 시각까지

| Component           | Capability Contract Keys                                                      |
| ------------------- | ----------------------------------------------------------------------------- |
| `AP_DESIGN_DRAFT`   | `approvals.design.read`, `approvals.design.create`, `approvals.design.update` |
| `AP_DESIGN_PUBLISH` | `approvals.design.read`, `approvals.design.publish`                           |
| `AP_POLICY_DRAFT`   | `approvals.policy.read`, `approvals.policy.update`                            |
| `AP_POLICY_PUBLISH` | `approvals.policy.read`, `approvals.policy.publish`                           |
| `AP_OPERATE`        | `approvals.operations.read`, `approvals.operations.execute`                   |
| `AP_SIGNATURE_READ` | `approvals.signature.read`                                                    |

`AP_AUDIT_READ`는 별도 Descriptor `approvals.audit.operations.read`, `NOT_REQUIRED`, Read-only와
`S_APPROVALS_AUDIT`만 가진다. 허용 Route는
`route.approvals.admin.operations.page`, 허용 Service PEP는 `GET /v1/admin/operations`,
Projection은 `approvals.audit.operations.v1`뿐이다. 이는 Tenant Admin 상속이 아니라 별도
승인된 Auditor Policy다.

`AP_LEGACY_OVERSIGHT`는 05 API 계약 7.3의
`approvals.oversight.overview|design|policy|operations|signature.read` 다섯 Capability
Contract·6개 Page Route,
`LEGACY_OVERSIGHT`,
`S_APPROVALS_OVERSIGHT`, Owner `Approvals + Security`, Sunset `2027-02-28T14:59:59Z`와 각
Field Mask Policy를 그대로 투영한다. 모든 Mutation·Content·Secret는 명시 Deny다.

### 3.4 HCM Work·Team

`HCM_EMPLOYEE`:

- Person Binding: `P_A100`
- App: `APP.HCM:VIEW`, `APP.PEOPLE_DIRECTORY:VIEW`, `APP.EMPLOYEE_SERVICES:VIEW`
- Self Scope: `S_SELF_A100`
- Self Action Route Keys: `route.hcm.personal.time-entry-update.action`,
  `route.hcm.personal.time-submit.action`, `route.hcm.personal.absence-create.action`,
  `route.hcm.personal.absence-withdraw.action`,
  `route.hcm.personal.talent-goal-update.action`,
  `route.hcm.personal.home-preference-update.action`
- `TIME_CARD_SELF_1`, `ABSENCE_SELF_1`, `TALENT_GOAL_SELF_1`과 고정
  `surfaceKey=hcm-home`만 Positive Target이다. `TIME_CARD_OTHER_1`, `ABSENCE_OTHER_1`,
  `TALENT_GOAL_OTHER_1` 또는 다른 `surfaceKey`는 같은
  Person Binding으로도 허용하지 않는다.

`HCM_DIRECTORY_ONLY`:

- Person Binding: `P_A100`
- App: `APP.PEOPLE_DIRECTORY:VIEW`만
- Explicit Deny: `denyKind=APP_ENTITLEMENT`, `productKey=hcm`, `surfaceKey=hcm.personal`,
  `deniedKey=APP.HCM:VIEW`, T0에 유효
- Policies: `hcm.personal-access.v1`, `hcm.directory-access.v1`
- Self Scope: `S_SELF_A100`; Personal Core·Services Route Grant 없음

`HCM_LINE_MANAGER`:

- `HCM_EMPLOYEE`
- Relationship: `DIRECT_REPORT(P_A100 → TEAM_A)` at T0
- Contract Keys: `hcm.team.time.read`, `hcm.team.time.approve`,
  `hcm.team.absence.read`, `hcm.team.absence.approve`
- Authority Mode: `PERMISSION_AND_RELATIONSHIP`, Requirement `NOT_REQUIRED`
- Target Scope: `S_TEAM_A`

`HCM_DELEGATED_MANAGER`는 `DIRECT_REPORT` 대신 T0에 유효한
`DELEGATED_TEAM(P_A100 → TEAM_B)`와 `S_TEAM_B`만 사용한다.

### 3.5 HCM Operations·Management

| Component                | Capability Contract Keys                                                                                                                                     | Requirement / Scope                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `HCM_TIME_OPERATOR`      | `hcm.operations.time.read`, `hcm.operations.time.approve`                                                                                                    | NOT_REQUIRED / `S_LEGAL_A_TIME`                                      |
| `HCM_WORKFORCE_OPERATOR` | `hcm.operations.workforce.read`                                                                                                                              | NOT_REQUIRED / `S_LEGAL_A_WORKFORCE`                                 |
| `HCM_ORG_DESIGN_DRAFT`   | `hcm.org-design.read`, `hcm.org-design.create`, `hcm.org-design.update`                                                                                      | REQUIRED `APP_CONFIG_ADMIN@RS_HCM_CONFIG` / `S_HCM_CONFIG`           |
| `HCM_ORG_DESIGN_APPROVE` | `hcm.org-design.read`, `hcm.org-design.approve`                                                                                                              | REQUIRED `APP_CONFIG_ADMIN@RS_HCM_CONFIG` / `S_HCM_CONFIG`           |
| `HCM_ORG_DESIGN_PUBLISH` | `hcm.org-design.read`, `hcm.org-design.publish`                                                                                                              | REQUIRED `APP_CONFIG_ADMIN@RS_HCM_CONFIG` / `S_HCM_CONFIG`           |
| `HCM_REFERENCE_DRAFT`    | `hcm.reference.read`, `hcm.reference.update`                                                                                                                 | REQUIRED `APP_CONFIG_ADMIN@RS_HCM_CONFIG` / `S_HCM_REFERENCE`        |
| `HCM_INTEGRATION_ADMIN`  | `hcm.integration.read`, `hcm.integration.create`, `hcm.integration.update`, `hcm.integration.execute`; Rotate-secret은 미등록 예약                           | REQUIRED `APP_CONFIG_ADMIN@RS_HCM_CONFIG` / `S_HCM_INTEGRATION`      |
| `HCM_CONTROLLED_EXPORT`  | `hcm.controlled-export.read`, `hcm.controlled-export.preview`, `hcm.controlled-export.create`, `hcm.controlled-export.cancel`, `hcm.controlled-export.retry` | NOT_REQUIRED / `S_LEGAL_A_EXPORT`; Create/Retry use CRITICAL Step-up |

`HCM_TIME_OPERATOR_EXPIRED`와 `HCM_TIME_OPERATOR_B`는 Registry Descriptor를 바꾸지 않는 Grant
Instance다. 둘 다 `HCM_TIME_OPERATOR`의 Exact Capability Key를 사용하되 전자는
`scopeRefs=[S_EXPIRED_TIME]`, `validUntil=T0-1s`, 후자는 `scopeRefs=[S_LEGAL_B_TIME]`, Normal
Validity로 고정한다. H013은 두 Grant와 두 Scope를 모두 조립하고 URL에는
`contextScopeKey=S_EXPIRED_TIME`을 유지한다. Active B Grant가 있어도 Expired A URL을 B로 자동
교체하지 않는다.

`hcm.reference.publish`와 `hcm.integration.rotate-secret`은 Component가 아니라 Post-Pilot 예약
이름이다. Builder Component Catalog·Active Capability Registry·Route Registry·Challenge Catalog에
넣지 않는다. `PS-H017`과 `PS-H021`은 각각 Active `HCM_REFERENCE_DRAFT`,
`HCM_INTEGRATION_ADMIN`만 조립한 뒤 예약 이름으로의 Direct Evaluation·가상 Route·Challenge 발급이
모두 Fail Closed인지 검증한다.

`HCM_TIME_OPERATOR`와 `HCM_WORKFORCE_OPERATOR`는 Entry Policy `hcm.operations-access.v1`의
NORMAL Branch를 각각 자신의 Exact Capability·Target Population으로 통과한다. Overview는
`hcm.operations-overview-read.v1` NORMAL Branch를 다시 평가한다. Workforce People과
Assignments는 `hcm.operations-workforce-read.v1` NORMAL Branch와
`TP_LEGAL_A_WORKFORCE`를 평가한다.

`HCM_SUPPORT_READ`:

- Provider Role with active approved Support Session for `T_A`
- Access Mode: `PROVIDER_SUPPORT`
- Support Scope: `WORKFORCE_READ`
- Scope: `S_LEGAL_A_WORKFORCE_SUPPORT`
- Entry Policy: `hcm.operations-access.v1` PROVIDER_SUPPORT Branch
- Overview Child Policy: `hcm.operations-overview-read.v1` PROVIDER_SUPPORT Branch
- Workforce People/Assignments Child Policy: `hcm.operations-workforce-read.v1`
  PROVIDER_SUPPORT Branch
- Read-only: true
- Reason: 표시 가능한 Test 문자열
- T0에 Active, 30분 만료
- 일반 Tenant Permission과 Union 금지

### 3.6 Policy Grant Materialization

| Component / Policy                                               | 반환 Grant                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `COMM_WORK` / `communications.work-access.v1`                    | POLICY, ENTITLEMENT, `S_COMM_SELF`, Read-only=false, Normal Validity, Opaque Decision Ref                          |
| `COMM_SUPPORT_CONFIG` / `communications.management-entry.v1`     | POLICY, SUPPORT_SESSION, `S_COMMUNICATIONS_SUPPORT`, Read-only=true, T0+30m, Entry Decision Ref                    |
| `COMM_SUPPORT_CONFIG` / `communications.content-route-access.v1` | POLICY, SUPPORT_SESSION, `S_COMMUNICATIONS_SUPPORT`, Read-only=true, T0+30m, Child Decision Ref                    |
| `SERVICES_WORK` / `services.work-access.v1`                      | POLICY, ENTITLEMENT, `S_SERVICES_SELF`, Read-only=false, Normal Validity, Opaque Decision Ref                      |
| `AP_WORK_MEMBER` / `approvals.work-access.v1`                    | POLICY, ENTITLEMENT, `S_APPROVAL_SELF`, Read-only=false, Normal Validity, Opaque Decision Ref                      |
| `HCM_EMPLOYEE` / `hcm.personal-access.v1`                        | POLICY, ENTITLEMENT_AND_RELATIONSHIP, `S_SELF_A100`, Read-only=false, Normal Validity, Opaque Decision Ref         |
| `HCM_EMPLOYEE` / `hcm.personal-core-access.v1`                   | POLICY, ENTITLEMENT_AND_RELATIONSHIP, `S_SELF_A100`, Read-only=false, Core Route Decision Ref                      |
| `HCM_EMPLOYEE` / `hcm.directory-access.v1`                       | POLICY, ENTITLEMENT_AND_RELATIONSHIP, `S_SELF_A100`, Read-only=false, Directory Route Decision Ref                 |
| `HCM_EMPLOYEE` / `hcm.personal-services-access.v1`               | POLICY, ENTITLEMENT_AND_RELATIONSHIP, `S_SELF_A100`, Read-only=false, Normal Validity, Services Route Decision Ref |
| `HCM_DIRECTORY_ONLY` / `hcm.personal-access.v1`                  | POLICY, ENTITLEMENT_AND_RELATIONSHIP, `S_SELF_A100`, Surface Entry Decision Ref                                    |
| `HCM_DIRECTORY_ONLY` / `hcm.directory-access.v1`                 | POLICY, ENTITLEMENT_AND_RELATIONSHIP, `S_SELF_A100`, Directory Route Decision Ref; Core Grant 없음                 |
| `HCM_LINE_MANAGER` / `hcm.team-access.v1`                        | POLICY, ENTITLEMENT_AND_RELATIONSHIP, `S_TEAM_A`, Read-only=false, Normal Validity, `TP_TEAM_A` Ref                |
| `HCM_DELEGATED_MANAGER` / `hcm.team-access.v1`                   | POLICY, ENTITLEMENT_AND_RELATIONSHIP, `S_TEAM_B`, Read-only=false, Normal Validity, `TP_TEAM_B` Ref                |
| HCM Operations NORMAL Entry                                      | MODE_BRANCH가 선택한 기존 CAPABILITY Grant·Target Population을 반환; Policy Grant 추가 없음                        |
| `HCM_SUPPORT_READ` / `hcm.operations-access.v1`                  | POLICY, SUPPORT_SESSION, `S_LEGAL_A_WORKFORCE_SUPPORT`, Read-only=true, T0+30m, Entry Decision Ref                 |
| `HCM_SUPPORT_READ` / `hcm.operations-overview-read.v1`           | POLICY, SUPPORT_SESSION, 동일 Scope·Validity, Overview Child Decision Ref                                          |
| `HCM_SUPPORT_READ` / `hcm.operations-workforce-read.v1`          | POLICY, SUPPORT_SESSION, 동일 Scope·Validity, People/Assignments Child Decision Ref                                |

Builder는 `policyDecisionRef=DEC:<fixtureId>:<accessPolicyKey>:<policyVersion>`의 Test Symbol을
발급한다. 다른 Fixture·Policy·Mode의 Ref를 재사용하거나 MODE_BRANCH의 두 Grant를
함께 넣으면 실패다.

### 3.7 Named Reviewer Governed Work

| Test ID   | Fixture ID                 | Composition / Evidence                                 | 기대                                                                                                                       |
| --------- | -------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `PS-G015` | `FX-G-NAMED-REVIEWER-WORK` | `R_REVIEW_ITEM_1 + WORK_ITEM_1@v11`, Tenant Admin 없음 | `route.context.work__work.review-detail.data`와 `route.context.work__work.review-decision.action`만 Allow; `/admin/**` 403 |

이 Fixture는 `subject=GOVERNED_CONTEXT`, `navigationContextId=work.work`, Policy
`identity.named-reviewer-access.v1`, Predicate `predicate.named-reviewer-assigned-item.v1`을 사용한다.
Detail은 현재 Assignment·ACTIVE Campaign·Reviewer·Object Version을, Decision은 같은 Evidence와
Expected Version 11을 다시 검사한다. Product Key·Surface Key·Product Scope·Admin Capability를
생성하지 않는다. Decision 성공 뒤 `WORK_ITEM_1`의 Version과 상태를 갱신하고 같은 Expected Version의
재전송은 Mutation 0이어야 한다.

### 3.8 공통 Guard 상태 Fixture

`PS-G001`~`PS-G017`은 다음 Builder 입력으로 고정한다. `test.management-and-app.v1`은
`requiresProductEntitlement=true`, `test.services-catalog-jit.v1`은
`activationPolicy=TEST-JIT-TENANT-V1`·`activationState=REQUIRED`인 서명된 Contract-test Descriptor다.
둘은 Production Bundle·Checksum·Grant에 포함하지 않는다.

| Test ID   | Fixture ID                        | Composition / Delta                                                                                        |
| --------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `PS-G001` | `FX-G-UNAUTHENTICATED`            | `authenticated=false`; Actor·Context·Cache 없음                                                            |
| `PS-G002` | `FX-G-MEMBER-ONLY`                | `COMM_WORK`; Management Capability·Responsibility 없음                                                     |
| `PS-G003` | `FX-G-TENANT-ADMIN-ONLY`          | `tenantRoleCodes=[TENANT_ADMIN] + COMM_WORK`; Product Management Grant 없음                                |
| `PS-G004` | `FX-A-LEGACY-OVERSIGHT`           | `PS-A012`와 동일한 Tenant Admin + `AP_LEGACY_OVERSIGHT`                                                    |
| `PS-G005` | `FX-G-MANAGEMENT-ONLY`            | `SERVICES_CATALOG_READ`; App Entitlement 없음, Descriptor는 Entitlement 미요구                             |
| `PS-G006` | `FX-G-MANAGEMENT-AND-APP-MISSING` | `testRegistryOverrideRef=test.management-and-app.v1`; Capability·Responsibility, 필수 `APP.TEST:VIEW` 없음 |
| `PS-G007` | `FX-G-CROSS-PRODUCT`              | App A `COMM_CONTENT_READ@RS_COMMUNICATIONS` + App B `SERVICES_WORK`; Services Management Target            |
| `PS-G008` | `FX-G-RESPONSIBILITY-ONLY`        | `APP_CONFIG_ADMIN@RS_SERVICES + SERVICES_WORK`; `services.*` Capability Grant 없음                         |
| `PS-G009` | `FX-G-ASSIGNMENT-EXPIRED`         | `SERVICES_WORK + SERVICES_CATALOG_READ`; Responsibility `validUntil=T0-1s`                                 |
| `PS-G010` | `FX-G-ACTIVATION-REQUIRED`        | `SERVICES_WORK`; `testRegistryOverrideRef=test.services-catalog-jit.v1`, Activation 없음                   |
| `PS-G011` | `FX-C-COMM-PROVIDER`              | `PS-C004`와 동일; Provider Role, Support Session 없음                                                      |
| `PS-G012` | `FX-C-COMM-SUPPORT`               | `PS-C003`과 동일; `SUPPORT_COMM_CONFIG_1`, `PROVIDER_SUPPORT`, Read-only                                   |
| `PS-G013` | `FX-G-URL-SCOPE-EXPIRED`          | Time Operator, URL `contextScopeKey=S_EXPIRED_TIME`; 별도 Active `S_LEGAL_B_TIME` 보유                     |
| `PS-G014` | `FX-G-AUTHORITY-UNAVAILABLE`      | Auth 또는 Scope Resolver 응답 `UNAVAILABLE`; 이전 Cached Allow 존재                                        |
| `PS-G015` | `FX-G-NAMED-REVIEWER-WORK`        | 3.7의 Named Reviewer Fixture                                                                               |
| `PS-G016` | `FX-C-SUPPORT-EXCLUSIVE`          | NORMAL `COMM_CONTENT_EDITOR` + Active `COMM_SUPPORT_CONFIG`; Active Mode=`PROVIDER_SUPPORT`                |
| `PS-G017` | `FX-N-UNKNOWN-DECISION`           | Server가 Registry에 없는 미래 Decision Enum 반환                                                           |

G007은 App A의 Responsibility·Capability·Scope를 App B와 Cartesian 결합하지 않고, G009는 Work
Entitlement만 유지한다. G013은 URL의 만료 Scope를 그대로 `SCOPE_INVALID`로 표시하고 더 넓거나 다른
Active Scope로 자동 교체하지 않는다. G014는 Content Clear 뒤 503/Authority Unavailable을 반환하며
Cached Allow로 Query·Mutation하지 않는다.

## 4. Technical Canary Persona Fixture

| Test ID   | Fixture ID                    | Composition / Delta                                                                      | 기대                                                                           |
| --------- | ----------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `PS-C001` | `FX-C-COMM-MEMBER`            | `COMM_WORK`                                                                              | Communications Work 5개만                                                      |
| `PS-C002` | `FX-C-COMM-MGMT-ONLY`         | App 없음 + `COMM_CONTENT_READ`                                                           | Management 1개, Work 403                                                       |
| `PS-C003` | `FX-C-COMM-SUPPORT`           | Provider + `COMM_SUPPORT_CONFIG`                                                         | 승인 Scope Read-only, NORMAL 합산 금지                                         |
| `PS-C004` | `FX-C-COMM-PROVIDER`          | Provider, Support Session 없음                                                           | Product Work·Management 403                                                    |
| `PS-C005` | `FX-C-SERVICE-MEMBER`         | `SERVICES_WORK`                                                                          | Services Work 4개만                                                            |
| `PS-C006` | `FX-C-SERVICE-CATALOG`        | App 없음 + `SERVICES_CATALOG_READ`                                                       | Catalog만, Operations Route Deny                                               |
| `PS-C007` | `FX-C-SERVICE-OPERATIONS`     | App 없음 + `SERVICES_OPERATIONS_READ`                                                    | Operations만, Catalog Route Deny                                               |
| `PS-C008` | `FX-C-SERVICE-ALL`            | App 없음 + Catalog Read + Operations Read                                                | Management 2개, Root 첫 허용 Child                                             |
| `PS-C009` | `FX-C-COMM-EDITOR`            | `COMM_WORK + COMM_CONTENT_EDITOR + COMMUNICATION_VISIBLE_1@v4 + ANNOUNCEMENT_DRAFT_1@v3` | 본인 Reader Action + Content Create/Update, Publish 403                        |
| `PS-C010` | `FX-C-COMM-PUBLISHER`         | `COMM_CONTENT_PUBLISHER + ANNOUNCEMENT_DRAFT_1@v3 + ANNOUNCEMENT_PUBLISHED_1@v4`         | Bound Publish/Archive, Create/Update 403                                       |
| `PS-C011` | `FX-C-SERVICE-CATALOG-EDITOR` | `SERVICES_CATALOG_EDITOR + SERVICE_CATALOG_ITEM_1@v5`                                    | Catalog Create/Bound Update, Operations 403                                    |
| `PS-C012` | `FX-C-SERVICE-AGENT`          | `SERVICES_OPERATIONS_AGENT + SERVICE_REQUEST_ASSIGNED_1@v3`; OTHER·stale delta 포함      | 본인 할당 Request Transition; 타 담당·Stale Version Deny, Catalog Mutation 403 |

## 5. Approvals Persona Fixture

| Test ID   | Fixture ID               | Composition / Delta                                                                                                                                                                                                                        | 기대                                                                                 |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `PS-A001` | `FX-A-MEMBER`            | `AP_WORK_MEMBER`                                                                                                                                                                                                                           | Work만                                                                               |
| `PS-A002` | `FX-A-DESIGNER`          | `AP_WORK_MEMBER + AP_DESIGN_DRAFT`                                                                                                                                                                                                         | Workflow/Form Draft, Policy·Publish 거부                                             |
| `PS-A003` | `FX-A-PUBLISHER`         | `AP_WORK_MEMBER + AP_DESIGN_PUBLISH + STEPUP_HIGH_WORKFLOW_PUBLISH_1`                                                                                                                                                                      | Bound Workflow Publish 1회, Draft Mutation 거부                                      |
| `PS-A004` | `FX-A-OPERATOR`          | `AP_WORK_MEMBER + AP_OPERATE + STEPUP_HIGH_RECOVERY_1`                                                                                                                                                                                     | Overview/Operations, Bound Event Retry 1회                                           |
| `PS-A005` | `FX-A-AUDITOR`           | `AP_WORK_MEMBER + AP_AUDIT_READ`                                                                                                                                                                                                           | 승인된 Evidence Read-only                                                            |
| `PS-A006` | `FX-A-MGMT-ONLY`         | App Entitlement 없음 + `AP_DESIGN_DRAFT`                                                                                                                                                                                                   | Root는 첫 관리 Child, Work 403                                                       |
| `PS-A007` | `FX-A-SOD-CONFLICT`      | 같은 `S_APPROVALS`에 `AP_DESIGN_DRAFT + AP_DESIGN_PUBLISH`                                                                                                                                                                                 | `SOD-APR-DESIGN-PUBLISH-V1` Assignment 거부                                          |
| `PS-A008` | `FX-A-EXPIRING`          | `AP_WORK_MEMBER + AP_OPERATE`, `validUntil=T0+4m59s`                                                                                                                                                                                       | 단일 Expiry 경고                                                                     |
| `PS-A009` | `FX-A-REVOKED`           | 처음 `AP_OPERATE`, 다음 Revision에서 Responsibility 비활성                                                                                                                                                                                 | 즉시 Context 제거·Mutation 409/403                                                   |
| `PS-A010` | `FX-A-POLICY-MANAGER`    | `AP_WORK_MEMBER + AP_POLICY_DRAFT`                                                                                                                                                                                                         | Policy Draft만, Publish 거부                                                         |
| `PS-A011` | `FX-A-SIGNATURE-READER`  | `AP_WORK_MEMBER + AP_SIGNATURE_READ`                                                                                                                                                                                                       | Signature Read만; Mutation·Secret Deny                                               |
| `PS-A012` | `FX-A-LEGACY-OVERSIGHT`  | Tenant Admin Seed + `AP_LEGACY_OVERSIGHT`                                                                                                                                                                                                  | 5개 Capability·6개 Route/Field Mask Read만; Sunset·Mutation Deny                     |
| `PS-A013` | `FX-A-POLICY-PUBLISHER`  | `AP_WORK_MEMBER + AP_POLICY_PUBLISH + STEPUP_HIGH_POLICY_PUBLISH_1`                                                                                                                                                                        | Bound Policy Publish 1회; Draft Update·Nonce 재사용 거부                             |
| `PS-A014` | `FX-A-FORM-PUBLISHER`    | `AP_WORK_MEMBER + AP_DESIGN_PUBLISH + STEPUP_HIGH_FORM_PUBLISH_1`                                                                                                                                                                          | Bound Form Publish 1회; Workflow·Draft Mutation 거부                                 |
| `PS-A015` | `FX-A-TASK-CLAIMER`      | `AP_WORK_MEMBER + TASK_CLAIM_1`                                                                                                                                                                                                            | `route.approvals.work.task-claim.action` Allow                                       |
| `PS-A016` | `FX-A-TASK-DECIDER`      | `AP_WORK_MEMBER + TASK_DECIDE_1`                                                                                                                                                                                                           | `route.approvals.work.task-decision.action` Allow; Claim 거부                        |
| `PS-A017` | `FX-A-TASK-SELF-DECIDER` | `AP_WORK_MEMBER + TASK_SELF_1`                                                                                                                                                                                                             | Decision 403 `SOD_CONFLICT`; Domain Mutation 0                                       |
| `PS-A018` | `FX-A-REQUEST-ACTOR`     | `AP_WORK_MEMBER + APPROVAL_HOME_PREF_1 + PAYLOAD_APPROVAL_HOME_PREF_UPDATE_1 + FORM_PUBLISHED_1 + APR_REQUEST_DRAFT_1 + APR_REQUEST_SUBMITTED_1 + APR_REQUEST_NEEDS_INFO_1 + APR_REQUEST_OTHER_1 + DELEGATION_SELF_1 + DELEGATION_OTHER_1` | Home Preference와 상태가 맞는 Own Request·Delegation ACTION만 Allow; Other-owned 404 |

Publisher와 Policy Publisher의 결합이 필요하면 별도 Fixture로 만들고 같은 Resource Set의
Maker-checker Policy를 적용한다. `Designer` Label만으로 Policy Capability를 추가하지 않는다.

`PS-A018`은 `route.approvals.work.home-preference-update.action`,
`route.approvals.work.request-create.action`,
`route.approvals.work.request-draft-update.action`,
`route.approvals.work.request-submit.action`,
`route.approvals.work.request-withdraw.action`,
`route.approvals.work.request-information-response.action`,
`route.approvals.work.delegation-create.action`,
`route.approvals.work.delegation-revoke.action`을 각각 적합한 Positive Object에 결속한다.
같은 호출을 `APR_REQUEST_OTHER_1` 또는 `DELEGATION_OTHER_1`로 바꾼 Negative Delta는 Product
Query·Mutation 전에 404 `RESOURCE_NOT_AVAILABLE`이어야 한다.

## 6. HCM Persona Fixture

| Test ID   | Fixture ID                        | Composition / Delta                                                                                                        | 기대                                                            |
| --------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `PS-H001` | `FX-H-EMPLOYEE`                   | `HCM_EMPLOYEE + HCM_HOME_PREF_1 + PAYLOAD_HCM_HOME_PREF_UPDATE_1 + TIME_CARD_SELF_1 + ABSENCE_SELF_1 + TALENT_GOAL_SELF_1` | Personal + 여섯 Self Action; Other-person Target 404            |
| `PS-H002` | `FX-H-LINE-MANAGER`               | `HCM_LINE_MANAGER`                                                                                                         | Personal + Team A                                               |
| `PS-H003` | `FX-H-DELEGATED-MANAGER`          | `HCM_EMPLOYEE + HCM_DELEGATED_MANAGER`                                                                                     | 위임 Team B만                                                   |
| `PS-H004` | `FX-H-TIME-ADMIN`                 | `HCM_EMPLOYEE + HCM_TIME_OPERATOR`                                                                                         | Personal + Time Operations, 다른 Domain 거부                    |
| `PS-H005` | `FX-H-WORKFORCE-OPERATOR`         | `HCM_EMPLOYEE + HCM_WORKFORCE_OPERATOR`                                                                                    | Personal + HR Operations, Management Mutation 거부              |
| `PS-H006` | `FX-H-ORG-CONFIG`                 | Person 없음 + `HCM_ORG_DESIGN_DRAFT`                                                                                       | HCM Management만                                                |
| `PS-H007` | `FX-H-REFERENCE-ADMIN`            | `HCM_EMPLOYEE + HCM_REFERENCE_DRAFT`                                                                                       | Personal + Reference Draft                                      |
| `PS-H008` | `FX-H-EXPORTER`                   | `HCM_EMPLOYEE + HCM_CONTROLLED_EXPORT + PAYLOAD_EXPORT_PREVIEW_1 + EXPORT_REQ_CANCEL_1`, Fresh Step-up 없음                | Masked Preview·Bound Cancel; Create·Retry는 Step-up 요구        |
| `PS-H009` | `FX-H-SUPPORT-READ`               | Person 없음 + `HCM_SUPPORT_READ`                                                                                           | Overview·People·Assignments Read-only만                         |
| `PS-H010` | `FX-H-OP-NO-PERSON`               | Person 없음 + `HCM_WORKFORCE_OPERATOR`                                                                                     | Root는 Operations, `/hr/home` Identity State                    |
| `PS-H011` | `FX-H-MGMT-NO-PERSON`             | Person 없음 + `HCM_ORG_DESIGN_DRAFT`                                                                                       | Root는 HCM Management, Personal Data 없음                       |
| `PS-H012` | `FX-H-MULTI-SCOPE`                | Time Operator Scope A(Default)·B, Grant별 Scope Key 결속                                                                   | A만 자동 선택, Scope Escape 거부                                |
| `PS-H013` | `FX-H-SCOPE-EXPIRED`              | `HCM_TIME_OPERATOR_EXPIRED + HCM_TIME_OPERATOR_B`; URL `S_EXPIRED_TIME`                                                    | Scope Expired, Active B로 자동 대체 없음                        |
| `PS-H014` | `FX-H-TENANT-ADMIN-ONLY`          | `TENANT_ADMIN + WORKSPACE_MEMBER`, Product Capability 없음                                                                 | HCM Work는 실제 Entitlement 정책값, Management 403              |
| `PS-H015` | `FX-H-TEAM-ONLY`                  | `HCM_LINE_MANAGER` + `hcm.personal-access.v1` Explicit Deny                                                                | Root는 Team, Person Binding으로 Personal Allow 추론 금지        |
| `PS-H016` | `FX-H-ORG-PUBLISHER`              | Person 없음 + `HCM_ORG_DESIGN_PUBLISH + STEPUP_HIGH_ORG_PUBLISH_1`                                                         | Bound Org Publish 1회; Create·Update 거부                       |
| `PS-H017` | `FX-H-REFERENCE-PUBLISH-RESERVED` | `HCM_EMPLOYEE + HCM_REFERENCE_DRAFT`; 예약 Publish 이름 요청                                                               | Reference Read·Update만; Publish Row·Grant·Challenge 0          |
| `PS-H018` | `FX-H-INTEGRATION-ADMIN`          | `HCM_EMPLOYEE + HCM_INTEGRATION_ADMIN + PAYLOAD_HRIS_CONNECTOR_CREATE_SAFE_1`, Fresh Step-up 없음                          | Read·Safe Create·Update; Execute Step-up 요구, Rotate 예약 거부 |
| `PS-H019` | `FX-H-EXPORTER-ACTIVE`            | `HCM_EMPLOYEE + HCM_CONTROLLED_EXPORT + STEPUP_CRITICAL_FRESH_1`                                                           | Bound Export Create 1회 Allow; Retry 전용 재사용 거부           |
| `PS-H020` | `FX-H-INTEGRATION-EXECUTOR`       | `HCM_EMPLOYEE + HCM_INTEGRATION_ADMIN + PAYLOAD_HRIS_CONNECTOR_CREATE_SAFE_1 + STEPUP_HIGH_INTEGRATION_EXECUTE_1`          | Safe Create·Update + Bound Execute 1회; Rotate·Target 교체 거부 |
| `PS-H021` | `FX-H-SECRET-ROTATE-RESERVED`     | `HCM_EMPLOYEE + HCM_INTEGRATION_ADMIN`; 예약 Rotate 이름 요청                                                              | Integration Read·Create·Update; Rotate Row·Grant·Challenge 0    |
| `PS-H022` | `FX-H-DIRECTORY-ONLY`             | `HCM_DIRECTORY_ONLY`; exact `APP.HCM:VIEW` Entitlement Deny                                                                | Directory/Organization만; Home·Me·HR Domain·Services 403        |
| `PS-H023` | `FX-H-ORG-APPROVER`               | Person 없음 + `HCM_ORG_DESIGN_APPROVE + ORG_1@v5`                                                                          | Bound Org Approval; Create·Update·Publish 거부                  |
| `PS-H024` | `FX-H-EXPORT-RETRIER`             | `HCM_EMPLOYEE + HCM_CONTROLLED_EXPORT + STEPUP_CRITICAL_EXPORT_RETRY_1`                                                    | Bound Export Retry 1회; Create/다른 Request/Nonce 재사용 거부   |

`PS-H008`, `PS-H019`, `PS-H024`는 Controlled Export를 하나의 포괄 `EXPORT` 동작으로 검사하지
않는다. 각각 `route.hcm.management.controlled-export-preview.data`,
`route.hcm.management.controlled-export-create.action`,
`route.hcm.management.controlled-export-cancel.action`,
`route.hcm.management.controlled-export-retry.action`을 독립 평가한다. Preview는 Masked
side-effect-free DATA, Cancel은 `EXPORT_REQ_CANCEL_1@v6`의 Expected Version, Create는
`STEPUP_CRITICAL_FRESH_1`, Retry는 `EXPORT_REQ_RETRY_1@v7`과
`STEPUP_CRITICAL_EXPORT_RETRY_1`을 요구한다.

`PS-H017`과 `PS-H021`의 예약 이름 Direct Evaluation은 `AUTHORITY_UNAVAILABLE`, 가상
Route Contract 제출은 `ROUTE_DENIED`, Challenge 발급 수는 0이다. `PS-H018`은
`hcm.integration.read`, `hcm.integration.create`, `hcm.integration.update`를 허용하고 Execute는
`STEP_UP_REQUIRED`, Rotate는 예약 계약으로 거부한다. `PS-H020`은 같은 세 기본 동작과 정확히
결속된 Execute 1회만 허용하며 Rotate·다른
Connector·Nonce 재사용을 허용하지 않는다.

## 7. 공통 Negative Fixture

| Fixture ID                              | 조합                                                                                                        | 반드시 거부·판정할 것                                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `FX-N-CARTESIAN`                        | Responsibility App A + Capability App B + Scope App C                                                       | 모든 Product Management Allow                                                |
| `FX-N-FOREIGN-SCOPE`                    | Actor A가 Actor B/Tenant B의 Opaque Scope Key 사용                                                          | Client 404 `RESOURCE_NOT_AVAILABLE`                                          |
| `FX-N-MANAGE-ONLY`                      | Legacy `MANAGE`만 있고 v2 Exact Action 없음                                                                 | Pilot CREATE, UPDATE, APPROVE, PUBLISH, EXECUTE, EXPORT                      |
| `FX-N-SUPPORT-NORMAL-UNION`             | NORMAL Write와 Active Support Read-only 동시 보유                                                           | Support Context의 모든 Write; NORMAL Context 반환                            |
| `FX-N-DESIGNER-POLICY-DIRECT`           | `AP_DESIGN_DRAFT`로 `/approvals/admin/policies` 직접 요청                                                   | `ROUTE_DENIED`; Policy·Signature Route와 API 모두 Deny                       |
| `FX-N-ROUTE-KEY-UNKNOWN`                | 미등록·퇴역 `routeContractKey`                                                                              | `ROUTE_DENIED`, Product API 0                                                |
| `FX-N-ROUTE-KEY-CROSS-SURFACE`          | 유효한 Policy Page Key를 Operations Path·Surface에 제출                                                     | `ROUTE_DENIED`, Product API 0                                                |
| `FX-N-ROUTE-METHOD-MISMATCH`            | Page GET Key로 Mutation Method를 요청                                                                       | `ROUTE_DENIED`, Domain Mutation 0                                            |
| `FX-N-REVIEWER-ONLY`                    | Named Reviewer Relationship, Tenant Admin 없음                                                              | 모든 `/admin/**`; 자신의 Work Item만 허용                                    |
| `FX-N-REVIEWER-STALE-VERSION`           | `WORK_ITEM_1@v11` Decision에 Expected Version 10 제출                                                       | 409 Version Conflict, Domain Mutation 0                                      |
| `FX-N-REVIEWER-REVOKED`                 | `WORK_ITEM_REVOKED_1`의 REVOKED Assignment로 Detail·Decision 요청                                           | 404 `RESOURCE_NOT_AVAILABLE`, Domain Mutation 0                              |
| `FX-N-REVIEWER-FOREIGN`                 | Actor가 `WORK_ITEM_OTHER_1`의 Reviewer가 아닌 상태로 Detail·Decision 요청                                   | 404 `RESOURCE_NOT_AVAILABLE`, Domain Mutation 0                              |
| `FX-N-JIT-ORG`                          | `ORG_UNIT` JIT Activation 요청                                                                              | 422 `JIT_SCOPE_UNSUPPORTED`; Request/Grant Row 0, Denied Audit 1             |
| `FX-N-STALE-REVISION`                   | Mutation Expected `D41`, Server Composite Revision `D42`                                                    | Domain Mutation 전 409 `DECISION_REVISION_CONFLICT`                          |
| `FX-N-UNKNOWN-DECISION`                 | Server Decision Enum에 미래 값                                                                              | Client `authority-unavailable`                                               |
| `FX-N-SCOPE-NO-DEFAULT`                 | 복수 Scope의 Default 0개                                                                                    | `scope-selection-required`; Product Query·Mutation 0                         |
| `FX-N-SCOPE-TWO-DEFAULTS`               | 복수 Scope의 Default 2개                                                                                    | Contract Error·Fail Closed                                                   |
| `FX-N-LEGACY-OVERSIGHT-SUNSET`          | `AP_LEGACY_OVERSIGHT`, Clock을 Sunset 이후로 이동                                                           | Allowlist Context 제거, Mutation·Read 모두 Deny                              |
| `FX-N-STEPUP-REPLAY`                    | 소비된 `STEPUP-MGMT-CRITICAL-V1` Challenge Nonce 재사용                                                     | 409 `STEP_UP_CHALLENGE_REPLAY`, Domain Mutation 0                            |
| `FX-N-STEPUP-TARGET-SWAP`               | `DS_HCM_CORE@v12` Challenge로 `DS_HCM_PAY@v8` 실행                                                          | 409 `STEP_UP_CHALLENGE_MISMATCH`, Domain Mutation·Nonce 소비 0               |
| `FX-N-STEPUP-VERSION-SWAP`              | `DS_HCM_CORE@v12` Challenge로 `DS_HCM_CORE@v13` 실행                                                        | 409 `STEP_UP_CHALLENGE_MISMATCH`, Domain Mutation·Nonce 소비 0               |
| `FX-N-STEPUP-PAYLOAD-SWAP`              | Challenge 발급 후 Export Population/Payload 변경                                                            | 409 `STEP_UP_CHALLENGE_MISMATCH`, Domain Mutation·Nonce 소비 0               |
| `FX-N-SOD-WORKFLOW-MAKER`               | Publisher Actor를 `WF_1.makerId=U_WF_MAKER`와 동일하게 변경                                                 | Mutation 403 `SOD_CONFLICT`, Publish·Nonce 소비 0                            |
| `FX-N-SOD-FORM-MAKER`                   | Publisher Actor를 `FORM_1.makerId=U_FORM_MAKER`와 동일하게 변경                                             | Mutation 403 `SOD_CONFLICT`, Publish·Nonce 소비 0                            |
| `FX-N-SOD-POLICY-MAKER`                 | Publisher Actor를 `POL_1.makerId=U_POLICY_MAKER`와 동일하게 변경                                            | Mutation 403 `SOD_CONFLICT`, Publish·Nonce 소비 0                            |
| `FX-N-SOD-RECOVERY-ORIGINATOR`          | Operator Actor를 `OUT_1.eventOriginatorId`와 동일하게 변경                                                  | Mutation 403 `SOD_CONFLICT`, Retry·Nonce 소비 0                              |
| `FX-N-SOD-RECOVERY-AUDITOR`             | Operator Actor를 `OUT_1.assignedAuditorId`와 동일하게 변경                                                  | Mutation 403 `SOD_CONFLICT`, Retry·Nonce 소비 0                              |
| `FX-N-SOD-ORG-MAKER`                    | Publisher Actor를 `ORG_1.makerId=U_ORG_MAKER`와 동일하게 변경                                               | Mutation 403 `SOD_CONFLICT`, Publish·Nonce 소비 0                            |
| `FX-N-SOD-ORG-APPROVER-MAKER`           | Approver Actor를 `ORG_1.makerId=U_ORG_MAKER`와 동일하게 변경                                                | Approval 403 `SOD_CONFLICT`, Domain Mutation 0                               |
| `FX-N-REFERENCE-PUBLISH-RESERVED`       | Active `HCM_REFERENCE_DRAFT`로 예약 Publish 이름·가상 Route·Challenge 요청                                  | Direct Evaluation `AUTHORITY_UNAVAILABLE`, Route `ROUTE_DENIED`, Challenge 0 |
| `FX-N-INTEGRATION-ROTATE-RESERVED`      | Active `HCM_INTEGRATION_ADMIN`으로 예약 Rotate 이름·가상 Route·Challenge 요청                               | Direct Evaluation `AUTHORITY_UNAVAILABLE`, Route `ROUTE_DENIED`, Challenge 0 |
| `FX-N-PARTY-EVIDENCE-MISSING`           | 대상 Object의 Maker/Originator/Auditor Evidence 누락                                                        | `AUTHORITY_UNAVAILABLE`, Domain Mutation·Nonce 소비 0                        |
| `FX-N-APPROVAL-TASK-UNCLAIMABLE`        | `TASK_DECIDE_1`에 `route.approvals.work.task-claim.action` 제출                                             | 403, Domain Mutation 0                                                       |
| `FX-N-APPROVAL-TASK-SELF-DECISION`      | `TASK_SELF_1`에 `route.approvals.work.task-decision.action` 제출                                            | 403 `SOD_CONFLICT`, Domain Mutation 0                                        |
| `FX-N-APPROVAL-REQUEST-OTHER`           | `APR_REQUEST_OTHER_1`/`DELEGATION_OTHER_1`에 Work ACTION 제출                                               | 404 `RESOURCE_NOT_AVAILABLE`, Query·Mutation 0                               |
| `FX-N-APPROVAL-HOME-PREFERENCE-KEY`     | `route.approvals.work.home-preference-update.action`에 `surfaceKey!=approval-home` 제출                     | `ROUTE_DENIED`, Platform Mutation 0                                          |
| `FX-N-HCM-SELF-TARGET-OUTSIDE`          | Self Grant로 `TIME_CARD_OTHER_1`/`ABSENCE_OTHER_1`/`TALENT_GOAL_OTHER_1` 요청                               | 404 `RESOURCE_NOT_AVAILABLE`, Query·Mutation 0                               |
| `FX-N-HCM-HOME-PREFERENCE-KEY`          | `route.hcm.personal.home-preference-update.action`에 `surfaceKey!=hcm-home` 제출                            | `ROUTE_DENIED`, Platform Mutation 0                                          |
| `FX-N-INTEGRATION-CREDENTIAL-REFERENCE` | Integration Create/Update에 `PAYLOAD_HRIS_CONNECTOR_SECRET_1` 제출                                          | Request Validation Reject, Domain Mutation 0, Secret 값 Audit/Log 0          |
| `FX-N-EXPORT-PREVIEW-PROJECTION`        | Preview가 원문 Row·금지 Field 또는 `LEGAL_A_ACTIVE` 밖 Aggregate 반환 시도                                  | Projection Schema/Hash Fail Closed, Raw Data Response 0                      |
| `FX-N-TEAM-TARGET-OUTSIDE`              | Team A Grant로 `P_B201`/`TIME_B_1`/`ABSENCE_B_1` 요청                                                       | 404 `RESOURCE_NOT_AVAILABLE`; 존재 여부·행 데이터 비노출                     |
| `FX-N-DOMAIN-TARGET-OUTSIDE`            | Legal A Time Grant로 `TIME_B_1` 요청                                                                        | 404 `RESOURCE_NOT_AVAILABLE`; Query·Mutation 0                               |
| `FX-N-WORKFORCE-TARGET-OUTSIDE`         | Legal A Workforce Grant로 `P_B201`/`ASSIGNMENT_B_1` 요청                                                    | 404 `RESOURCE_NOT_AVAILABLE`; Query·Mutation 0                               |
| `FX-N-EXPORT-TARGET-OUTSIDE`            | Legal A Export Grant로 `DS_HCM_PAY`/`LEGAL_B_ACTIVE` 요청                                                   | 404 `RESOURCE_NOT_AVAILABLE`; Export·Nonce 소비 0                            |
| `FX-N-EXPORT-STEPUP-CROSS-ACTION`       | Create Challenge를 `route.hcm.management.controlled-export-retry.action`에, Retry Challenge를 Create에 제출 | 409 `STEP_UP_CHALLENGE_MISMATCH`; Mutation·Nonce 소비 0                      |
| `FX-N-FLAG-INVALID`                     | 제품 `(S,E_p,U_p)`가 `000`, `100`, `110`, `111` 이외 조합                                                   | Configuration Reject, 인가 Legacy Fallback 없음                              |
| `FX-N-FLAG-CROSS-PRODUCT`               | Approvals `E_p` Decision을 HCM 상태 합성에 주입                                                             | Exact Flag Key Reject, HCM Authority 평가 0                                  |
| `FX-N-FLAG-LEGACY-GLOBAL`               | Legacy 전역 E만 true이고 제품 `E_p=false`                                                                   | 제품 상태는 `100`; Exact Authority 평가 0                                    |
| `FX-N-LATCH-MIGRATION`                  | v2 첫 조회 MISSING + Legacy v1 존재; probe 중 v2 생성/미생성 두 경우                                        | 재조회 v2 우선, 두 번 MISSING일 때만 `MIGRATION_REQUIRED`; Cross-slot 0      |
| `FX-N-LATCH-CORRUPT`                    | v2 Hash의 Schema·Product·bit·Revision·Field 수·TTL 중 하나가 계약 위반                                      | `CORRUPT`, Cached Allow·Legacy Fallback 0, Context Envelope 503              |

## 8. Context 조합 Fixture

### `FX-C-ROLLOUT-MIXED`

Local Tenant의 `S=1`을 12개 제품이 공유한다. Approvals·Communications·HCM·Services는 각
`E_p=1,U_p=1`로 `111`, Calendar·DWAI·ON·Mail·Meetings·Messaging·Notifications·Spaces·Workplace는 각
`E_p=0,U_p=0`으로 `100`이다. 한 Context Envelope에서 12개 Product가 정확히 한 번씩 반환되고
전자의 불변 v3 PAGE 58개만 Exact Authority를 평가한다. 제품별 `E_p/U_p`가 다르다는 이유로 Envelope
전체를 거부하거나, Legacy 전역 E로 후자의 상태를 `110/111`로 올리면 실패다.

### `FX-C-MULTI-WINDOW`

같은 `productKey + surfaceKey + NORMAL` Context에 Read Grant는 `T0+30m`, Update Grant는
`T0+10m`으로 둔다. Context는 하나이고 `revalidateAt=T0+10m`이다. T0+10m 직후 Update Grant만
제거하며 Read Context는 새 `decisionRevision`으로 유지한다. Client가 Context 전체를 만료시키거나
Update 유효기간을 Read에 확대하면 실패다.

### `FX-C-SUPPORT-EXCLUSIVE`

같은 Actor가 NORMAL Write와 `SUPPORT_HCM_READ_1`을 모두 가져도 Active Mode가
`PROVIDER_SUPPORT`인 동안 Support Context 하나만 반환한다. NORMAL Context, Capability 또는
Scope를 같은 응답에 합치면 실패다. Session 종료 뒤 새 Composite Revision에서만 NORMAL을 다시
평가한다.

### `FX-C-SOURCE-REVISION`

`auth`, `policy`, `productRelationship`, `targetPopulation`, `support` Source를 한 번에
하나씩만 변경하는 다섯 Fixture를 둔다. 각각 새 `decisionRevision`을 발급하고 이전
Revision의 Mutation은 Domain Target 조회·변경 전 409 `DECISION_REVISION_CONFLICT`를
반환한다. Target Population만 바뀐 경우도 예외가 아니다.

## 9. Risk Policy Fixture

| Fixture                  | Policy ID                                           | 핵심 Predicate                                                                                    |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Approvals Design Publish | `SOD-APR-DESIGN-PUBLISH-V1` + `STEPUP-MGMT-HIGH-V1` | 같은 Resource Set의 Maker와 Publisher 분리                                                        |
| Approvals Policy Publish | `SOD-APR-POLICY-PUBLISH-V1` + `STEPUP-MGMT-HIGH-V1` | 같은 Policy Scope의 Maker와 Publisher 분리                                                        |
| Approvals Recovery       | `SOD-APR-OPS-AUDIT-V1` + `STEPUP-MGMT-HIGH-V1`      | Assignment은 겹치는 Scope의 Operator/Auditor, Mutation은 Event의 Operator/Originator/Auditor 분리 |
| HCM Org Approval         | `SOD-HCM-ORG-APPROVAL-V1`                           | 같은 Config Version의 Approver와 Maker 분리                                                       |
| HCM Org Publish          | `SOD-HCM-ORG-PUBLISH-V1` + `STEPUP-MGMT-HIGH-V1`    | 같은 Config Version의 Maker와 Publisher 분리                                                      |
| HCM Controlled Export    | `STEPUP-MGMT-CRITICAL-V1`                           | Create/Retry별 Command Binding, Fresh MFA, 300초 TTL, Single-use Nonce                            |

HCM Reference Publish와 Integration Secret Rotation은 Post-Pilot 예약이므로 Pilot Risk Policy
Fixture에 없다. 관련 SoD·Step-up Policy ID, Active Grant와 Challenge를 미리 만들지 않는다.

## 10. Fixture 불변식

1. Test가 Persona 이름을 직접 검사하지 않고 Fixture의 Exact Contract만 사용한다.
2. 같은 Fixture가 Menu, Route, Direct Evaluation, Gateway와 Product API Test에 사용된다.
3. `validFrom/validUntil`, Scope와 Relationship은 고정 Clock에서 판정한다.
4. Fixture 변경은 관련 Test ID, Capability Registry와 본 문서를 같은 변경에서 갱신한다.
5. Production Role Assignment를 Fixture 생성 목적으로 변경하지 않는다.
