# HRIS-PAY authorization contract

DWP Auth owns app entitlement/access packages/atomic duties. Payroll owns legal-entity/pay-group/period/worker populations, sensitive-field projection, run state and monetary SoD. Navigation is a permission projection only.

## Effective decision

`ALLOW = app entitlement ∧ atomic action ∧ Payroll population ∧ field-purpose policy ∧ aggregate state ∧ maker/checker SoD ∧ step-up ∧ installed country/provider/connector`.

Deny, expiry, suspension and legal hold win. Tenant/actor cannot be supplied by request data. Missing and out-of-scope resources both return opaque 404. Filters/search/sort/export enforce the same field and population policy as response projection.

## Atomic duties

| Duty | Representative actions | Scope |
|---|---|---|
| `PAY_EMPLOYEE` | own published payslip and YEA case/task | `SELF` |
| `PAY_INPUT_MAKER` | fixed/variable/exception/tax input and bulk validation | `PAY_GROUP|NAMED_POPULATION` |
| `PAY_CONFIG_AUTHOR` | draft foundation/element/formula/rounding/mapping | `LEGAL_PAYROLL_ENTITY|PAY_GROUP` |
| `PAY_CONFIG_APPROVER` | publish validated config/formula | same assigned scope |
| `PAY_RUN_MAKER` | prepare/calculate/retry/validate run | `PAY_GROUP|PAY_PERIOD` |
| `PAY_RUN_APPROVER` | approve/finalize run | `LEGAL_PAYROLL_ENTITY|PAY_GROUP|PAY_PERIOD` |
| `PAY_RESULT_REVIEWER` | exception/trace/control-total/reconciliation | `PAY_GROUP|PAY_PERIOD|NAMED_POPULATION` |
| `PAY_PAYMENT_MAKER` | create canonical payment batch | `LEGAL_PAYROLL_ENTITY|PAY_PERIOD` |
| `PAY_PAYMENT_RELEASER` | approve/release/download bank file | same scope + step-up |
| `PAY_GL_MAKER` | create/balance journal | `LEGAL_PAYROLL_ENTITY|PAY_PERIOD` |
| `PAY_GL_POSTER` | approve/post/reverse journal | same scope + step-up |
| `PAY_STATUTORY_OPERATOR` | country/YEA case calculation/review/file/correct | jurisdiction + legal entity |
| `PAY_PACK_APPROVER` | activate/suspend country/provider pack | tenant/legal entity + step-up |
| `PAY_INTEGRATION_OPERATOR` | connection assignment/reconcile/replay | connector + legal entity |
| `PAY_AUDITOR` | read-only result/audit/reconciliation | assigned audit scope |

Employee/manager/operator/settings/auditor labels are packages over atomic duties. No single “Payroll admin” bypass role is allowed in production.

## DWP 권한그룹 구성

HRIS 앱 entitlement 아래에서 DWP 권한그룹이 Payroll atomic duty를 조합한다. 그룹명 자체를 API 조건문으로 하드코딩하지 않는다.

| DWP 권한그룹 | 기본 PAY access package | 기본 범위와 제한 |
|---|---|---|
| `직원` | `PAY_EMPLOYEE` | `SELF`; 게시된 본인 급여명세와 본인 YEA case/task만 |
| `관리자` | 기본 급여 원장 duty 없음 | 팀 급여 상세는 차단; 필요 시 비식별 인원/상태 위젯만 별도 aggregate duty로 제공 |
| `업무운영자` | 직무별 input/run/result/payment/GL/statutory/integration duty 조합 | legal entity/pay group/period/named population에 한정; maker/checker/releaser/poster 분리 |
| `설정관리자` | `PAY_CONFIG_AUTHOR/APPROVER`, 필요 시 `PAY_PACK_APPROVER` | 설정 작성·게시·국가/제공자 pack 활성화를 분리하고 활성화에는 step-up 적용 |
| `전사감사자` | `PAY_AUDITOR` | 명시된 감사 범위·목적·기간의 읽기 전용; 명세/세무/계좌 필드는 별도 projection 정책 적용 |

복수 그룹 부여 시에도 deny/SoD/field-purpose/run-state가 우선한다. 테넌트 관리자는 그룹별 access package, scope, 유효기간을 배포하고 Payroll PEP가 매 요청의 객체·금액·상태를 최종 판정한다. 개발 환경의 전체 메뉴 노출은 API 권한을 우회하지 않으며 운영 권한 템플릿으로 사용하지 않는다.

## Sensitive field groups

| Group | Default | Extra control |
|---|---|---|
| run status/count/control totals | scoped view | no individual details unless result duty |
| worker result lines | omit outside Payroll | result duty + named population/purpose |
| calculation intermediate trace | omit | trace duty; optional step-up; no formula expression export |
| bank token metadata | masked | payment duty; plain account never returned |
| payment/bank file | omit | release/download duty + step-up + short grant + access audit |
| tax profile/YEA evidence | omit | statutory duty + purpose + highly restricted projection |
| payslip | self only by default | operator access needs named population, purpose and step-up |
| export/audit bundle | omit | export/audit duty + purpose + step-up + expiry + immutable access record |

Small-population aggregates are suppressed/bucketed to prevent salary inference. Sensitive field authorization applies to query predicates and ordering as well as response fields.

## Mandatory SoD

- run maker cannot approve or finalize the same run.
- formula/config author cannot publish that same version alone.
- input/correction maker cannot solely approve the affected run.
- bank-account changer cannot release the corresponding payment.
- payment maker cannot be sole payment releaser.
- GL maker cannot be sole GL poster.
- YEA evidence collector cannot be sole provider submitter/filer.
- pack installer cannot be sole statutory activation approver.
- connector replayer cannot waive its own monetary reconciliation issue.
- auditor has no mutation duty.

Object-level SoD uses immutable actor/action/revision facts, not only current group membership. Emergency access is time-bound, separately approved, step-up protected and post-reviewed; it cannot bypass append-only or control-total invariants.

Every decision audit stores access-package/atomic-duty revision, Payroll population revision, fields returned/omitted/masked, purpose, run/object state and version, SoD outcome and step-up session. Automated negative suites cover cross-tenant, cross-pay-group, stale version, maker-checker, bank-token, export, disabled pack/provider and post-finalization mutation.
