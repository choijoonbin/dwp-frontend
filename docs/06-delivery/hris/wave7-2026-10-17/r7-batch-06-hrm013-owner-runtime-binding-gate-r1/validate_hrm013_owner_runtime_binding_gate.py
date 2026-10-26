#!/usr/bin/env python3
"""Validate the append-only HRM-013 owner/runtime binding gate carrier."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
import sys
import uuid
from pathlib import Path, PurePosixPath
from typing import Any


SCRIPT_FILE = Path(__file__).absolute()
HERE = SCRIPT_FILE.parent
FRONTEND = HERE.parents[4]
WORKSPACE = FRONTEND.parent
BACKEND = WORKSPACE / "dwp-backend"
AGENT = WORKSPACE / "dwp_agent"
GATE_PATH = HERE / "hrm-013-owner-runtime-binding-gate.v1.json"
REVIEW_PATH = HERE / "independent-review.v1.json"
BACKEND_BASE = "c50b267e7b015758ab6f7acc7fdf353eee81e631"
BACKEND_TREE = "22bd6533ab340cfb91c6cf5ab5fd6991e501e6c4"
FRONTEND_BASE = "cf7b70f2d1c079da114f62a3df15f784fcd9439d"
FRONTEND_TREE = "5bcc595f5b07a81ca7528838eba1bc06010dd0c4"
AGENT_BASE = "9beb5439cad065e7d919a98c9f9becb44481508a"
EXPECTED_CRITICAL_GATE_SHA256 = "4d19adbfaa702372dc376b16e06c33045bda511ca8b4f2e45309cf7273d184b1"
CRITICAL_GATE_KEYS = [
    "lineage",
    "sourceAudit",
    "decisions",
    "futureExecutionTopology",
    "futureSourceAllowlists",
    "nextExecutionAuthorityPrerequisites",
    "futureTargetTestAllowlists",
    "activationGatePrerequisites",
    "targetedAcceptanceMatrix",
    "validationStrategy",
    "authority",
    "nonClaims",
    "nextAction",
]
EXPECTED_HRIS_CONTRACT_SCRIPT = (
    "python3 docs/06-delivery/hris/tools/validate_current_authority.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-semantic-closure-r1/validate_hrm013_semantic_closure.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-callback-binding-r1/validate_hrm013_callback_binding.py && "
    "python3 docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-binding-gate-r1/"
    "validate_hrm013_owner_runtime_binding_gate.py"
)
EXPECTED_SUCCESSOR_VALIDATOR_PATH = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-runtime-contract-authority-r1/"
    "validate_hrm013_runtime_contract_authority.py"
)
EXPECTED_SUCCESSOR_SCRIPT_PREFIX = (
    EXPECTED_HRIS_CONTRACT_SCRIPT
    + " && python3 "
    + EXPECTED_SUCCESSOR_VALIDATOR_PATH
)

EXPECTED_LINEAGE: dict[str, tuple[int, str]] = {
    "../r7-batch-06-hrm013-paired-prerequisite-r1/paired-prerequisite-central-integration-receipt-successor.v2.json": (
        6309,
        "19dab7faef1f22a9c58db970b88dc29298e3eff7ba11c9f41dd787418089f980",
    ),
    "../r7-batch-06-hrm013-callback-binding-r1/hrm-013-trusted-callback-service-binding-successor.v1.json": (
        50694,
        "56a27680c74e07967e4bf03c1984ac8d4786a1a0f4ef68c560363a41b1020be9",
    ),
    "../r7-batch-06-hrm013-callback-binding-r1/hrm-013-separation-waiver-approval-bridge-successor.v1.json": (
        39005,
        "43717d43a7aed49c56abe715188e5891d9c7da79d45125bfdc68acf0064ea7b5",
    ),
    "../r7-batch-06-hrm013-callback-binding-r1/migration-manifests/base-tfr-hrm-013.people-v61-schema-manifest-successor.v2.json": (
        42115,
        "01aff4919302d2a5adc951f96b7dd513b752526c8e3066d4d0317d973c14d6a8",
    ),
    "../r7-batch-06-hrm013-callback-binding-r1/migration-manifests/hrm-013.approval-v59-schema-manifest.v1.json": (
        25781,
        "8bec7573ed5453e2ca83b665d2824ae763a93703483ddf59063315cc7a8eff50",
    ),
}

EXPECTED_REPOSITORY_PINS: dict[str, Any] = {
    "backend": {
        "repository": "dwp-backend",
        "branch": "dwp-dev",
        "commit": BACKEND_BASE,
        "tree": BACKEND_TREE,
        "originEqualAtAudit": True,
    },
    "frontend": {
        "repository": "dwp-frontend",
        "branch": "dwp-dev",
        "commit": FRONTEND_BASE,
        "tree": FRONTEND_TREE,
        "originEqualAtAudit": True,
    },
    "agent": {
        "repository": "dwp_agent",
        "branch": "dwp-dev",
        "commit": AGENT_BASE,
        "originEqualAtAudit": True,
    },
}

EXPECTED_BINDING_OWNERS: dict[str, str] = {
    "SVC-AUT-HRM-011": "spiffe://dwp/service/dwp-auth-server",
    "SVC-AUT-HRM-012": "spiffe://dwp/service/dwp-auth-server",
    "SVC-AUT-HRM-013": "spiffe://dwp/service/dwp-auth-server",
    "SVC-AUT-HRM-014": "spiffe://dwp/service/dwp-auth-server",
    "SVC-AUT-HRM-015": "spiffe://dwp/service/dwp-auth-server",
    "SVC-AUT-HRM-016": "spiffe://dwp/service/dwp-auth-server",
    "SVC-PEP-APR-002": "spiffe://dwp/service/dwp-approval-server",
    "SVC-PEP-HRM-008": "spiffe://dwp/service/dwp-people-server",
    "SVC-PEP-HRM-009": "spiffe://dwp/service/dwp-people-server",
    "SVC-PEP-HRM-010": "spiffe://dwp/service/dwp-people-server",
    "SVC-PEP-TIM-004": "spiffe://dwp/service/dwp-time-server",
    "SVC-PEP-PAY-002": "spiffe://dwp/service/dwp-payroll-server",
}

EXPECTED_GATE_AUTHORITY: dict[str, Any] = {
    "ownerRuntimeBindingGatePreparationComplete": True,
    "p0ContractDecisionsClosed": True,
    "independentReviewRequired": True,
    "independentReviewComplete": False,
    "gateCarrierCommitAndPushAuthorized": False,
    "nextSequentialSharedAndAuthGenerationAuthorityPreparationEligibleAfterReviewAndPush": True,
    "sharedContractImplementationAuthorized": False,
    "authV62GenerationPreparationAuthorized": False,
    "authV271ReservationAuthorized": False,
    "authV271ImplementationAuthorized": False,
    "approvalRuntimeImplementationAuthorized": False,
    "peopleOwnerRuntimeImplementationAuthorized": False,
    "taskDispatchOwnerImplementationAuthorized": False,
    "performanceConsumerImplementationAuthorized": False,
    "grantRotationAuthorized": False,
    "worktreeAuthorized": False,
    "sourceAuthoringAuthorized": False,
    "migrationAuthoringAuthorized": False,
    "controllerOrRelayActivationAuthorized": False,
    "callbackProducerImplementationAuthorized": False,
    "frontendUiMenuOrRouteAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "runtimeCredentialBindingAuthorized": False,
    "productionBindingAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}

EXPECTED_REVIEW_AUTHORITY: dict[str, Any] = {
    "independentReviewComplete": True,
    "gateCarrierCommitAndPushAuthorized": True,
    "nextSequentialSharedAndAuthGenerationAuthorityPreparationEligibleAfterCarrierPush": True,
    "sharedContractImplementationAuthorized": False,
    "authV62GenerationPreparationAuthorized": False,
    "authV271ReservationAuthorized": False,
    "authV271ImplementationAuthorized": False,
    "approvalRuntimeImplementationAuthorized": False,
    "peopleOwnerRuntimeImplementationAuthorized": False,
    "taskDispatchOwnerImplementationAuthorized": False,
    "performanceConsumerImplementationAuthorized": False,
    "grantRotationAuthorized": False,
    "sourceAuthoringAuthorized": False,
    "migrationAuthoringAuthorized": False,
    "worktreeAuthorized": False,
    "controllerOrRelayActivationAuthorized": False,
    "callbackProducerImplementationAuthorized": False,
    "frontendUiMenuOrRouteAuthorized": False,
    "featureEnablementAuthorized": False,
    "tenantEnrollmentAuthorized": False,
    "runtimeCredentialBindingAuthorized": False,
    "productionBindingAuthorized": False,
    "productionReleaseAuthorized": False,
    "businessCompletionCredit": 0,
}


def run(repo: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(args, cwd=repo, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise RuntimeError(
            f"{' '.join(args)} failed in {repo}: "
            f"{result.stderr.decode(errors='replace').strip()}"
        )
    return result


def text(repo: Path, *args: str) -> str:
    return run(repo, *args).stdout.decode().strip()


def digest_file(path: Path) -> tuple[int, str]:
    data = path.read_bytes()
    return len(data), hashlib.sha256(data).hexdigest()


def digest_git_blob(repo: Path, revision: str, relative_path: str) -> tuple[int, str] | None:
    result = run(repo, "git", "show", f"{revision}:{relative_path}", check=False)
    if result.returncode:
        return None
    return len(result.stdout), hashlib.sha256(result.stdout).hexdigest()


def canonical_digest(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def expand_required_register_rows(register_contract: dict[str, Any]) -> list[dict[str, str]]:
    header = register_contract.get("requiredHeader", [])
    common = register_contract.get("requiredCommonColumns", {})
    profiles = register_contract.get("requiredProfiles", {})
    rows: list[dict[str, str]] = []
    if not isinstance(header, list) or len(header) != len(set(header)):
        return []
    for specification in register_contract.get("requiredRows", []):
        profile = profiles.get(specification.get("profile"), {})
        columns = specification.get("columns", {})
        if not all(isinstance(value, dict) for value in (common, profile, columns)):
            return []
        row = {**common, **profile, **columns}
        if list(row) == [] or set(row) != set(header):
            return []
        if not all(isinstance(row.get(column), str) and row.get(column) for column in header):
            return []
        rows.append({column: row[column] for column in header})
    return rows


def is_ancestor(repo: Path, ancestor: str, descendant: str) -> bool:
    return run(
        repo, "git", "merge-base", "--is-ancestor", ancestor, descendant, check=False
    ).returncode == 0


def is_symlink_free_repo_path(repo: Path, relative_path: str) -> bool:
    if not repo.is_absolute() or repo.resolve() != repo:
        return False
    candidate = PurePosixPath(relative_path)
    if candidate.is_absolute() or candidate.as_posix() != relative_path:
        return False
    current = repo
    for part in candidate.parts:
        if part in {"", ".", ".."}:
            return False
        current = current / part
        if current.is_symlink():
            return False
    return True


def reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    value: dict[str, Any] = {}
    for key, item in pairs:
        if key in value:
            raise ValueError(f"duplicate JSON key: {key}")
        value[key] = item
    return value


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(
        path.read_text(encoding="utf-8"),
        object_pairs_hook=reject_duplicate_keys,
    )


parser = argparse.ArgumentParser()
parser.add_argument(
    "--authoring",
    action="store_true",
    help="Allow only the exact uncommitted gate carrier paths while authoring.",
)
args = parser.parse_args()

errors: list[str] = []
checks = 0


def require(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        errors.append(message)


require(
    SCRIPT_FILE.resolve() == SCRIPT_FILE
    and FRONTEND.resolve() == FRONTEND
    and Path(text(FRONTEND, "git", "rev-parse", "--show-toplevel")).resolve()
    == FRONTEND,
    "validator invocation path or frontend Git root is symlinked or re-anchored",
)


require(GATE_PATH.is_file(), "gate artifact missing")
require(REVIEW_PATH.is_file(), "independent review artifact missing")
gate = load_json(GATE_PATH) if GATE_PATH.is_file() else {}
review = load_json(REVIEW_PATH) if REVIEW_PATH.is_file() else {}

require(
    gate.get("schema") == "dwp.hris.wave7.hrm013-owner-runtime-binding-gate.v1",
    "gate schema drift",
)
require(
    gate.get("state")
    == "PREPARED_EXACT_OWNER_RUNTIME_BINDING_GATE_INDEPENDENT_REVIEW_REQUIRED_ZERO_IMPLEMENTATION_AUTHORITY",
    "gate state drift",
)
require(gate.get("sliceId") == "BASE-TFR-HRM-013", "slice identity drift")
require(
    canonical_digest({key: gate.get(key) for key in CRITICAL_GATE_KEYS})
    == EXPECTED_CRITICAL_GATE_SHA256,
    "critical gate topology, allowlist, acceptance or authority digest drift",
)
require(
    gate.get("sourceAudit", {}).get("unresolvedP0BeforeThisGate") == 20,
    "source-audit P0 closure count drift",
)

lineage_paths = {
    value.get("path"): (value.get("bytes"), value.get("sha256"))
    for value in gate.get("lineage", {}).values()
    if isinstance(value, dict) and "path" in value
}
require(lineage_paths == EXPECTED_LINEAGE, "lineage path or pin set drift")
require(
    gate.get("lineage", {}).get("repositoryPins") == EXPECTED_REPOSITORY_PINS,
    "repository lineage pin map drift",
)
for relative, expected in EXPECTED_LINEAGE.items():
    path = (HERE / relative).resolve()
    require(path.is_file(), f"lineage artifact missing: {relative}")
    if path.is_file():
        require(digest_file(path) == expected, f"lineage bytes/hash drift: {relative}")

receipt = load_json(
    (HERE / "../r7-batch-06-hrm013-paired-prerequisite-r1/paired-prerequisite-central-integration-receipt-successor.v2.json").resolve()
)
receipt_authority = receipt["authority"]
require(
    receipt_authority["pairedPrerequisiteIntegrationComplete"] is True,
    "paired prerequisite is not complete",
)
require(
    receipt_authority["nextOwnerRuntimeBindingGatePreparationAuthorized"] is True,
    "predecessor does not authorize gate preparation",
)
require(
    receipt_authority["nextOwnerRuntimeBindingGateImplementationAuthorized"] is False,
    "predecessor unexpectedly authorizes implementation",
)

decisions = gate.get("decisions", {})
shared = decisions.get("sharedContractOwnership", {})
require(
    shared.get("package") == "com.dwp.platform.contracts.hris.separation.v1",
    "shared package drift",
)
require(len(shared.get("files", [])) == 6, "shared contract file count drift")
require(len(set(shared.get("files", []))) == 6, "duplicate shared contract path")
require(
    shared.get("files", [])[-2:]
    == [
        "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013RequesterIdentityAuthorityV1.java",
        "dwp-platform-contracts/src/main/java/com/dwp/platform/contracts/hris/separation/v1/Hrm013TaskDispatchV1.java",
    ],
    "requester or task-dispatch shared ownership drift",
)
require(
    "grantUseMode plus conditional seven-field DRAIN_EXISTING claims"
    in shared.get("rules", [""])[0]
    and "including SVC-AUT-HRM-013" in shared.get("rules", [""])[0]
    and "approvalRequestId already required by the requester-identity body"
    in shared.get("rules", [""])[0]
    and "changing the five-header envelope"
    in shared.get("rules", [""])[0]
    and
    "OAuth2 bearer or client-assertion Authorization transport are forbidden"
    in shared.get("rules", ["", "", ""])[2]
    and "TLS_1_3_MTLS_SPIFFE_AND_RS256_CLIENT_CREDENTIAL_JWT"
    in shared.get("rules", ["", "", ""])[2]
    and "X-DWP-Workload-Proof" in shared.get("rules", ["", "", ""])[2],
    "sealed client-credential label compatibility drift",
)

control = decisions.get("serviceGrantControlPlane", {})
require(control.get("authoritativeOwner") == "dwp-auth-server", "authority owner drift")
require(control.get("migration", {}).get("version") == "V271", "Auth migration drift")
require(control.get("migration", {}).get("reservedByThisGate") is False, "Auth V271 reserved early")
require(control.get("migration", {}).get("authoringAuthorizedByThisGate") is False, "Auth V271 authoring granted early")
require(
    any(
        item.get("name") == "auth_hris_service_authority_proof_replays"
        and "rotation-readiness proofs" in item.get("role", "")
        for item in control.get("tables", [])
    ),
    "rotation-readiness replay namespace scope drift",
)
require(
    len(control.get("tables", [])) == 5
    and any(
        item.get("name") == "auth_hris_service_grant_quiesce_fences"
        and "QUIESCING, CUTOVER or ABORTED" in item.get("role", "")
        for item in control.get("tables", [])
    )
    and any(
        item.get("name") == "auth_hris_service_grant_drain_activities"
        and "gap-free positive activity_revision" in item.get("role", "")
        for item in control.get("tables", [])
    )
    and "All five tables" in control.get("databaseRules", [""])[0]
    and any(
        "SVC-PEP-APR-002, SVC-PEP-HRM-010 and SVC-AUT-HRM-013" in rule
        and "same Auth grant set" in rule
        and "Approval V59 persists the immutable APR-002 plus HRM-010 projection subset" in rule
        for rule in control.get("databaseRules", [])
    ),
    "quiesce table or coupled V59 binding database rule drift",
)
require(
    control.get("resolveEndpoint", {}).get("path")
    == "/internal/auth/v1/hris-service-grant-authority/resolve",
    "service authority endpoint drift",
)
bindings = control.get("resolveEndpoint", {}).get("callerBindings", [])
require(
    [item.get("bindingId") for item in bindings]
    == ["SVC-AUT-HRM-011", "SVC-AUT-HRM-012", "SVC-AUT-HRM-015", "SVC-AUT-HRM-016"],
    "service authority caller binding drift",
)
require(
    control.get("resolveEndpoint", {}).get("statuses")
    == [
        "ADMIT",
        "READINESS_OBSERVED",
        "REVOKE",
        "MISSING",
        "AMBIGUOUS",
        "STALE",
        "REVISION_MISMATCH",
        "QUIESCING",
        "UNAVAILABLE",
    ],
    "service authority status set or order drift",
)
resolve = control.get("resolveEndpoint", {})
bootstrap = resolve.get("bootstrapProof", {})
require(
    bootstrap.get("protectedHeaders", {}).get("requiredExactly")
    == ["alg", "typ", "kid"],
    "resolver protected-header closure drift",
)
required_resolver_claims = {
    "iss",
    "aud",
    "sub",
    "iat",
    "nbf",
    "exp",
    "jti",
    "requestNonce",
    "bindingId",
    "purpose",
    "method",
    "path",
    "tenantId",
    "requestingWorkloadId",
    "targetCallerWorkloadId",
    "targetOwnerWorkloadId",
    "targetBindingId",
    "targetPurpose",
    "resolutionMode",
    "signedTenantGrantRevision",
    "signedAuthorizationRevision",
    "correlationId",
    "requestBodySha256",
    "authn",
    "cnf",
}
require(
    set(bootstrap.get("closedClaims", [])) == required_resolver_claims,
    "resolver closed-claim set drift",
)
drain_fields = [
    "drainRootWorkItemId",
    "drainRootCreatedAt",
    "drainRootPayloadSha256",
    "drainContinuationKind",
    "drainContinuationEventId",
    "drainContinuationRevision",
    "drainContinuationPayloadSha256",
]
conditional_request_fields = resolve.get("conditionalRequestFields", {})
conditional_claims = bootstrap.get("conditionalClaims", {})
require(
    resolve.get("requiredRequestFields")
    == [
        "tenantId",
        "requestingWorkloadId",
        "targetCallerWorkloadId",
        "targetOwnerWorkloadId",
        "targetBindingId",
        "targetPurpose",
        "resolutionMode",
        "signedTenantGrantRevision",
        "signedAuthorizationRevision",
        "correlationId",
    ]
    and conditional_request_fields.get("DRAIN_EXISTING", {}).get("required") == drain_fields
    and conditional_request_fields.get("NEW_WORK", {}).get("mustBeAbsent") == drain_fields
    and conditional_request_fields.get("READINESS_OBSERVE", {}).get("mustBeAbsent") == drain_fields
    and conditional_request_fields.get("PROBE_MISSING", {}).get("mustBeAbsent") == drain_fields
    and conditional_claims.get("DRAIN_EXISTING", {}).get("requiredExactly") == drain_fields
    and conditional_claims.get("NEW_WORK", {}).get("mustBeAbsent") == drain_fields
    and conditional_claims.get("READINESS_OBSERVE", {}).get("mustBeAbsent") == drain_fields
    and conditional_claims.get("PROBE_MISSING", {}).get("mustBeAbsent") == drain_fields,
    "resolver mode fields or drain proof closure drift",
)
require(
    "before any service-grant row read" in bootstrap.get("replayRule", ""),
    "resolver replay reservation order drift",
)
require(
    resolve.get("drainAdmitAdditionalResponseFields")
    == [
        "quiesceFenceId",
        "quiesceRevision",
        "quiesceEffectiveAt",
        "attestingServiceRole",
        "drainActivityRevision",
        "drainActivityRecordedAt",
        "drainAuthorizationExpiresAt",
        "drainSettleUntil",
    ]
    and resolve.get("readinessObservedResponseFields")
    == [
        "status",
        "tenantId",
        "grantSetId",
        "tenantGrantRevision",
        "authorizationRevision",
        "callerWorkloadId",
        "ownerWorkloadId",
        "bindingId",
        "purpose",
        "quiesceFenceId",
        "quiesceRevision",
        "quiesceEffectiveAt",
        "attestingServiceRole",
        "drainActivityRevision",
        "drainQuietSince",
        "readinessEligibleAt",
        "readinessObservationSha256",
        "correlationId",
    ]
    and "drainAuthorizationExpiresAt exactly 30 seconds later"
    in resolve.get("modeRules", {}).get("DRAIN_EXISTING", "")
    and "returns READINESS_OBSERVED with no signing JWK or authority to perform work"
    in resolve.get("modeRules", {}).get("READINESS_OBSERVE", "")
    and "at or after readinessEligibleAt"
    in resolve.get("modeRules", {}).get("READINESS_OBSERVE", ""),
    "drain activity or readiness observation response contract drift",
)
auth_local = resolve.get("authLocalRoleOperations", {})
require(
    auth_local.get("transport") == "IN_PROCESS_NO_SELF_HTTP"
    and auth_local.get("service") == "HrisServiceGrantQuiesceService"
    and auth_local.get("roles")
    == [
        {
            "bindingId": "SVC-AUT-HRM-013",
            "purpose": "HRIS_SEPARATION_REQUESTER_IDENTITY_RESOLVE",
            "serviceWorkloadId": "dwp-auth-server",
            "attestingServiceRole": "OWNER",
        },
        {
            "bindingId": "SVC-AUT-HRM-014",
            "purpose": "HRIS_SEPARATION_IDENTITY_TASK_DISPATCH",
            "serviceWorkloadId": "dwp-auth-server",
            "attestingServiceRole": "OWNER",
        },
        {
            "bindingId": "SVC-PEP-HRM-008",
            "purpose": "HRIS_SEPARATION_IDENTITY_TASK_RECEIPT",
            "serviceWorkloadId": "dwp-auth-server",
            "attestingServiceRole": "CALLER",
        },
    ]
    and "same typed projection" in auth_local.get("rule", "")
    and "identical observation digest" in auth_local.get("rule", "")
    and "HrisServiceGrantAuthorityOwnerCredentialProvider for SVC-AUT-HRM-013"
    in auth_local.get("rule", "")
    and "Local current-ledger access cannot bypass" in auth_local.get("rule", "")
    and "same tenant, fence and role activity-stream lock order"
    in auth_local.get("raceRule", "")
    and "before readinessEligibleAt" in auth_local.get("raceRule", ""),
    "Auth-local identity-task drain or readiness parity drift",
)
require(
    "X-DWP-Workload-Proof" in bootstrap.get("carrier", "")
    and "Authorization" in bootstrap.get("carrier", ""),
    "resolver proof carrier closure missing",
)
require(
    "browser" in resolve.get("disclosureRule", "").lower()
    and "opaque 403" in resolve.get("disclosureRule", "")
    and "QUIESCING" in resolve.get("disclosureRule", ""),
    "typed denial disclosure boundary drift",
)
require(
    resolve.get("conditionalRequestFields", {}).get("PROBE_MISSING", {}).get("revisionRule")
    == "Both signed revisions are the exact integer sentinel 0 and no atomicGrantCredentialLease or business key is read."
    and "always returns only typed MISSING" in resolve.get("modeRules", {}).get("PROBE_MISSING", "")
    and "without reading any grant row" in resolve.get("modeRules", {}).get("PROBE_MISSING", "")
    and "only no-lease path" in resolve.get("callerScopeRule", "")
    and "always returns opaque MISSING" in resolve.get("callerScopeRule", ""),
    "resolver mode or opaque missing-probe drift",
)
require(
    "REVOKE_MISSING_AMBIGUOUS_STALE_REVISION_MISMATCH_QUIESCING"
    in control.get("consumerRule", {}).get("statusMapping", {}),
    "QUIESCING HRM ingress status mapping drift",
)
projection = control.get("consumerRule", {}).get("approvalProjectionComparison", {})
projection_integrity = projection.get("nonComparableIntegrityFields", {})
require(
    projection.get("commonExactComparisons")
    == [
        "tenant_id=tenantId",
        "grant_id=grantSetId",
        "tenant_grant_revision=tenantGrantRevision",
        "authorization_revision=authorizationRevision",
        "decision=decision",
        "supersedes_grant_id=supersedesGrantSetId",
    ]
    and projection.get("apr002ExactComparisons")
    == [
        "request_binding_id=bindingId",
        "request_purpose_code=purpose",
        "people_spiffe_id=callerSpiffeId",
        "people_signing_key_id=callerSigningKeyId",
        "approval_spiffe_id=ownerSpiffeId",
        "approval_signing_key_id=ownerSigningKeyId",
    ]
    and projection.get("hrm010ExactComparisons")
    == [
        "callback_binding_id=bindingId",
        "callback_purpose_code=purpose",
        "approval_spiffe_id=callerSpiffeId",
        "approval_signing_key_id=callerSigningKeyId",
        "people_spiffe_id=ownerSpiffeId",
        "people_signing_key_id=ownerSigningKeyId",
    ]
    and "both SVC-PEP-APR-002 and SVC-PEP-HRM-010"
    in projection.get("selectionRule", "")
    and "same local row and Auth snapshot" in projection.get("atomicRule", "")
    and "SVC-AUT-HRM-013 remains Auth-only" in projection.get("atomicRule", ""),
    "Approval V59 to Auth exact projection comparison drift",
)
require(
    projection_integrity.get("approvalLocalOnly")
    == ["grant_revision", "grant_digest", "recorded_at"]
    and projection_integrity.get("authOnly")
    == [
        "grantRevision",
        "grantDigest",
        "recordedAt",
        "rotationReadinessDigest",
        "callerSigningPublicJwk",
        "ownerSigningPublicJwk",
        "SVC-AUT-HRM-013 member",
    ]
    and "never compared, copied, substituted or digest-aliased across stores"
    in projection_integrity.get("rule", "")
    and "V59 grant_digest must not equal or stand in for the Auth grantDigest or rotationReadinessDigest"
    in projection_integrity.get("rule", ""),
    "Approval-local and Auth-only projection integrity boundary drift",
)

requester = control.get("requesterIdentityEndpoint", {})
require(requester.get("bindingId") == "SVC-AUT-HRM-013", "requester binding drift")
require(
    requester.get("path")
    == "/internal/auth/v1/hris-separation-requester-authority/resolve",
    "requester authority path drift",
)
require(
    requester.get("requestFields")
    == ["tenantId", "approvalRequestId", "requestedByActorPublicId", "correlationId"],
    "requester authority request closure drift",
)
require(
    requester.get("admitResponseFields")
    == [
        "status",
        "requesterUserId",
        "requesterPersonPublicId",
        "requesterAccessRevision",
        "requesterVersion",
        "tenantGrantRevision",
        "authorizationRevision",
        "correlationId",
    ],
    "requester authority response closure drift",
)
require(
    "com_users.person_public_id" in requester.get("resolutionRule", "")
    and "ACTIVE TENANT-plane" in requester.get("resolutionRule", "")
    and "exact enclosing APR-002 root identity" in requester.get("resolutionRule", "")
    and "Auth-local OWNER drain authorization" in requester.get("resolutionRule", ""),
    "requester exact identity rule drift",
)
require(
    "legacy X-DWP-Identity-Sync-Token" in requester.get("exposureRule", "")
    and "fuzzy search" in requester.get("exposureRule", ""),
    "requester legacy or fuzzy fallback prohibition missing",
)
require(
    "SVC-AUT-HRM-012 leaf-certificate-signed resolver proof"
    in requester.get("bootstrapResolutionRule", "")
    and "same NEW_WORK or DRAIN_EXISTING mode" in requester.get("bootstrapResolutionRule", "")
    and "Approval caller and Auth-local OWNER operations each append their role activity"
    in requester.get("bootstrapResolutionRule", "")
    and "before com_users access" in requester.get("bootstrapResolutionRule", ""),
    "requester authority bootstrap or recheck order drift",
)
require(
    "approvalRequestId" in requester.get("proofRule", "")
    and "grantUseMode" in requester.get("proofRule", "")
    and "NEW_WORK forbids all drain claims" in requester.get("proofRule", "")
    and "DRAIN_EXISTING requires DEPENDENT_READ" in requester.get("proofRule", "")
    and "drainContinuationRevision is 0" in requester.get("proofRule", "")
    and "proof exp is no later than both role drain authorization expiries"
    in requester.get("proofRule", ""),
    "requester dependent-read drain proof closure drift",
)
require(
    requester.get("maximumRequestBytes") == 8192
    and requester.get("maximumResponseBytes") == 16384
    and requester.get("queryAllowed") is False
    and requester.get("cachePolicy") == "NO_STORE",
    "requester HTTP envelope limits drift",
)

transport = decisions.get("transportAndCredentialBoundary", {})
require("TLSv1.3" in transport.get("inboundTermination", ""), "TLS1.3 termination missing")
require(
    any("X-Forwarded-Client-Cert" in rule for rule in transport.get("certificateValidation", [])),
    "forwarded certificate rejection missing",
)
require(
    any("cnf.x5t#S256" in rule for rule in transport.get("certificateValidation", [])),
    "certificate confirmation rule missing",
)
peer = transport.get("outboundPeerAuthentication", {})
require(
    peer.get("bindingOwners") == EXPECTED_BINDING_OWNERS,
    "outbound binding-owner SPIFFE map drift",
)
require(
    any("DNS SAN" in rule and "SNI" in rule for rule in peer.get("rules", []))
    and any("redirect" in rule.lower() for rule in peer.get("rules", []))
    and any("before any response" in rule for rule in peer.get("rules", [])),
    "outbound peer TLS, endpoint or redirect boundary missing",
)
envelope = transport.get("internalRequestEnvelope", {})
require(
    envelope.get("appliesToBindings")
    == [
        "SVC-AUT-HRM-011",
        "SVC-AUT-HRM-012",
        "SVC-AUT-HRM-013",
        "SVC-AUT-HRM-015",
        "SVC-AUT-HRM-016",
        "SVC-PEP-TIM-004",
        "SVC-PEP-PAY-002",
        "SVC-AUT-HRM-014",
    ]
    and envelope.get("queryAllowed") is False
    and envelope.get("maximumAggregateApplicationHeaderBytes") == 32768
    and envelope.get("maximumSingleApplicationHeaderBytes") == 16384
    and envelope.get("allowedApplicationHeaderNames")
    == [
        "Content-Type",
        "Accept",
        "X-DWP-Service-Identity",
        "X-DWP-Workload-Proof",
        "X-Correlation-ID",
    ],
    "new internal request envelope scope or bounds drift",
)
require(
    envelope.get("requiredApplicationHeaders")
    == {
        "Content-Type": "exactly one application/json without parameters",
        "Accept": "exactly one application/json",
        "X-DWP-Service-Identity": "exactly one exact caller workload ID",
        "X-DWP-Workload-Proof": "exactly one compact RS256 JWS",
        "X-Correlation-ID": "exactly one canonical lowercase UUID equal to body and proof",
    }
    and {
        "Authorization",
        "Cookie",
        "Forwarded",
        "X-Forwarded-*",
        "any alternate proof header",
        "any unregistered X-DWP-* header",
    }
    <= set(envelope.get("forbiddenApplicationHeaders", []))
    and any("Duplicate" in rule and "overflow" in rule for rule in envelope.get("rules", []))
    and any(
        "Only the five allowed application-header names" in rule
        and "X-HTTP-Method-Override" in rule
        and "X-Original-URL" in rule
        and "X-Rewrite-URL" in rule
        for rule in envelope.get("rules", [])
    )
    and any("Cache-Control: no-store" in rule for rule in envelope.get("rules", [])),
    "new internal request header allowlist, denylist or no-store rule drift",
)
compatibility = transport.get("sealedPredecessorCompatibility", {})
require(
    "X-DWP-Workload-Proof" in compatibility.get("compositionLabelRule", "")
    and "not OAuth2" in compatibility.get("compositionLabelRule", "")
    and "decode only canonical positive tenantId" in compatibility.get("verificationOrder", "")
    and "SVC-AUT-HRM-013 requester identity" in compatibility.get("verificationOrder", "")
    and "derive the requesting workload from the authenticated certificate"
    in compatibility.get("verificationOrder", "")
    and "target owner tuple from the sealed service-binding register"
    in compatibility.get("verificationOrder", "")
    and "sealed Auth-local owner equivalent" in compatibility.get("verificationOrder", "")
    and "grantUseMode" in compatibility.get("verificationOrder", "")
    and "seven drain selectors" in compatibility.get("verificationOrder", "")
    and "returned current or drain-only JWK" in compatibility.get("verificationOrder", "")
    and "exact tenantId and selector equality" in compatibility.get("verificationOrder", "")
    and "post-signature unchanged-current-authority recheck"
    in compatibility.get("verificationOrder", "")
    and "returned drain-activity recheck" in compatibility.get("verificationOrder", "")
    and "not initial signing-key discovery"
    in compatibility.get("guardOrderInterpretation", "")
    and "tenantId is canonical and positive but grants no authority"
    in compatibility.get("untrustedSelectorRule", "")
    and "conditional drain-selector decoding" in compatibility.get("untrustedSelectorRule", "")
    and "sealed-register target tuple override"
    in compatibility.get("untrustedSelectorRule", "")
    and "never authenticates" in compatibility.get("untrustedSelectorRule", ""),
    "sealed predecessor key-discovery compatibility drift",
)
for values in transport.get("defaultOffProperties", {}).values():
    require(all(value.endswith("=false") for value in values), "runtime property is not default OFF")
credentials = transport.get("outboundCredentials", {})
require(
    any("resolverProofSigner" in value for value in credentials.get("requiredMaterial", []))
    and any("businessProofSigner" in value for value in credentials.get("requiredMaterial", []))
    and credentials.get("providerContracts", {}).get("authControlPlaneOwner")
    == "HrisServiceGrantAuthorityOwnerCredentialProvider",
    "resolver and business proof signers are not separated",
)
lease = credentials.get("atomicGrantCredentialLease", {})
require(
    any("atomicGrantCredentialLease" in value for value in credentials.get("requiredMaterial", []))
    and len(lease.get("requiredFields", [])) == 21
    and "businessPrivateKeyHandle" in lease.get("requiredFields", [])
    and "businessKeyVersionId" in lease.get("requiredFields", [])
    and "businessPublicJwkThumbprint" in lease.get("requiredFields", [])
    and "tenantGrantRevision" in lease.get("requiredFields", [])
    and "authorizationRevision" in lease.get("requiredFields", []),
    "atomic grant credential lease field closure drift",
)
require(
    "same hash-bound secret version" in lease.get("bootstrapSourceRule", "")
    and "PROBE_MISSING 0/0 sentinel" in lease.get("bootstrapSourceRule", "")
    and "This gate provisions no lease or secret" in lease.get("bootstrapSourceRule", "")
    and "NEW_WORK, DRAIN_EXISTING and READINESS_OBSERVE" in lease.get("resolverRequestRule", "")
    and "only from the active or drain-only lease" in lease.get("resolverRequestRule", "")
    and "READINESS_OBSERVED returns no JWK and no work authority"
    in lease.get("resolverRequestRule", "")
    and "leaves every lease unchanged" in lease.get("resolverRequestRule", "")
    and "every required field except leaseDigest and the opaque businessPrivateKeyHandle"
    in lease.get("digestAndKeyAttestationRule", "")
    and "RFC 7638 SHA-256 thumbprint" in lease.get("digestAndKeyAttestationRule", "")
    and "kid equality alone is insufficient" in lease.get("digestAndKeyAttestationRule", "")
    and "fresh verifier challenge" in lease.get("digestAndKeyAttestationRule", "")
    and "atomically swaps the entire descriptor and key handle" in lease.get("rotationRule", "")
    and "may never mix" in lease.get("rotationRule", "")
    and "one immutable lease snapshot" in lease.get("concurrencyRule", ""),
    "atomic grant lease bootstrap, resolver equality or rotation rule drift",
)
require(
    any("Cross-use" in rule for rule in credentials.get("rules", [])),
    "credential cross-use fail-closed rule missing",
)

selector = decisions.get("approvalWorkflowAndFormSelector", {})
require(selector.get("workflowKey") == "HRIS_SEPARATION_TASK_WAIVER", "workflow key drift")
require(selector.get("formKey") == "HRIS_SEPARATION_TASK_WAIVER_FORM", "form key drift")
require(selector.get("managementResourceSetKey") == "RS_APPROVALS", "resource set drift")
require(
    any("effective_from" in rule and "effective_to" in rule for rule in selector.get("selection", [])),
    "form-workflow binding effective window missing",
)
require(
    "SVC-AUT-HRM-013" in selector.get("requesterResolution", "")
    and "ApprovalIdentityDirectory" in selector.get("requesterResolution", "")
    and "forbidden" in selector.get("requesterResolution", ""),
    "requester exact authority or fallback prohibition drift",
)
require(
    "grantId" in selector.get("apr002ReplayRule", "")
    and "not part of persisted replay identity" in selector.get("apr002ReplayRule", ""),
    "APR-002 rotation-safe replay identity drift",
)

step_up = decisions.get("approvalStepUpAndTerminalRouting", {})
route = step_up.get("dedicatedCommandRoute", {})
require(
    route.get("routeContractKey")
    == "route.approvals.work.hris-separation-waiver-task-approve.action",
    "dedicated step-up route drift",
)
require(route.get("riskTier") == "HIGH", "HRM-013 task decision is not HIGH risk")
require(route.get("activationPolicy") == "STEPUP-MGMT-HIGH-V1", "step-up policy drift")
require(
    route.get("scopeResolver") == "DECIDABLE_TASK_SELF_APPROVAL_SOD",
    "dedicated approve scope resolver drift",
)
require(
    route.get("expectedObjectVersionName") == "X-DWP-Expected-Object-Version"
    and route.get("requiredCommandHeaders")
    == [
        "Idempotency-Key",
        "X-Correlation-ID",
        "X-DWP-Step-Up-Challenge",
        "X-DWP-Expected-Decision-Revision",
        "X-DWP-Expected-Object-Version",
    ],
    "dedicated approve header contract drift",
)
require(
    route.get("requestSchema") == "ApprovalDtos.DecisionRequest"
    and "Command decision equals APPROVE" in route.get("bodyRule", "")
    and "quorum is mandatory" in route.get("bodyRule", "")
    and "expectedRequestVersion" in route.get("bodyRule", ""),
    "dedicated approve body contract drift",
)
require(
    "first-class CAST route" in route.get("workflowRuntimeAuthority", "")
    and "may never be rewritten" in route.get("workflowRuntimeAuthority", ""),
    "dedicated route is not closed through workflow runtime",
)
require(
    step_up.get("authRelease", {}).get("productBundleVersion") == 62,
    "Auth product bundle version drift",
)
auth_release = step_up.get("authRelease", {})
require(
    auth_release.get("migration") == "V271__create_hris_service_grant_authority.sql"
    and "only the declared deterministic product-surfaces v62"
    in auth_release.get("generationLaneRule", "")
    and "no feature-policy authority" in auth_release.get("generationLaneRule", "")
    and auth_release.get("v271SeedRelease")
    == {
        "bundleKey": "product-surfaces",
        "version": 62,
        "checksumSource": "Exact nonblank lowercase checksum field inside product-surfaces-v1.bundle-v62.generated.json, whose bytes and file SHA-256 are pinned by the generation receipt.",
        "authSeedArtifact": "product-surfaces-v1.bundle-v62.generated.json",
        "intendedBundleStatus": "DRAFT",
        "automaticImportEnabled": False,
    },
    "Auth v62 generation or seed-release lineage drift",
)
require(
    auth_release.get("v271FeaturePolicySuccessor")
    == {
        "featureKey": "HRIS_HRM_EXIT_RETURN_WORKBENCH",
        "policyVersion": 2,
        "productKey": "hcm",
        "appResourceKey": "APP.HCM",
        "minimumBundleVersion": 62,
        "baselineState": "OFF",
        "ownerKey": "HRM",
    }
    and len(auth_release.get("v271RouteBindingSnapshot", [])) == 3
    and all(
        item.get("productKey") == "hcm" and item.get("appResourceKey") == "APP.HCM"
        for item in auth_release.get("v271RouteBindingSnapshot", [])
    )
    and "not inserted into the HCM feature-policy tables"
    in auth_release.get("dedicatedApprovalRouteBoundary", "")
    and "exact three-route V270 HCM snapshot" in auth_release.get("v271Rule", ""),
    "Auth V271 baseline-OFF policy or route snapshot drift",
)
require(
    step_up.get("rejectionCommandRoute", {}).get("allowedHrm013CommandDecision")
    == "REJECT_ONLY"
    and step_up.get("rejectionCommandRoute", {}).get("terminalOutcome") == "REJECTED",
    "HRM-013 rejection route drift",
)
mapping = step_up.get("downstreamEvidenceMapping", {})
require(mapping.get("stepUpEvidenceAudience") == "dwp-people-server", "evidence audience drift")
require(
    mapping.get("stepUpEvidencePurpose") == "HRIS_SEPARATION_TASK_WAIVER_DECISION",
    "evidence purpose drift",
)
require(
    step_up.get("terminalSink", {}).get("singleBeanRule")
    == "Exactly one ApprovalTerminalDecisionSink bean exists.",
    "single terminal sink invariant drift",
)

people = decisions.get("peopleOwnerRuntimeBoundary", {})
require("People V62" in people.get("migrationRule", ""), "People V62 prohibition missing")
require(
    "callback-only" in people.get("atomicPacketRule", "").lower(),
    "owner plus callback atomic packet rule missing",
)
dispatch = people.get("taskDispatchContracts", {})
dispatch_bindings = dispatch.get("bindings", [])
require(
    [item.get("bindingId") for item in dispatch_bindings]
    == ["SVC-PEP-TIM-004", "SVC-PEP-PAY-002", "SVC-AUT-HRM-014"],
    "task-dispatch binding set or order drift",
)
require(
    [item.get("taskType") for item in dispatch_bindings]
    == ["TIME_FINALIZATION", "PAYROLL_SETTLEMENT", "IDENTITY_ACCESS_REVOCATION"],
    "task-dispatch type mapping drift",
)
require(
    [item.get("authorityResolverBindingId") for item in dispatch_bindings]
    == ["SVC-AUT-HRM-015", "SVC-AUT-HRM-016", "LOCAL_AUTH_LEDGER"],
    "task-owner authority resolver mapping drift",
)
require(
    [item.get("callbackBindingId") for item in dispatch_bindings]
    == ["SVC-PEP-HRM-008", "SVC-PEP-HRM-008", "SVC-PEP-HRM-008"]
    and [item.get("callbackPurpose") for item in dispatch_bindings]
    == [
        "HRIS_SEPARATION_TIME_TASK_RECEIPT",
        "HRIS_SEPARATION_PAYROLL_TASK_RECEIPT",
        "HRIS_SEPARATION_IDENTITY_TASK_RECEIPT",
    ],
    "task-dispatch to callback binding mapping drift",
)
require(
    "sys_people_outbox_events" in dispatch.get("outboxRule", "")
    and "without People V62" in dispatch.get("outboxRule", "")
    and "RFC 4122 UUIDv5" in dispatch.get("outboxRule", "")
    and "no trailing LF" in dispatch.get("outboxRule", ""),
    "task-dispatch V61 outbox closure drift",
)
require(
    dispatch.get("dispatchIdentityGoldenVector")
    == {
        "namespace": "089d9495-71cf-55aa-96e5-5cbd1682e5bb",
        "tenantId": 1,
        "taskPublicId": "00000000-0000-0000-0000-000000000001",
        "taskVersion": 1,
        "bindingId": "SVC-PEP-TIM-004",
        "nameUtf8Escaped": "1\n00000000-0000-0000-0000-000000000001\n1\nSVC-PEP-TIM-004",
        "dispatchEventId": "9ddb8198-a9c2-5493-a3a6-1c19fa9a327a",
    },
    "task-dispatch UUIDv5 golden vector drift",
)
require(
    "ppl_separation_callback_authorities" in dispatch.get("preSendIntegrityRule", "")
    and "immediately before every network send" in dispatch.get("preSendIntegrityRule", "")
    and "both the outbound dispatch grant" in dispatch.get("preSendIntegrityRule", "")
    and "SVC-PEP-HRM-008 callback grant" in dispatch.get("preSendIntegrityRule", "")
    and "quarantined and dead-lettered" in dispatch.get("preSendIntegrityRule", ""),
    "generic outbox integrity fence drift",
)
require(
    "one tenant transaction" in dispatch.get("atomicRule", "")
    and "current SVC-PEP-HRM-008 callback grant" in dispatch.get("atomicRule", "")
    and "never the separate task-dispatch grant revisions" in dispatch.get("atomicRule", "")
    and "may never create" in dispatch.get("atomicRule", ""),
    "task-dispatch callback-authority atomicity drift",
)
require(
    "uses SVC-AUT-HRM-011" in dispatch.get("callbackAuthorityResolutionRule", "")
    and "tenantGrantRevision and authorizationRevision"
    in dispatch.get("callbackAuthorityResolutionRule", "")
    and "may never be copied" in dispatch.get("callbackAuthorityResolutionRule", "")
    and "creates neither task activation, outbox nor callback fence"
    in dispatch.get("callbackAuthorityResolutionRule", ""),
    "distinct callback-grant resolution and freeze rule drift",
)
require(
    "uses SVC-AUT-HRM-011" in dispatch.get("dispatchAuthorityResolutionRule", "")
    and "independent leaf-certificate-signed resolver proof"
    in dispatch.get("dispatchAuthorityResolutionRule", "")
    and "rechecked immediately before send"
    in dispatch.get("dispatchAuthorityResolutionRule", "")
    and "never inferred from the callback fence"
    in dispatch.get("dispatchAuthorityResolutionRule", ""),
    "outbound dispatch grant bootstrap or recheck drift",
)
require(
    "Time uses SVC-AUT-HRM-015" in dispatch.get("ownerCallbackSendAuthorityRule", "")
    and "Payroll uses SVC-AUT-HRM-016" in dispatch.get("ownerCallbackSendAuthorityRule", "")
    and "Auth reads that exact tuple from its local current ledger"
    in dispatch.get("ownerCallbackSendAuthorityRule", "")
    and "immediately before send" in dispatch.get("ownerCallbackSendAuthorityRule", "")
    and "Dispatch-binding revisions" in dispatch.get("ownerCallbackSendAuthorityRule", "")
    and "emits no callback" in dispatch.get("ownerCallbackSendAuthorityRule", ""),
    "owner HRM-008 callback send authority drift",
)
require(
    dispatch.get("admissionReceipt", {}).get("status") == 202
    and "byte-identical" in dispatch.get("admissionReceipt", {}).get("consumerIdentity", ""),
    "task-dispatch admission receipt drift",
)
receipt = dispatch.get("admissionReceipt", {})
require(
    "receiptSha256 itself is excluded" in receipt.get("receiptDigestRule", "")
    and "responseBodySha256" in receipt.get("receiptDigestRule", ""),
    "admission receipt digest preimage drift",
)
require(
    "X-DWP-Workload-Receipt-Proof" in receipt.get("proofCarrier", "")
    and receipt.get("proofProtectedHeaders", {}).get("requiredExactly")
    == ["alg", "typ", "kid"]
    and len(receipt.get("proofClaims", [])) == 20
    and "at most 30 seconds" in receipt.get("proofRule", ""),
    "admission receipt proof profile drift",
)
require(
    "at most 10 attempts" in dispatch.get("deliveryRule", "")
    and "RESULT_UNKNOWN" in dispatch.get("deliveryRule", "")
    and "never invents" in dispatch.get("deliveryRule", ""),
    "task-dispatch bounded ambiguity rule drift",
)
require(
    "initial Auth resolver lookup" in people.get("concurrencyCorrections", [""])[0]
    and "complete business-proof validation" in people.get("concurrencyCorrections", [""])[0]
    and "post-signature unchanged-current-authority recheck"
    in people.get("concurrencyCorrections", [""])[0]
    and "callback identity advisory lock" in people.get("concurrencyCorrections", [""])[0]
    and "before any protocol fence or aggregate read"
    in people.get("concurrencyCorrections", [""])[0],
    "callback proof, authority, replay and identity-lock order drift",
)

rotation = control.get("grantRotationContinuity", {})
require(
    "every old-grant Approval request" in rotation.get("plannedCutoverRule", "")
    and "exact durable QUIESCING fence" in rotation.get("plannedCutoverRule", "")
    and "SVC-PEP-HRM-008 tuple" in rotation.get("plannedCutoverRule", "")
    and "SVC-PEP-APR-002 plus SVC-PEP-HRM-010 plus SVC-AUT-HRM-013"
    in rotation.get("plannedCutoverRule", "")
    and "same quiesceEffectiveAt" in rotation.get("plannedCutoverRule", "")
    and "appends CUTOVER for every group member in the same transaction"
    in rotation.get("plannedCutoverRule", ""),
    "planned grant rotation drain rule drift",
)
quiesce = rotation.get("quiesceProtocol", {})
require(
    quiesce.get("maximumNewWorkTransactionSeconds") == 30
    and quiesce.get("maximumDrainAuthorizationSeconds") == 30
    and quiesce.get("quiesceGraceSeconds") == 65
    and "rechecks it immediately before commit" in quiesce.get("fenceRule", "")
    and "every NEW ROOT producer and owner admission transaction"
    in quiesce.get("fenceRule", "")
    and "sole post-fence creation exception" in quiesce.get("fenceRule", "")
    and "DRAIN_EXISTING" in quiesce.get("drainRule", "")
    and "no new root request" in quiesce.get("drainRule", "")
    and "authoritative database transaction timestamp" in quiesce.get("receiptRule", "")
    and "65-second quiet interval after the latest activity" in quiesce.get("receiptRule", "")
    and "30-second drain authorization" in quiesce.get("receiptRule", "")
    and "observedAt cannot be future-dated" in quiesce.get("receiptRule", "")
    and "task-dispatch-to-HRM-008 tuple mapping" in quiesce.get("pairedTupleClosureRule", "")
    and "readiness receipts apply only to a planned successor ADMIT"
    in quiesce.get("pairedTupleClosureRule", "")
    and "no unexpired drain authorization, drain or NEW_WORK window"
    in quiesce.get("commitRule", "")
    and "ABORTED successors" in quiesce.get("abortRule", ""),
    "durable quiesce, grace, pair closure or atomic cutover drift",
)
waiver_group = quiesce.get("waiverDependencyGroupClosureRule", "")
require(
    "SVC-PEP-APR-002, SVC-PEP-HRM-010 and SVC-AUT-HRM-013" in waiver_group
    and "one symmetric indivisible waiver execution dependency group" in waiver_group
    and "one common effectiveAt" in waiver_group
    and "both-role drain activity and readiness coverage" in waiver_group
    and "CUTOVER, ABORTED and emergency REVOKE" in waiver_group
    and "Approval V59 projection remains the first two-member subset" in waiver_group
    and "partial group command fails" in waiver_group,
    "waiver dependency group closure drift",
)
terminal_drain = quiesce.get("terminalDrainContinuationRule", {})
terminal_mappings = terminal_drain.get("terminalChildMappings", [])
root_projections = terminal_drain.get("rootProjectionRegistry", [])
require(
    terminal_drain.get("kinds") == ["ROOT_DELIVERY", "DEPENDENT_READ", "TERMINAL_CHILD"]
    and "drainContinuationRevision is the exact integer 0"
    in terminal_drain.get("rootDeliveryRule", "")
    and "owner may atomically and idempotently create only the matching first native request or inbox projection"
    in terminal_drain.get("rootDeliveryRule", "")
    and root_projections
    == [
        {
            "bindings": ["SVC-PEP-APR-002"],
            "schema": "SeparationWaiverApprovalRequestV1",
            "workItemIdField": "approvalRequestId",
            "originCreatedAtField": "requestedAt",
            "payloadDigestField": "payloadSha256",
        },
        {
            "bindings": ["SVC-PEP-TIM-004", "SVC-PEP-PAY-002", "SVC-AUT-HRM-014"],
            "schema": "Hrm013TaskDispatchV1",
            "workItemIdField": "dispatchEventId",
            "originCreatedAtField": "dispatchedAt",
            "payloadDigestField": "payloadSha256",
        },
        {
            "bindings": ["SVC-PEP-HRM-008", "SVC-PEP-HRM-009", "SVC-PEP-HRM-010"],
            "schemas": [
                "SeparationTaskReceiptV2",
                "SeparationReconciliationResultV1",
                "SeparationWaiverDecisionV2",
            ],
            "workItemIdField": "callbackEventId",
            "originCreatedAtField": "occurredAt",
            "payloadDigestField": "payloadSha256",
        },
    ]
    and terminal_mappings
    == [
        {
            "rootBindingId": "SVC-PEP-APR-002",
            "childBindingId": "SVC-PEP-HRM-010",
            "childType": "APPROVAL_TERMINAL_DECISION_OUTBOX",
            "rootProjection": "approvalRequestId|requestedAt|payloadSha256",
            "childProjection": "callbackEventId|ownerRevision=decisionRevision=1|payloadSha256",
        },
        {
            "rootBindingId": "SVC-PEP-TIM-004",
            "childBindingId": "SVC-PEP-HRM-008",
            "childPurpose": "HRIS_SEPARATION_TIME_TASK_RECEIPT",
            "childType": "OWNER_TERMINAL_CALLBACK_OUTBOX",
            "rootProjection": "dispatchEventId|dispatchedAt|payloadSha256",
            "childProjection": "callbackEventId|ownerRevision|payloadSha256",
        },
        {
            "rootBindingId": "SVC-PEP-PAY-002",
            "childBindingId": "SVC-PEP-HRM-008",
            "childPurpose": "HRIS_SEPARATION_PAYROLL_TASK_RECEIPT",
            "childType": "OWNER_TERMINAL_CALLBACK_OUTBOX",
            "rootProjection": "dispatchEventId|dispatchedAt|payloadSha256",
            "childProjection": "callbackEventId|ownerRevision|payloadSha256",
        },
        {
            "rootBindingId": "SVC-AUT-HRM-014",
            "childBindingId": "SVC-PEP-HRM-008",
            "childPurpose": "HRIS_SEPARATION_IDENTITY_TASK_RECEIPT",
            "childType": "OWNER_TERMINAL_CALLBACK_OUTBOX",
            "rootProjection": "dispatchEventId|dispatchedAt|payloadSha256",
            "childProjection": "callbackEventId|ownerRevision|payloadSha256",
        },
    ]
    and terminal_drain.get("dependentReadMappings")
    == [
        {
            "rootBindingId": "SVC-PEP-APR-002",
            "dependentBindingId": "SVC-AUT-HRM-013",
            "dependentPurpose": "HRIS_SEPARATION_REQUESTER_IDENTITY_RESOLVE",
            "rootProjection": "approvalRequestId|requestedAt|payloadSha256",
            "continuationProjection": "approvalRequestId|revision=0|payloadSha256",
            "sideEffect": "READ_ONLY_EXACT_REQUESTER_NO_IDENTITY_OR_BUSINESS_ROW_CREATE",
        }
    ]
    and "Auth's local OWNER operation" in terminal_drain.get("dependentReadRule", "")
    and "before reading com_users" in terminal_drain.get("dependentReadRule", "")
    and "neither side may cache the result as authority"
    in terminal_drain.get("dependentReadRule", "")
    and "grantUseMode" in terminal_drain.get("businessProofCarrierRule", "")
    and "SVC-AUT-HRM-013 requester-identity" in terminal_drain.get("businessProofCarrierRule", "")
    and "same seven drainRoot and drainContinuation claims"
    in terminal_drain.get("businessProofCarrierRule", "")
    and "no new HTTP header" in terminal_drain.get("businessProofCarrierRule", "")
    and "No protocol or business row is read before complete business-proof verification"
    in terminal_drain.get("businessProofCarrierRule", "")
    and "same serializable transaction inserts exactly one child outbox"
    in terminal_drain.get("eligibilityRule", "")
    and "wrong mapping" in terminal_drain.get("eligibilityRule", "")
    and "callback_event_id" in terminal_drain.get("v59CompatibilityRule", "")
    and "Exactly zero or one terminal child" in terminal_drain.get("cardinalityRule", "")
    and "different lineage, mapping, purpose, revision or digest"
    in terminal_drain.get("collisionRule", "")
    and "quarantined and fails closed" in terminal_drain.get("collisionRule", ""),
    "terminal drain continuation mapping, atomicity or V59 compatibility drift",
)
terminal_vector = terminal_drain.get("goldenVector", {})
terminal_name = (
    f"{terminal_vector.get('tenantId')}\n"
    f"{terminal_vector.get('drainRootWorkItemId')}\n"
    f"{terminal_vector.get('drainContinuationRevision')}\n"
    f"{terminal_vector.get('childBindingId')}\n"
    f"{terminal_vector.get('drainContinuationKind')}"
)
try:
    terminal_event_id = str(
        uuid.uuid5(uuid.UUID(terminal_vector.get("namespace", "")), terminal_name)
    )
except (ValueError, AttributeError, TypeError):
    terminal_event_id = "INVALID"
require(
    terminal_vector.get("namespace") == "8ca8c32b-c8f7-5ab4-a9a5-18166dc32128"
    and terminal_vector.get("nameUtf8Escaped") == terminal_name
    and terminal_vector.get("drainContinuationEventId")
    == "87614dd7-b22b-5e02-9cdd-21720c767533"
    and terminal_event_id == terminal_vector.get("drainContinuationEventId"),
    "terminal drain continuation UUIDv5 golden vector drift",
)
require(
    "gap-free append-only activity stream" in quiesce.get("drainActivityRule", "")
    and "Every successful DRAIN_EXISTING resolution" in quiesce.get("drainActivityRule", "")
    and "receiver calls" in quiesce.get("drainActivityRule", "")
    and "DEPENDENT_READ caller and owner operations" in quiesce.get("drainActivityRule", "")
    and "drainAuthorizationExpiresAt is exactly 30 seconds later"
    in quiesce.get("drainActivityRule", "")
    and "drainSettleUntil is exactly 65 seconds later"
    in quiesce.get("drainActivityRule", "")
    and "Before beginning its local repeatable-read zero scan"
    in quiesce.get("readinessObservationRule", "")
    and "three Auth-local roles invoke the sealed in-process equivalent"
    in quiesce.get("readinessObservationRule", "")
    and "readinessEligibleAt is exactly 65 seconds later"
    in quiesce.get("readinessObservationRule", "")
    and "readinessObservationSha256 is lowercase SHA-256 of RFC 8785 canonical JSON"
    in quiesce.get("readinessObservationRule", "")
    and "Any later DRAIN_EXISTING append" in quiesce.get("readinessObservationRule", "")
    and "locks every fence and role activity stream"
    in quiesce.get("readinessObservationRule", "")
    and "observedDrainActivityRevision" in quiesce.get("receiptRule", "")
    and "drainQuietSince" in quiesce.get("receiptRule", "")
    and "readinessEligibleAt" in quiesce.get("receiptRule", "")
    and "Any post-observation drain invalidates that receipt" in quiesce.get("receiptRule", "")
    and "every CALLER and OWNER drain activity stream" in quiesce.get("commitRule", ""),
    "drain activity revision or stale readiness invalidation drift",
)
require(
    "registered binding tuple" in rotation.get("readinessReceiptRule", "")
    and "callerWorkloadId" in rotation.get("readinessReceiptRule", "")
    and "ownerWorkloadId" in rotation.get("readinessReceiptRule", "")
    and "bindingPurpose" in rotation.get("readinessReceiptRule", "")
    and "CALLER or OWNER role" in rotation.get("readinessReceiptRule", "")
    and "both roles for both the outbound dispatch tuple" in rotation.get("readinessReceiptRule", "")
    and "SVC-PEP-HRM-008 caller-purpose tuple" in rotation.get("readinessReceiptRule", "")
    and "all six role receipts for SVC-PEP-APR-002, SVC-PEP-HRM-010 and SVC-AUT-HRM-013"
    in rotation.get("readinessReceiptRule", "")
    and "common fence effectiveAt" in rotation.get("readinessReceiptRule", ""),
    "rotation readiness receipt cardinality or paired-binding coverage drift",
)
readiness = rotation.get("readinessReceiptProfile", {})
require(
    readiness.get("schemaName") == "HrisServiceGrantRotationReadinessReceiptV1"
    and readiness.get("schemaVersion") == 1
    and len(readiness.get("fields", [])) == 26
    and "observedDrainActivityRevision" in readiness.get("fields", [])
    and "drainQuietSince" in readiness.get("fields", [])
    and "readinessEligibleAt" in readiness.get("fields", [])
    and "readinessObservationSha256" in readiness.get("fields", [])
    and "callerWorkloadId" in readiness.get("identity", "")
    and "ownerWorkloadId" in readiness.get("identity", "")
    and "bindingPurpose" in readiness.get("identity", "")
    and "attestingServiceRole" in readiness.get("identity", "")
    and "quiesceFenceId" in readiness.get("identity", "")
    and "quiesceRevision" in readiness.get("identity", "")
    and "tuple array" in readiness.get("identity", "")
    and "multi-role receipt" in readiness.get("identity", ""),
    "rotation readiness receipt identity or field closure drift",
)
require(
    "every field except evidenceSha256" in readiness.get("evidenceDigestRule", "")
    and "pendingCount is exactly 0" in readiness.get("evidenceDigestRule", "")
    and "oldestPendingAt MUST be the sole JSON null field" in readiness.get("evidenceDigestRule", "")
    and "Null is forbidden for every other field" in readiness.get("evidenceDigestRule", "")
    and "CALLER receipt counts every old-tuple" in readiness.get("pendingScopeRule", "")
    and "OWNER receipt counts every old-tuple" in readiness.get("pendingScopeRule", "")
    and "repeatable-read transaction" in readiness.get("pendingScopeRule", "")
    and "cannot be represented as zero" in readiness.get("pendingScopeRule", "")
    and "Activity after observation invalidates the receipt at Auth"
    in readiness.get("pendingScopeRule", "")
    and "detached compact JWS" in readiness.get("proofCarrier", "")
    and "protected..signature" in readiness.get("proofCarrier", "")
    and "shared across receipts is forbidden" in readiness.get("proofCarrier", "")
    and "RFC 7515 signing input" in readiness.get("proofPayloadRule", "")
    and "base64url(exact proof-claim bytes)" in readiness.get("proofPayloadRule", "")
    and "may be regenerated" in readiness.get("proofPayloadRule", ""),
    "rotation readiness digest or proof-carrier drift",
)
require(
    readiness.get("proofProtectedHeaders", {}).get("requiredExactly")
    == ["alg", "typ", "kid"]
    and readiness.get("proofProtectedHeaders", {}).get("constants")
    == {"alg": "RS256", "typ": "DWP-HRM013-ROTATION-READINESS-JWT"}
    and len(readiness.get("proofClaims", [])) == 29
    and "observedDrainActivityRevision" in readiness.get("proofClaims", [])
    and "drainQuietSince" in readiness.get("proofClaims", [])
    and "readinessEligibleAt" in readiness.get("proofClaims", [])
    and "readinessObservationSha256" in readiness.get("proofClaims", [])
    and "at most 300 seconds" in readiness.get("proofRule", "")
    and "iat minus observedAt is between 0 and 5 seconds" in readiness.get("proofRule", "")
    and "receipt expiresAt is after observedAt and no later than proof exp"
    in readiness.get("proofRule", "")
    and "current caller key for attestingServiceRole CALLER"
    in readiness.get("proofRule", "")
    and "exact Auth-computable digest" in readiness.get("proofRule", "")
    and "exact Auth values with a 65-second interval" in readiness.get("proofRule", ""),
    "rotation readiness signature, freshness or role-key binding drift",
)
require(
    "one unexpired zero-pending receipt for each attestingServiceRole"
    in readiness.get("coverageRule", "")
    and "Pair closure is bidirectional" in readiness.get("coverageRule", "")
    and "SVC-PEP-APR-002, SVC-PEP-HRM-010 or SVC-AUT-HRM-013"
    in readiness.get("coverageRule", "")
    and "all three exact waiver dependency tuples" in readiness.get("coverageRule", "")
    and "all six role receipts" in readiness.get("coverageRule", "")
    and "one-sided coverage fails closed" in readiness.get("coverageRule", "")
    and "unexpired drain authorization" in readiness.get("coverageRule", "")
    and "post-observation activity" in readiness.get("coverageRule", "")
    and "atomically reserves separate tenant-scoped" in readiness.get("replayAndDigestRule", "")
    and "sorts receipts by bindingId, callerWorkloadId, ownerWorkloadId, bindingPurpose, attestingServiceRole, serviceWorkloadId and evidenceSha256"
    in readiness.get("replayAndDigestRule", "")
    and "partial reservation" in readiness.get("replayAndDigestRule", ""),
    "rotation readiness coverage, replay or aggregate digest drift",
)
require(
    "Approval V60 is forbidden" in rotation.get("v59CompatibilityRule", "")
    and "three-member authoritative Auth waiver dependency grant set"
    in rotation.get("v59CompatibilityRule", "")
    and "SVC-AUT-HRM-013 remains Auth-owned" in rotation.get("v59CompatibilityRule", "")
    and "must finish before a planned cutover" in rotation.get("v59CompatibilityRule", ""),
    "V59 grant rotation compatibility drift",
)
require(
    "new approvalRequestId" in rotation.get("emergencyRevocationRule", "")
    and "never waits for quiesce or readiness receipts" in rotation.get("emergencyRevocationRule", "")
    and "revokes every tuple of an affected task pair or three-member waiver dependency group in one transaction"
    in rotation.get("emergencyRevocationRule", "")
    and "Automatic rebind" in rotation.get("emergencyRevocationRule", ""),
    "emergency grant revocation recovery drift",
)

phases = gate.get("futureExecutionTopology", {}).get("phases", [])
require([item.get("order") for item in phases] == [1, 2, 3, 4, 4, 5, 6], "execution phase order drift")
require(
    [item.get("lane") for item in phases[:5]]
    == [
        "SHARED_CONTRACT",
        "AUTH_PRODUCT_AUTHORIZATION_V62_GENERATION_PREP",
        "AUTH_SERVICE_GRANT_REQUESTER_AND_STEP_UP_CONTROL_PLANE",
        "APPROVAL_RUNTIME",
        "PEOPLE_OWNER_AND_RUNTIME",
    ],
    "execution lane order drift",
)
successor_rule = gate.get("nextExecutionAuthorityPrerequisites", {}).get(
    "validatorSuccessorRule", ""
)
successor_contract = gate.get("nextExecutionAuthorityPrerequisites", {}).get(
    "validatorSuccessorCarrierContract", {}
)
carrier_lifecycle = gate.get("validationStrategy", {}).get("carrierLifecycle", {})
require(
    "Before any backend source commit" in successor_rule
    and EXPECTED_SUCCESSOR_VALIDATOR_PATH in successor_rule
    and "unrelated frontend commit" in successor_rule
    and "ignored or untracked local file" in successor_rule
    and "exact append-only v3 service-binding register" in successor_rule
    and "intermediate or terminal symlink, noncanonical path" in successor_rule
    and "validator invocation path and Git top-level must resolve to the same non-symlink frontend root"
    in successor_rule
    and "shell control operator" in successor_rule
    and "unique non-merge commit" in carrier_lifecycle.get("carrierDiscovery", "")
    and "exact four-validator chain" in carrier_lifecycle.get("initialStrictMode", "")
    and "exactly three path-unique artifact pins"
    in carrier_lifecycle.get("initialStrictMode", "")
    and EXPECTED_SUCCESSOR_VALIDATOR_PATH in carrier_lifecycle.get("successorUnlock", "")
    and "byte-preserving eight-row v3 service-binding register append"
    in carrier_lifecycle.get("successorUnlock", "")
    and "Ignored or untracked files, symlinks, path aliases and shell failure masking cannot unlock it"
    in carrier_lifecycle.get("successorUnlock", "")
    and "it no longer freezes legitimate later HEADs"
    in carrier_lifecycle.get("historicalMode", ""),
    "gate carrier lifecycle or successor unlock drift",
)
expected_successor_dir = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-runtime-contract-authority-r1"
)
expected_successor_authority_path = (
    f"{expected_successor_dir}/hrm-013-runtime-contract-execution-authority.v1.json"
)
expected_successor_review_path = f"{expected_successor_dir}/independent-review.v1.json"
expected_successor_register_path = (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-owner-runtime-execution-r1/"
    "service-api-auth-binding-register.successor.v3.csv"
)
require(
    successor_contract.get("authorityPath") == expected_successor_authority_path
    and successor_contract.get("validatorPath") == EXPECTED_SUCCESSOR_VALIDATOR_PATH
    and successor_contract.get("independentReviewPath") == expected_successor_review_path
    and successor_contract.get("serviceBindingRegisterPath")
    == expected_successor_register_path
    and successor_contract.get("authoritySchema")
    == "dwp.hris.wave7.hrm013-runtime-contract-execution-authority.v1"
    and successor_contract.get("reviewSchema")
    == "dwp.hris.wave7.hrm013-runtime-contract-execution-authority-independent-review.v1"
    and successor_contract.get("authorityState")
    == "INDEPENDENTLY_REVIEWED_HASH_BOUND_SHARED_CONTRACT_EXECUTION_AUTHORITY"
    and successor_contract.get("reviewDecision")
    == "GO_FOR_SHARED_CONTRACT_EXECUTION_AUTHORITY_CARRIER_COMMIT_AND_PUSH_ONLY"
    and successor_contract.get("lane") == "SHARED_CONTRACT"
    and set(successor_contract.get("exactChangedPaths", []))
    == {
        "package.json",
        expected_successor_authority_path,
        expected_successor_review_path,
        EXPECTED_SUCCESSOR_VALIDATOR_PATH,
        expected_successor_register_path,
    }
    and "all four successor artifacts" in successor_contract.get("directParentRule", "")
    and "Current successor authority, validator, review and v3 register bytes"
    in successor_contract.get("predecessorPinRule", "")
    and "exact expected cardinality and a closed path-unique set"
    in successor_contract.get("predecessorPinRule", "")
    and "sealedServiceBindingRegister matches serviceBindingRegisterSuccessor exactly"
    in successor_contract.get("scopeRule", "")
    and "authorizes no migration, Auth generation or runtime lane"
    in successor_contract.get("scopeRule", "")
    and "validator invocation path and git rev-parse --show-toplevel resolve to the identical non-symlink frontend root"
    in successor_contract.get("scriptGrammarRule", "")
    and "every cumulative component from that root through each command and all four successor artifacts is non-symlink"
    in successor_contract.get("scriptGrammarRule", "")
    and "Shell alternatives, redirections, substitutions, options, path aliases and duplicate canonical paths are forbidden"
    in successor_contract.get("scriptGrammarRule", ""),
    "hash-bound successor carrier contract drift",
)

source_allowlists = gate.get("futureSourceAllowlists", {})
auth_existing = set(source_allowlists.get("auth", {}).get("existingMayModify", []))
require(
    {
        "scripts/generate-product-authorization-contracts.py",
        "scripts/generate-product-authorization-fixtures.py",
        "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPepProjectionLineage.java",
        "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPepProjectionLoader.java",
        "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalPilotPepRegistry.java",
    }
    <= auth_existing,
    "product-authorization v62 input or Approval PEP allowlist incomplete",
)
require(
    "dwp-approval-server/src/main/resources/product-authorization/approval-pilot-pep-v62.generated.json"
    in source_allowlists.get("auth", {}).get("generatedAndMigration", []),
    "Approval PEP v62 generated artifact missing",
)
require(
    "Hrm013RequesterIdentityIngressFilter.java"
    in source_allowlists.get("auth", {}).get("newClasses", []),
    "requester exact-header ingress filter allowlist missing",
)
require(
    {
        "HrisServiceGrantQuiesceService.java",
        "HrisServiceGrantRotationReadinessVerifier.java",
        "HrisServiceGrantAuthorityOwnerCredentialProvider.java",
    }
    <= set(source_allowlists.get("auth", {}).get("newClasses", [])),
    "Auth quiesce or rotation verifier source allowlist missing",
)
for path in (
    "dwp-auth-server/src/main/java/com/dwp/services/auth/workflowruntime/WorkflowRuntimeBindings.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/workflowruntime/WorkflowRuntimeAuthorityService.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/workflowruntime/WorkflowRuntimeAdmissionLink.java",
    "dwp-auth-server/src/main/java/com/dwp/services/auth/service/WorkflowRuntimeIdentityAuthorityBridge.java",
):
    require(path in auth_existing, f"Auth workflow-runtime allowlist missing: {path}")
approval_existing = set(source_allowlists.get("approval", {}).get("existingMayModify", []))
for path in (
    "dwp-approval-server/src/main/java/com/dwp/services/approval/domain/ApprovalWorkflowRuntimeSource.java",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/workflowauthority/WorkflowRuntimeBindingContract.java",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalWorkflowQuorumBodyFilter.java",
    "dwp-approval-server/src/main/java/com/dwp/services/approval/security/ApprovalWorkflowQuorumCommandMetadata.java",
):
    require(path in approval_existing, f"Approval workflow-runtime allowlist missing: {path}")
require(
    "Hrm013RequesterIdentityClient.java"
    in source_allowlists.get("approval", {}).get("newClasses", []),
    "Approval requester identity client allowlist missing",
)
require(
    {"Hrm013TaskDispatchOutboxStore.java", "Hrm013TaskDispatchRelay.java", "Hrm013TaskDispatchClient.java"}
    <= set(source_allowlists.get("people", {}).get("newClasses", [])),
    "People task-dispatch producer allowlist incomplete",
)
dispatch_owners = source_allowlists.get("taskDispatchOwners", {})
require(
    dispatch_owners.get("authority")
    == "MAXIMUM_PHASE_6_ALLOWLIST_ONLY_NO_SOURCE_OR_MIGRATION_AUTHORITY",
    "task-owner future allowlist grants or loses authority",
)
require(
    all(
        "migrationCandidateNotReserved" in dispatch_owners.get(lane, {})
        for lane in ("time", "payroll", "authIdentityTask")
    ),
    "task-owner deferred migration candidates incomplete",
)

register = gate.get("nextExecutionAuthorityPrerequisites", {}).get(
    "serviceBindingRegisterSuccessor", {}
)
expected_register_header = [
    "binding_id",
    "module",
    "source_operation_id",
    "method",
    "owner_path",
    "owner_service",
    "source_contract",
    "source_authorization_alias",
    "contract_scope",
    "caller_service_identities",
    "workload_authentication",
    "tenant_propagation",
    "purpose_codes",
    "allowed_consumers",
    "field_projection",
    "transport_controls",
    "audit_binding",
    "replay_idempotency",
    "in_process_consumer",
    "in_process_port",
    "in_process_controls",
    "in_process_projection",
    "in_process_test_allocation",
    "state",
]
required_register_rows = expand_required_register_rows(register)
require(
    register.get("repositoryPath") == expected_successor_register_path
    and register.get("predecessor")
    == {
        "path": "docs/06-delivery/hris/wave7-2026-10-17/r7-batch-06-hrm013-callback-binding-r1/service-api-auth-binding-register.successor.v2.csv",
        "bytes": 10190,
        "sha256": "15b52f3cd3867aefa79f02cdf83441d9d5220836344391574cc42a8bdbde7e37",
    }
    and register.get("appendCount") == 8
    and register.get("requiredSourceContract")
    == "../r7-batch-06-hrm013-owner-runtime-binding-gate-r1/hrm-013-owner-runtime-binding-gate.v1.json"
    and register.get("requiredState")
    == "SEALED_DESIGN_HRM013_OWNER_RUNTIME_SHARED_AUTHORITY_REQUIRED_NOT_IMPLEMENTED"
    and register.get("requiredHeader") == expected_register_header
    and len(required_register_rows) == 8
    and canonical_digest(required_register_rows)
    == "720ac954b8f5f45b520900a1e078bc1cb5b5750dc79745f714fb994dab9765ea"
    and register.get("requiredRowsSha256")
    == "720ac954b8f5f45b520900a1e078bc1cb5b5750dc79745f714fb994dab9765ea"
    and register.get("requiredNewBindings")
    == [
        "SVC-AUT-HRM-011",
        "SVC-AUT-HRM-012",
        "SVC-AUT-HRM-013",
        "SVC-PEP-TIM-004",
        "SVC-PEP-PAY-002",
        "SVC-AUT-HRM-014",
        "SVC-AUT-HRM-015",
        "SVC-AUT-HRM-016",
    ]
    and [row.get("binding_id") for row in required_register_rows]
    == register.get("requiredNewBindings")
    and "preserves every v2 row byte-for-byte" in register.get("rule", "")
    and "across all 24 requiredHeader columns" in register.get("rule", "")
    and "ordered expanded rows equal requiredRowsSha256" in register.get("rule", "")
    and "independently reviewed before a shared/Auth token is executable"
    in register.get("rule", ""),
    "service-binding successor path, predecessor pin or append closure drift",
)
test_allowlists = gate.get("futureTargetTestAllowlists", {})
require(
    {
        "dwp-approval-server/src/test/java/com/dwp/services/approval/security/Hrm013DedicatedApproveRouteContractTest.java",
        "dwp-approval-server/src/crossServiceTest/java/com/dwp/services/approval/workflowauthority/WorkflowRuntimeActualAuthHttpTest.java",
        "dwp-approval-server/src/test/java/com/dwp/services/approval/hrisbridge/separation/Hrm013RequesterIdentityClientTest.java",
        "dwp-approval-server/src/test/java/com/dwp/services/approval/hrisbridge/separation/HrisSeparationWorkloadCredentialProviderTest.java",
        "dwp-approval-server/src/test/java/com/dwp/services/approval/hrisbridge/separation/HrisSeparationDrainContinuationOutboxPostgresTest.java",
        "dwp-approval-server/src/test/java/com/dwp/services/approval/hrisbridge/separation/HrisSeparationGrantRotationDrainPostgresTest.java",
    }
    <= set(test_allowlists.get("approval", [])),
    "Approval route, requester or credential tests missing",
)
require(
    {
        "dwp-people-server/src/test/java/com/dwp/services/people/hris/separation/hrm013/Hrm013TaskDispatchContractTest.java",
        "dwp-people-server/src/test/java/com/dwp/services/people/hris/separation/hrm013/Hrm013TaskDispatchAtomicityPostgresTest.java",
        "dwp-people-server/src/test/java/com/dwp/services/people/hris/separation/hrm013/Hrm013TaskDispatchCallbackGrantFencePostgresTest.java",
        "dwp-people-server/src/test/java/com/dwp/services/people/hris/separation/hrm013/Hrm013TaskDispatchRelayTest.java",
    }
    <= set(test_allowlists.get("people", [])),
    "People task-dispatch tests missing",
)
require(
    {
        "dwp-time-server/src/test/java/com/dwp/services/time/hris/separation/hrm013/Hrm013TimeTaskDispatchIngressFilterTest.java",
        "dwp-payroll-server/src/test/java/com/dwp/services/payroll/hris/separation/hrm013/Hrm013PayrollTaskDispatchIngressFilterTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hris/separation/hrm013/Hrm013IdentityTaskDispatchIngressFilterTest.java",
        "dwp-time-server/src/test/java/com/dwp/services/time/hris/separation/hrm013/Hrm013TimeCallbackAuthorityTest.java",
        "dwp-payroll-server/src/test/java/com/dwp/services/payroll/hris/separation/hrm013/Hrm013PayrollCallbackAuthorityTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hris/separation/hrm013/Hrm013IdentityCallbackAuthorityTest.java",
        "dwp-time-server/src/test/java/com/dwp/services/time/hris/separation/hrm013/Hrm013TimeDrainContinuationCallbackTest.java",
        "dwp-payroll-server/src/test/java/com/dwp/services/payroll/hris/separation/hrm013/Hrm013PayrollDrainContinuationCallbackTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hris/separation/hrm013/Hrm013IdentityDrainContinuationCallbackTest.java",
    }
    <= set(test_allowlists.get("taskDispatchOwners", []))
    and len(test_allowlists.get("taskDispatchOwners", [])) == 30,
    "task-owner Phase-6 test closure drift",
)
require(
    "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/Hrm013RequesterIdentityIngressFilterTest.java"
    in test_allowlists.get("auth", []),
    "requester exact-header negative test allowlist missing",
)
require(
    {
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/HrisServiceGrantQuiescePostgresTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/HrisServiceGrantDrainActivityPostgresTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/HrisServiceGrantReadinessObservationTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/HrisServiceGrantDrainAuthorizationExpiryRaceTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/HrisServiceGrantAuthLocalRoleOperationTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/Hrm013RequesterIdentityDrainAuthorityTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/HrisServiceGrantCoupledBindingRotationTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/HrisServiceGrantWaiverDependencyGroupRotationTest.java",
        "dwp-auth-server/src/test/java/com/dwp/services/auth/hrisservicegrant/HrisServiceGrantRotationReadinessVerifierTest.java",
    }
    <= set(test_allowlists.get("auth", [])),
    "Auth quiesce, coupled pair or readiness tests missing",
)

acceptance = gate.get("targetedAcceptanceMatrix", [])
require(len(acceptance) == 12, "acceptance criterion count is not twelve")
require(
    [item.get("id") for item in acceptance]
    == [f"HRM013-RBG-{number:02d}" for number in range(1, 13)],
    "acceptance criterion identity drift",
)
acceptance_by_id = {item.get("id"): item.get("criterion", "") for item in acceptance}
require(
    "sealed APR-002 and HRM-010 cross-store comparison map"
    in acceptance_by_id.get("HRM013-RBG-05", "")
    and "local grant_revision, two-member grant_digest and recorded_at never alias"
    in acceptance_by_id.get("HRM013-RBG-05", "")
    and "SVC-AUT-HRM-013 remains Auth-only"
    in acceptance_by_id.get("HRM013-RBG-05", "")
    and "exact Approval projection comparison and digest non-alias"
    in acceptance_by_id.get("HRM013-RBG-12", "")
    and "HrisSeparationGrantRotationDrainPostgresTest"
    in acceptance_by_id.get("HRM013-RBG-12", "")
    and "HrisServiceGrantWaiverDependencyGroupRotationTest"
    in acceptance_by_id.get("HRM013-RBG-12", ""),
    "Approval projection comparison acceptance or named test closure drift",
)

authority = gate.get("authority", {})
require(
    authority == EXPECTED_GATE_AUTHORITY,
    "gate authority map drift or unrecognized authority key",
)
require(
    gate.get("nextAction")
    == "INDEPENDENTLY_REVIEW_AND_COMMIT_PUSH_THIS_GATE_CARRIER_ONLY_THEN_PREPARE_SEQUENTIAL_HASH_BOUND_EXECUTION_AUTHORITIES_FOR_SHARED_HRM013_CONTRACT_THEN_AUTH_V62_GENERATION_PREP;RESERVE_AND_AUTHOR_AUTH_V271_ONLY_AFTER_THE_GENERATION_RECEIPT_WITHOUT_STARTING_APPROVAL_OR_PEOPLE_RUNTIME",
    "next action exceeds the prepared gate",
)

carrier_commit = ""
if not args.authoring:
    carrier_candidates = text(
        FRONTEND,
        "git",
        "log",
        "--diff-filter=A",
        "--format=%H",
        "--",
        str(GATE_PATH.relative_to(FRONTEND)),
    ).splitlines()
    require(
        len(carrier_candidates) == 1,
        "gate carrier add commit is missing or ambiguous",
    )
    if len(carrier_candidates) == 1:
        carrier_commit = carrier_candidates[0]

frontend_head = text(FRONTEND, "git", "rev-parse", "HEAD")
historical_mode = bool(not args.authoring and carrier_commit and frontend_head != carrier_commit)

require(
    review.get("schema") == "dwp.hris.wave7.hrm013-owner-runtime-binding-gate-independent-review.v1",
    "review schema drift",
)
verdict = review.get("finalVerdict", {})
require(verdict.get("p0") == 0, "independent review has P0 findings")
require(verdict.get("p1") == 0, "independent review has P1 findings")
require(verdict.get("p2") == 0, "independent review has P2 findings")
require(
    verdict.get("decision") == "GO_FOR_GATE_CARRIER_COMMIT_AND_PUSH_ONLY",
    "independent review decision drift",
)
review_pin_items = review.get("artifactPins", [])
pins = {item.get("path"): (item.get("bytes"), item.get("sha256")) for item in review_pin_items}
require(
    len(review_pin_items) == 3
    and len(pins) == 3
    and set(pins) == {GATE_PATH.name, Path(__file__).name, "package.json"},
    "review artifact pin set is not closed or path-unique",
)
expected_gate_pin = (
    digest_git_blob(FRONTEND, carrier_commit, str(GATE_PATH.relative_to(FRONTEND)))
    if historical_mode
    else digest_file(GATE_PATH)
)
expected_validator_pin = (
    digest_git_blob(FRONTEND, carrier_commit, str(Path(__file__).resolve().relative_to(FRONTEND)))
    if historical_mode
    else digest_file(Path(__file__).resolve())
)
require(pins.get(GATE_PATH.name) == expected_gate_pin, "review gate pin drift")
require(pins.get(Path(__file__).name) == expected_validator_pin, "review validator pin drift")
expected_package_pin = (
    digest_file(FRONTEND / "package.json")
    if args.authoring or not carrier_commit
    else digest_git_blob(FRONTEND, carrier_commit, "package.json")
)
require(
    pins.get("package.json") == expected_package_pin,
    "review package.json pin drift",
)
review_authority = review.get("authority", {})
require(
    review_authority == EXPECTED_REVIEW_AUTHORITY,
    "review authority map drift or unrecognized authority key",
)

if historical_mode:
    require(
        digest_file(GATE_PATH) == expected_gate_pin,
        "immutable carrier gate drift after the reviewed add commit",
    )
    require(
        digest_file(Path(__file__).resolve()) == expected_validator_pin,
        "immutable carrier validator drift after the reviewed add commit",
    )
    require(
        digest_file(REVIEW_PATH)
        == digest_git_blob(FRONTEND, carrier_commit, str(REVIEW_PATH.relative_to(FRONTEND))),
        "immutable carrier independent review drift after the reviewed add commit",
    )

successor_commit = ""
if historical_mode:
    successor_paths = [
        successor_contract.get("authorityPath", ""),
        successor_contract.get("validatorPath", ""),
        successor_contract.get("independentReviewPath", ""),
        successor_contract.get("serviceBindingRegisterPath", ""),
    ]
    successor_add_commits: list[str] = []
    for relative_path in successor_paths:
        require(bool(relative_path), "successor carrier path is missing")
        require(
            is_symlink_free_repo_path(FRONTEND, relative_path),
            f"successor carrier path contains a symlink or noncanonical segment: {relative_path}",
        )
        tracked = run(
            FRONTEND,
            "git",
            "ls-files",
            "--error-unmatch",
            "--",
            relative_path,
            check=False,
        )
        require(tracked.returncode == 0, f"successor carrier artifact is not Git-tracked: {relative_path}")
        add_candidates = text(
            FRONTEND,
            "git",
            "log",
            "--diff-filter=A",
            "--format=%H",
            "--",
            relative_path,
        ).splitlines()
        require(
            len(add_candidates) == 1,
            f"successor carrier artifact add commit is missing or ambiguous: {relative_path}",
        )
        if len(add_candidates) == 1:
            successor_add_commits.append(add_candidates[0])
    require(
        len(successor_add_commits) == 4 and len(set(successor_add_commits)) == 1,
        "successor authority, validator, review and service-binding register were not introduced together",
    )
    if len(successor_add_commits) == 4 and len(set(successor_add_commits)) == 1:
        successor_commit = successor_add_commits[0]

    successor_parent_line = (
        text(FRONTEND, "git", "rev-list", "--parents", "-n", "1", successor_commit).split()
        if successor_commit
        else []
    )
    require(
        len(successor_parent_line) == 2 and successor_parent_line[1] == carrier_commit,
        "successor carrier must be a non-merge direct child of this gate carrier",
    )
    require(
        bool(successor_commit) and is_ancestor(FRONTEND, successor_commit, frontend_head),
        "successor carrier is not an ancestor of frontend HEAD",
    )
    successor_changed_paths = set(
        filter(
            None,
            text(FRONTEND, "git", "diff", "--name-only", f"{carrier_commit}..{successor_commit}").splitlines()
            if successor_commit
            else [],
        )
    )
    require(
        successor_changed_paths == set(successor_contract.get("exactChangedPaths", [])),
        "successor carrier commit contains missing or unauthorized paths",
    )

    for relative_path in successor_paths:
        tree_entry = (
            text(FRONTEND, "git", "ls-tree", successor_commit, "--", relative_path).split()
            if successor_commit
            else []
        )
        require(
            bool(tree_entry) and tree_entry[0] in {"100644", "100755"},
            f"successor carrier artifact is missing or has unsafe Git mode: {relative_path}",
        )
        current_tree_entry = text(
            FRONTEND, "git", "ls-tree", frontend_head, "--", relative_path
        ).split()
        current_path = FRONTEND / relative_path
        require(
            bool(current_tree_entry)
            and current_tree_entry[0] in {"100644", "100755"}
            and current_path.is_file()
            and not current_path.is_symlink(),
            f"successor carrier artifact missing, symlinked or has unsafe current Git mode: {relative_path}",
        )
        if current_path.is_file() and successor_commit:
            require(
                digest_file(current_path) == digest_git_blob(FRONTEND, successor_commit, relative_path),
                f"immutable successor carrier artifact drift: {relative_path}",
            )

    successor_package: dict[str, Any] = {}
    if successor_commit:
        package_blob = run(
            FRONTEND,
            "git",
            "show",
            f"{successor_commit}:package.json",
            check=False,
        )
        try:
            successor_package = json.loads(package_blob.stdout.decode("utf-8")) if package_blob.returncode == 0 else {}
        except (UnicodeDecodeError, json.JSONDecodeError):
            successor_package = {}
    require(
        successor_package.get("scripts", {}).get("hris:current-contracts:check")
        == EXPECTED_SUCCESSOR_SCRIPT_PREFIX,
        "successor carrier package does not contain the exact five-validator chain",
    )

    predecessor_register = register.get("predecessor", {})
    predecessor_register_path = FRONTEND / predecessor_register.get("path", "")
    successor_register_path = FRONTEND / successor_contract.get(
        "serviceBindingRegisterPath", ""
    )
    require(
        predecessor_register_path.is_file()
        and digest_file(predecessor_register_path)
        == (predecessor_register.get("bytes"), predecessor_register.get("sha256")),
        "service-binding register v2 predecessor pin drift",
    )
    predecessor_register_bytes = (
        predecessor_register_path.read_bytes() if predecessor_register_path.is_file() else b""
    )
    successor_register_bytes = (
        successor_register_path.read_bytes() if successor_register_path.is_file() else b""
    )
    require(
        bool(predecessor_register_bytes)
        and successor_register_bytes.startswith(predecessor_register_bytes),
        "service-binding register v3 does not preserve v2 bytes exactly",
    )
    successor_fieldnames: list[str] | None = None
    try:
        predecessor_reader = csv.DictReader(
            io.StringIO(predecessor_register_bytes.decode("utf-8"), newline="")
        )
        predecessor_rows = list(predecessor_reader)
        successor_reader = csv.DictReader(
            io.StringIO(successor_register_bytes.decode("utf-8"), newline="")
        )
        successor_rows = list(successor_reader)
        successor_fieldnames = successor_reader.fieldnames
        register_headers_match = (
            predecessor_reader.fieldnames is not None
            and successor_reader.fieldnames == predecessor_reader.fieldnames
        )
    except (UnicodeDecodeError, csv.Error):
        predecessor_rows = []
        successor_rows = []
        successor_fieldnames = None
        register_headers_match = False
    appended_rows = successor_rows[len(predecessor_rows) :]
    require(
        register_headers_match
        and successor_fieldnames == expected_register_header
        and len(appended_rows) == register.get("appendCount")
        and len(successor_rows) == len(predecessor_rows) + register.get("appendCount", -1)
        and appended_rows == required_register_rows
        and canonical_digest(appended_rows) == register.get("requiredRowsSha256")
        and len({row.get("binding_id") for row in successor_rows}) == len(successor_rows)
        and all(value not in {None, ""} for row in appended_rows for value in row.values()),
        "service-binding register v3 full 24-column canonical row closure drift",
    )

    successor_authority_path = FRONTEND / successor_contract.get("authorityPath", "")
    successor_review_path = FRONTEND / successor_contract.get("independentReviewPath", "")
    successor_authority = load_json(successor_authority_path) if successor_authority_path.is_file() else {}
    successor_review = load_json(successor_review_path) if successor_review_path.is_file() else {}
    require(
        successor_authority.get("schema") == successor_contract.get("authoritySchema")
        and successor_authority.get("state") == successor_contract.get("authorityState")
        and successor_authority.get("lane") == successor_contract.get("lane")
        and successor_authority.get("authorizedSourcePaths")
        == gate.get("decisions", {}).get("sharedContractOwnership", {}).get("files")
        and successor_authority.get("authorizedTestPaths")
        == gate.get("decisions", {}).get("sharedContractOwnership", {}).get("tests")
        and successor_authority.get("sealedServiceBindingRegister")
        == {
            "path": successor_contract.get("serviceBindingRegisterPath"),
            "predecessor": register.get("predecessor"),
            "appendCount": register.get("appendCount"),
            "appendedBindingIds": register.get("requiredNewBindings"),
            "appendedRowsSha256": register.get("requiredRowsSha256"),
            "bytes": len(successor_register_bytes),
            "sha256": hashlib.sha256(successor_register_bytes).hexdigest(),
        }
        and successor_authority.get("authority") == successor_contract.get("authority"),
        "successor shared-contract execution authority scope or authority drift",
    )
    carrier_pin_paths = [
        str(GATE_PATH.relative_to(FRONTEND)),
        str(Path(__file__).resolve().relative_to(FRONTEND)),
        str(REVIEW_PATH.relative_to(FRONTEND)),
        "package.json",
    ]
    expected_carrier_pins = {
        relative_path: digest_git_blob(FRONTEND, carrier_commit, relative_path)
        for relative_path in carrier_pin_paths
    }
    predecessor = successor_authority.get("predecessorCarrier", {})
    predecessor_pin_items = predecessor.get("artifactPins", [])
    predecessor_pins = {
        item.get("path"): (item.get("bytes"), item.get("sha256"))
        for item in predecessor_pin_items
    }
    require(
        predecessor.get("commit") == carrier_commit
        and len(predecessor_pin_items) == len(expected_carrier_pins)
        and len(predecessor_pins) == len(expected_carrier_pins)
        and predecessor_pins == expected_carrier_pins,
        "successor authority predecessor carrier pins drift",
    )

    successor_verdict = successor_review.get("finalVerdict", {})
    require(
        successor_review.get("schema") == successor_contract.get("reviewSchema")
        and successor_verdict.get("p0") == 0
        and successor_verdict.get("p1") == 0
        and successor_verdict.get("p2") == 0
        and successor_verdict.get("decision") == successor_contract.get("reviewDecision")
        and successor_review.get("authority") == successor_contract.get("reviewAuthority"),
        "successor independent review verdict or authority drift",
    )
    expected_successor_pins = {
        relative_path: digest_git_blob(FRONTEND, successor_commit, relative_path)
        for relative_path in [
            successor_contract.get("authorityPath", ""),
            successor_contract.get("validatorPath", ""),
            successor_contract.get("serviceBindingRegisterPath", ""),
            "package.json",
        ]
    }
    successor_review_pin_items = successor_review.get("artifactPins", [])
    successor_review_pins = {
        item.get("path"): (item.get("bytes"), item.get("sha256"))
        for item in successor_review_pin_items
    }
    require(
        len(successor_review_pin_items) == len(expected_successor_pins)
        and len(successor_review_pins) == len(expected_successor_pins)
        and successor_review_pins == expected_successor_pins,
        "successor independent review artifact pins drift",
    )

if not historical_mode:
    port_path = BACKEND / "dwp-people-server/src/main/java/com/dwp/services/people/hris/separation/hrm013/Hrm013ServiceAuthorityPort.java"
    require(port_path.is_file(), "Hrm013ServiceAuthorityPort missing")
    if port_path.is_file():
        port_text = port_path.read_text(encoding="utf-8")
        require("No production provider is bound" in port_text, "authority-port prerequisite comment drift")
    implementations = []
    for path in (BACKEND / "dwp-people-server/src/main/java").rglob("*.java"):
        if path == port_path:
            continue
        if "implements Hrm013ServiceAuthorityPort" in path.read_text(encoding="utf-8"):
            implementations.append(path)
    require(not implementations, "production Hrm013ServiceAuthorityPort implementation appeared before execution authority")

    require(
        (BACKEND / "dwp-auth-server/src/main/resources/db/migration/V270__declare_hris_hrm013_v61_authorization_seed.sql").is_file(),
        "Auth V270 prerequisite missing",
    )
    require(
        not (BACKEND / "dwp-auth-server/src/main/resources/db/migration/V271__create_hris_service_grant_authority.sql").exists(),
        "Auth V271 exists before execution authority",
    )
    require(
        not list((BACKEND / "dwp-approval-server/src/main/resources/db/migration").glob("V60*")),
        "Approval V60 appeared despite prohibition",
    )
    require(
        not list((BACKEND / "dwp-people-server/src/main/resources/db/migration").glob("V62*")),
        "People V62 appeared despite prohibition",
    )

package = load_json(FRONTEND / "package.json")
script = package.get("scripts", {}).get("hris:current-contracts:check", "")
if historical_mode:
    command_parts = script.split(" && ")
    carrier_command_parts = EXPECTED_HRIS_CONTRACT_SCRIPT.split(" && ")
    validator_command_pattern = re.compile(
        r"python3 (docs/06-delivery/hris/[A-Za-z0-9._/-]+/validate_[A-Za-z0-9_]+\.py)"
    )
    command_matches = [validator_command_pattern.fullmatch(part) for part in command_parts]
    command_paths = [match.group(1) for match in command_matches if match]
    hris_docs_root = (FRONTEND / "docs/06-delivery/hris").resolve()
    canonical_command_paths = [
        PurePosixPath(relative_path).as_posix() == relative_path
        and all(part not in {"", ".", ".."} for part in PurePosixPath(relative_path).parts)
        and (FRONTEND / relative_path).resolve().is_relative_to(hris_docs_root)
        and is_symlink_free_repo_path(FRONTEND, relative_path)
        for relative_path in command_paths
    ]
    require(
        " && ".join(command_parts) == script
        and len(command_parts) >= 5
        and command_parts[:4] == carrier_command_parts
        and command_parts[4] == f"python3 {EXPECTED_SUCCESSOR_VALIDATOR_PATH}"
        and len(command_matches) == len(command_paths)
        and all(command_matches)
        and all(canonical_command_paths)
        and len(command_paths) == len(set(command_paths)),
        "historical mode contract script violates the sealed validator command grammar",
    )
    require(
        all(
            run(
                FRONTEND,
                "git",
                "ls-files",
                "--error-unmatch",
                "--",
                relative_path,
                check=False,
            ).returncode == 0
            and (FRONTEND / relative_path).is_file()
            and not (FRONTEND / relative_path).is_symlink()
            and (
                lambda entry: bool(entry) and entry[0] in {"100644", "100755"}
            )(
                text(FRONTEND, "git", "ls-tree", frontend_head, "--", relative_path).split()
            )
            for relative_path in command_paths
        ),
        "historical mode contains an untracked, missing, symlinked or unsafe-mode validator command",
    )
else:
    require(
        script == EXPECTED_HRIS_CONTRACT_SCRIPT,
        "standard HRIS contract gate command drift",
    )

require(text(BACKEND, "git", "branch", "--show-current") == "dwp-dev", "backend checkout is not dwp-dev")
require(text(BACKEND, "git", "rev-parse", f"{BACKEND_BASE}^{{tree}}") == BACKEND_TREE, "backend pinned tree drift")
backend_head = text(BACKEND, "git", "rev-parse", "HEAD")
backend_origin = text(BACKEND, "git", "rev-parse", "origin/dwp-dev")
if historical_mode:
    require(is_ancestor(BACKEND, BACKEND_BASE, backend_head), "backend HEAD lost the audited base")
    require(is_ancestor(BACKEND, BACKEND_BASE, backend_origin), "backend origin lost the audited base")
else:
    require(backend_head == BACKEND_BASE, "backend HEAD moved before successor authority")
    require(backend_origin == BACKEND_BASE, "backend origin moved before successor authority")

require(text(FRONTEND, "git", "branch", "--show-current") == "dwp-dev", "frontend checkout is not dwp-dev")
require(text(FRONTEND, "git", "rev-parse", f"{FRONTEND_BASE}^{{tree}}") == FRONTEND_TREE, "frontend pinned tree drift")

require(text(AGENT, "git", "branch", "--show-current") == "dwp-dev", "agent checkout is not dwp-dev")
agent_head = text(AGENT, "git", "rev-parse", "HEAD")
agent_origin = text(AGENT, "git", "rev-parse", "origin/dwp-dev")
if historical_mode:
    require(is_ancestor(AGENT, AGENT_BASE, agent_head), "agent HEAD lost the audited base")
    require(is_ancestor(AGENT, AGENT_BASE, agent_origin), "agent origin lost the audited base")
else:
    require(agent_head == AGENT_BASE, "agent HEAD drift before successor authority")
    require(agent_origin == AGENT_BASE, "agent origin drift before successor authority")

require(run(BACKEND, "git", "status", "--porcelain=v1", "-z").stdout == b"", "backend repository is not clean")
require(run(AGENT, "git", "status", "--porcelain=v1", "-z").stdout == b"", "agent repository is not clean")
front_status = run(
    FRONTEND,
    "git",
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
).stdout.decode().split("\0")
front_entries = {entry for entry in front_status if entry}
if args.authoring:
    allowed = {
        " M package.json",
        f"?? {GATE_PATH.relative_to(FRONTEND)}",
        f"?? {REVIEW_PATH.relative_to(FRONTEND)}",
        f"?? {Path(__file__).resolve().relative_to(FRONTEND)}",
    }
    require(front_entries == allowed, "authoring mode found missing or extra frontend changes")
    require(text(FRONTEND, "git", "rev-parse", "HEAD") == FRONTEND_BASE, "authoring HEAD moved beyond audited frontend base")
    require(text(FRONTEND, "git", "rev-parse", "origin/dwp-dev") == FRONTEND_BASE, "authoring origin moved beyond audited frontend base")
else:
    require(not front_entries, "frontend repository is not clean")
    front_origin = text(FRONTEND, "git", "rev-parse", "origin/dwp-dev")
    require(frontend_head == front_origin, "frontend dwp-dev and origin/dwp-dev differ")
    require(bool(carrier_commit), "gate carrier commit is unavailable")
    parent_line = (
        text(FRONTEND, "git", "rev-list", "--parents", "-n", "1", carrier_commit).split()
        if carrier_commit
        else []
    )
    require(
        len(parent_line) == 2 and parent_line[1] == FRONTEND_BASE,
        "gate carrier must be a non-merge direct child of the audited frontend base",
    )
    require(
        bool(carrier_commit) and is_ancestor(FRONTEND, carrier_commit, frontend_head),
        "immutable gate carrier is not an ancestor of frontend HEAD",
    )
    require(
        bool(carrier_commit)
        and text(FRONTEND, "git", "rev-list", "--count", f"{FRONTEND_BASE}..{carrier_commit}") == "1",
        "gate carrier is not exactly one commit after the audited frontend base",
    )
    expected_paths = {
        "package.json",
        str(GATE_PATH.relative_to(FRONTEND)),
        str(REVIEW_PATH.relative_to(FRONTEND)),
        str(Path(__file__).resolve().relative_to(FRONTEND)),
    }
    changed_paths = set(
        filter(
            None,
            text(FRONTEND, "git", "diff", "--name-only", f"{FRONTEND_BASE}..{carrier_commit}").splitlines()
            if carrier_commit
            else [],
        )
    )
    require(changed_paths == expected_paths, "gate carrier commit contains missing or unauthorized paths")

result = {
    "validator": Path(__file__).name,
    "mode": (
        "AUTHORING"
        if args.authoring
        else "HISTORICAL_CLEAN"
        if historical_mode
        else "INITIAL_CARRIER_STRICT"
    ),
    "state": "PASS" if not errors else "FAIL",
    "checks": checks,
    "errorsCount": len(errors),
    "p0": len(errors),
    "acceptanceConditions": len(acceptance),
    "implementationAuthority": False,
    "errors": errors,
}
print(json.dumps(result, ensure_ascii=False, sort_keys=True))
sys.exit(0 if not errors else 1)
