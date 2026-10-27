#!/usr/bin/env python3
"""Fail-closed validator for the sealed HRM-013 final matrix result."""
from __future__ import annotations

import hashlib
import json
import stat
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[5]
HERE = Path(__file__).resolve().parent
BACKEND = Path(
    "/Users/a10697/Work/DWP/.codex-worktrees/hris/"
    "wave7-20261027/batch06/hrm013-phase6/integration"
)
RECEIPT = HERE / "final-matrix-result-receipt.v1.json"
REVIEW = HERE / "independent-review.v1.json"
AUTHORITY = ROOT / (
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-final-matrix-authority-r1/"
    "final-matrix-execution-authority.v1.json"
)
FRONTEND_BASE = "665e7857239acc852b8e6af19341b0047df26964"
FRONTEND_BASE_TREE = "36769e95abfb11ee4d2bf3726931832ba6fda8a2"
BACKEND_HEAD = "2a765439beb50d40f91eb65c5350984cfc4b52de"
BACKEND_TREE = "4c57372f0ebb8f62db3ef8ab469ab6c5eb5e4bbd"
AUTHORITY_BYTES = 23324
AUTHORITY_SHA256 = "8664710f8e0e9573ad4fb3d84186e0530d8b9ac2ed9dc0d80d68e739c4463e36"
RECEIPT_BYTES = 8860
RECEIPT_SHA256 = "647cef84024d66720f5bcf48c99bb14ed548e731f5d85f0d806dcc093e1e321f"
XML_MANIFEST_SHA256 = "07bd27c699668bb11d54464cdcf21609843e969b3f2f2846101f468137196153"
ACCEPTANCE_SHA256 = "72c40f9a0a7ec19cc4b27e3caec7443a4d653a2aa42546113601af32f64f383b"

ARTIFACTS = {
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-final-matrix-result-r1/"
    "final-matrix-result-receipt.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-final-matrix-result-r1/independent-review.v1.json",
    "docs/06-delivery/hris/wave7-2026-10-17/"
    "r7-batch-06-hrm013-final-matrix-result-r1/"
    "validate_hrm013_final_matrix_result.py",
}

RESULT_DIRECTORIES = (
    ("platform", "dwp-platform-contracts/build/test-results/test", 4, 5),
    ("auth", "dwp-auth-server/build/test-results/test", 4, 4),
    ("approval", "dwp-approval-server/build/test-results/test", 5, 5),
    ("people", "dwp-people-server/build/test-results/test", 5, 7),
    (
        "cross",
        "dwp-approval-server/build/test-results/crossServiceTest",
        1,
        1,
    ),
)

EXPECTED_TESTCASES = {
    "com.dwp.platform.contract.HrisServiceGrantAuthorityV1Test#"
    "canonicalNewWorkAndDrainRequestsRoundTripWithExactConditionalFields()",
    "com.dwp.platform.contract.Hrm013RequesterIdentityAuthorityV1Test#"
    "requesterAdmissionBindsTenantApprovalRootActorRevisionsAndNewWork()",
    "com.dwp.platform.contract.Hrm013SeparationBridgeV1Test#"
    "roundTripsEveryClosedBodyAndReceiptWithStableDigests()",
    "com.dwp.platform.contract.Hrm013WorkloadProofV1Test#"
    "enforcesNewWorkAbsenceAndAllSevenDrainExistingClaims()",
    "com.dwp.platform.contract.Hrm013WorkloadProofV1Test#"
    "verifiesExactNewWorkProofAndPreservesResolveReplayRecheckOrder()",
    "com.dwp.services.auth.hrisservicegrant."
    "HrisServiceGrantAuthLocalRoleOperationTest#"
    "authLocalAdmissionAcceptsOnlyTheAuthSideAndNeverUsesResolverReplay()",
    "com.dwp.services.auth.hrisservicegrant."
    "HrisServiceGrantAuthorityProofVerifierTest#"
    "leafProofProducesUnreservedReplayEvidenceWithoutAuthorityRead()",
    "com.dwp.services.auth.hrisservicegrant."
    "Hrm013RequesterIdentityAuthorityControllerTest#"
    "admitUsesOkAndPreservesCanonicalNoStoreBody()",
    "com.dwp.services.auth.hrisservicegrant."
    "Hrm013RequesterIdentityProofVerifierTest#"
    "verifiesGrantProofThenReservesReplayThenRechecksAuthority()",
    "com.dwp.services.approval.hrisbridge.separation."
    "HrisSeparationApprovalBridgePostgresTest#"
    "exactApr002ReplayReturnsTheOriginalReceiptAndRejectsByteDrift()",
    "com.dwp.services.approval.hrisbridge.separation."
    "HrisSeparationApprovalControllerTest#"
    "preservesExactBytesAndReturnsOnlyTheStoredNoStoreReceipt()",
    "com.dwp.services.approval.hrisbridge.separation."
    "HrisSeparationDecisionRelayTest#"
    "postSendPeerFailureClosesTheBodyAndRemainsAmbiguous()",
    "com.dwp.services.approval.hrisbridge.separation."
    "HrisSeparationTerminalDecisionOutboxPostgresTest#"
    "terminalDecisionPersistsOneExactImmutableCallbackAndStepUpAttestation()",
    "com.dwp.services.approval.hrisbridge.separation."
    "Hrm013RequesterIdentityClientTest#"
    "authorityMustRemainLiveThroughTheFullyValidatedResponse()",
    "com.dwp.services.approval.workflowauthority."
    "WorkflowRuntimeActualAuthHttpTest#"
    "clientUsesRealAuthCurrentRoleAndDatabaseRevokesAtTheFixedEndpoint()",
    "com.dwp.services.people.hris.separation.hrm013."
    "Hrm013CallbackIngressFilterTest#"
    "approvedWaiverBindsAllSevenStepUpEvidenceFieldsExactly()",
    "com.dwp.services.people.hris.separation.hrm013."
    "Hrm013ControlPlaneAuthorityAdapterTest#"
    "drainAdmissionMustAttestTheActualPeopleOwnerRole()",
    "com.dwp.services.people.hris.separation.hrm013."
    "Hrm013ControlPlaneAuthorityAdapterTest#"
    "readinessObservationIsBoundToExactPeopleRoleAndTuple()",
    "com.dwp.services.people.hris.separation.hrm013."
    "Hrm013TaskDispatchReceiptHandshakeTest#"
    "allThreeProfilesCompleteAdmissionToCallbackReceiptHandshake()",
    "com.dwp.services.people.hris.separation.hrm013."
    "Hrm013TaskDispatchReceiptHandshakeTest#"
    "crossOwnerCallbackSubstitutionFailsClosed()",
    "com.dwp.services.people.hris.separation.hrm013."
    "Hrm013WaiverRequestRelayPostgresTest#"
    "canonical202ReceiptIsPersistedAndExactReplayIsIdempotent()",
    "com.dwp.services.people.hris.separation.hrm013."
    "Hrm013WorkloadProofVerifierTest#"
    "drainRecheckKeepsExactGrantAndFenceWhileActivityRevisionAdvances()",
}

EXPECTED_TASK_RESULTS = [
    (":dwp-platform-contracts:test", ["P01", "P02", "P03", "P04", "P05"], 4, 5),
    (":dwp-auth-server:test", ["A01", "A02", "A03", "A04"], 4, 4),
    (":dwp-approval-server:test", ["R01", "R02", "R03", "R04", "R05"], 5, 5),
    (":dwp-people-server:test", ["E01", "E02", "E03", "E04", "E05", "E06"], 5, 7),
    (":dwp-approval-server:crossServiceTest", ["X01"], 1, 1),
]


def load(path: Path) -> dict[str, Any]:
    def pairs(items: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in items:
            if key in result:
                raise AssertionError(f"duplicate JSON key in {path}: {key}")
            result[key] = value
        return result

    value = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=pairs)
    if not isinstance(value, dict):
        raise AssertionError(f"JSON root must be an object: {path}")
    return value


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["/usr/bin/git", "-C", str(repo), *args],
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        raise AssertionError(
            f"git {' '.join(args)} failed in {repo}: {result.stderr.strip()}"
        )
    return result.stdout.rstrip()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def mode(path: Path) -> str:
    return f"{stat.S_IMODE(path.stat().st_mode):04o}"


def equal(actual: Any, expected: Any, label: str) -> None:
    if type(actual) is not type(expected) or actual != expected:
        raise AssertionError(f"{label}: expected={expected!r} actual={actual!r}")


def status_paths(repo: Path) -> set[str]:
    paths: set[str] = set()
    for line in git(repo, "status", "--porcelain=v1", "-uall").splitlines():
        if line:
            paths.add(line[3:].split(" -> ")[-1])
    return paths


def xml_results() -> tuple[list[Path], dict[str, dict[str, int]], set[str]]:
    all_files: list[Path] = []
    task_totals: dict[str, dict[str, int]] = {}
    testcases: set[str] = set()
    for label, relative, expected_xml, expected_tests in RESULT_DIRECTORIES:
        files = sorted((BACKEND / relative).glob("TEST-*.xml"))
        equal(len(files), expected_xml, f"{label} XML count")
        totals = {"tests": 0, "failures": 0, "errors": 0, "skipped": 0}
        for path in files:
            root = ET.parse(path).getroot()
            for key in totals:
                totals[key] += int(root.attrib.get(key, "0"))
            for case in root.findall("testcase"):
                identity = f"{case.attrib['classname']}#{case.attrib['name']}"
                if identity in testcases:
                    raise AssertionError(f"duplicate testcase result: {identity}")
                testcases.add(identity)
        equal(totals["tests"], expected_tests, f"{label} test count")
        equal(totals["failures"], 0, f"{label} failures")
        equal(totals["errors"], 0, f"{label} errors")
        equal(totals["skipped"], 0, f"{label} skipped")
        task_totals[label] = totals
        all_files.extend(files)
    return all_files, task_totals, testcases


def xml_manifest(files: list[Path]) -> str:
    lines = [
        f"{sha256(path)}  {path.relative_to(BACKEND).as_posix()}\n"
        for path in files
    ]
    return hashlib.sha256("".join(sorted(lines)).encode("utf-8")).hexdigest()


def main() -> int:
    checks = 0
    authority = load(AUTHORITY)
    receipt = load(RECEIPT)
    review = load(REVIEW)

    equal(AUTHORITY.stat().st_size, AUTHORITY_BYTES, "authority bytes")
    equal(sha256(AUTHORITY), AUTHORITY_SHA256, "authority sha256")
    equal(mode(AUTHORITY), "0644", "authority mode")
    equal(RECEIPT.stat().st_size, RECEIPT_BYTES, "receipt bytes")
    equal(sha256(RECEIPT), RECEIPT_SHA256, "receipt sha256")
    equal(mode(RECEIPT), "0644", "receipt mode")
    equal(mode(REVIEW), "0644", "review mode")
    equal(mode(Path(__file__)), "0644", "validator mode")
    checks += 8

    equal(git(ROOT, "rev-parse", f"{FRONTEND_BASE}^{{tree}}"), FRONTEND_BASE_TREE, "frontend base tree")
    frontend_head = git(ROOT, "rev-parse", "HEAD")
    frontend_origin = git(ROOT, "rev-parse", "origin/dwp-dev")
    dirty = status_paths(ROOT)
    if frontend_head == FRONTEND_BASE:
        equal(frontend_origin, FRONTEND_BASE, "frontend authoring origin")
        equal(ARTIFACTS <= dirty, True, "all result carrier artifacts present")
        unrelated_hris = {
            path
            for path in dirty
            if path.startswith("docs/06-delivery/hris/") and path not in ARTIFACTS
        }
        equal(unrelated_hris, set(), "no unrelated dirty HRIS delivery path")
    else:
        equal(git(ROOT, "merge-base", FRONTEND_BASE, frontend_head), FRONTEND_BASE, "frontend ancestry")
        equal(git(ROOT, "rev-list", "--count", f"{FRONTEND_BASE}..{frontend_head}"), "1", "frontend direct child")
        equal(
            set(git(ROOT, "diff", "--name-only", f"{FRONTEND_BASE}..{frontend_head}").splitlines()),
            ARTIFACTS,
            "result carrier paths",
        )
        equal(dirty & ARTIFACTS, set(), "committed result artifacts clean")
        if frontend_origin not in {FRONTEND_BASE, frontend_head}:
            raise AssertionError(f"frontend origin drift: {frontend_origin}")
    checks += 5

    equal(git(BACKEND, "rev-parse", "HEAD"), BACKEND_HEAD, "backend head")
    equal(git(BACKEND, "rev-parse", "HEAD^{tree}"), BACKEND_TREE, "backend tree")
    equal(git(BACKEND, "rev-parse", "origin/dwp-dev"), BACKEND_HEAD, "backend origin")
    equal(git(BACKEND, "status", "--porcelain=v1", "-uall"), "", "backend clean")
    checks += 4

    equal(authority["backendTarget"]["commit"], BACKEND_HEAD, "authority backend head")
    equal(authority["backendTarget"]["tree"], BACKEND_TREE, "authority backend tree")
    equal(authority["acceptanceMatrix"]["conditionCount"], 12, "authority condition count")
    equal(authority["acceptanceMatrix"]["canonicalCompactJsonSha256"], ACCEPTANCE_SHA256, "acceptance digest")
    equal(len(authority["selectorCatalog"]), 21, "authority selector count")
    equal(len(authority["conditionEvidenceMap"]), 12, "authority condition map count")
    equal(authority["executionPlan"]["invocationCount"], 1, "authority invocation count")
    equal(authority["executionPlan"]["rerunTasksRequired"], True, "authority rerun tasks")
    checks += 8

    repository = receipt["repositoryState"]
    equal(repository["repository"], "dwp-backend", "receipt repository")
    equal(repository["head"], BACKEND_HEAD, "receipt head")
    equal(repository["tree"], BACKEND_TREE, "receipt tree")
    equal(repository["originHead"], BACKEND_HEAD, "receipt origin")
    equal(repository["cleanBefore"], True, "receipt clean before")
    equal(repository["cleanAfter"], True, "receipt clean after")
    equal(receipt["authorityPin"]["bytes"], AUTHORITY_BYTES, "receipt authority bytes")
    equal(receipt["authorityPin"]["sha256"], AUTHORITY_SHA256, "receipt authority sha256")
    checks += 8

    execution = receipt["successfulExecution"]
    expected_execution = {
        "invocationCount": 1,
        "singleGradleInvocation": True,
        "rerunTasks": True,
        "taskScopedSelectorOrdering": True,
        "taskCount": 5,
        "selectorCount": 21,
        "exitCode": 0,
        "buildResult": "BUILD_SUCCESSFUL",
        "xmlFileCount": 19,
        "tests": 22,
        "failures": 0,
        "errors": 0,
        "skipped": 0,
        "selectorSetExact": True,
        "missingSelectorCount": 0,
        "unexpectedSelectorCount": 0,
        "sourceChangedDuringExecution": False,
        "broadRepositoryRerunExecuted": False,
        "unrelatedTaskOrSelectorExecuted": False,
    }
    for key, expected in expected_execution.items():
        equal(execution[key], expected, f"execution {key}")
        checks += 1
    equal(execution["xmlManifestSha256"], XML_MANIFEST_SHA256, "receipt XML manifest")
    if not isinstance(execution["elapsedMilliseconds"], int) or execution["elapsedMilliseconds"] <= 0:
        raise AssertionError("elapsedMilliseconds must be a positive integer")
    checks += 2

    files, task_totals, testcases = xml_results()
    equal(len(files), 19, "live XML count")
    equal(testcases, EXPECTED_TESTCASES, "exact testcase set")
    equal(xml_manifest(files), XML_MANIFEST_SHA256, "live XML manifest")
    equal(sum(value["tests"] for value in task_totals.values()), 22, "live total tests")
    checks += 3 + (len(RESULT_DIRECTORIES) * 6)

    task_results = receipt["taskResults"]
    equal(len(task_results), 5, "receipt task result count")
    for item, (task, selectors, xml_count, tests) in zip(task_results, EXPECTED_TASK_RESULTS):
        equal(item["task"], task, f"task name {task}")
        equal(item["selectorIds"], selectors, f"task selectors {task}")
        equal(item["selectorCount"], len(selectors), f"task selector count {task}")
        equal(item["xmlFileCount"], xml_count, f"task XML count {task}")
        equal(item["tests"], tests, f"task tests {task}")
        equal(item["failures"], 0, f"task failures {task}")
        equal(item["errors"], 0, f"task errors {task}")
        equal(item["skipped"], 0, f"task skipped {task}")
        equal(item["result"], "PASS", f"task result {task}")
        checks += 9

    condition_results = receipt["conditionResults"]
    equal(len(condition_results), 12, "condition result count")
    condition_ids = [item["id"] for item in condition_results]
    equal(len(set(condition_ids)), 12, "unique condition ids")
    equal(condition_ids, [item["id"] for item in authority["acceptanceMatrix"]["conditions"]], "condition order")
    for item in condition_results:
        expected = authority["conditionEvidenceMap"][item["id"]]
        equal(item["result"], "PASS", f"condition result {item['id']}")
        equal(item["selectorIds"], expected["selectorIds"], f"condition selectors {item['id']}")
        equal(item["predecessorEvidence"], expected["predecessorEvidence"], f"condition evidence {item['id']}")
        checks += 3
    equal(receipt["conditionPassCount"], 12, "condition pass count")
    checks += 4

    activation_findings = receipt["activationOnlyOpenConditions"]
    equal(len(activation_findings), 3, "activation-only finding count")
    equal(
        [item["finding"] for item in activation_findings],
        authority["activationOnlyOpenConditions"],
        "activation-only finding text",
    )
    equal(
        {(item["severity"], item["state"]) for item in activation_findings},
        {("P2", "OPEN_BEFORE_ACTIVATION")},
        "activation-only finding classification",
    )
    claim = receipt["claimBoundary"]
    expected_claims = {
        "phase6SourceIntegrationMatrixPassed": True,
        "defaultOff": True,
        "activationOnlyOpenCount": 3,
        "reviewFindings": {"P0": 0, "P1": 0, "P2": 3},
        "activationAuthorized": False,
        "tenantEnrollmentAuthorized": False,
        "runtimeCredentialProvisioningAuthorized": False,
        "liveNetworkHandshakeExecuted": False,
        "productionBindingAuthorized": False,
        "productionReleaseAuthorized": False,
        "hrm013BusinessComplete": False,
        "batch06Complete": False,
        "hrisComplete": False,
        "businessCompletionCredit": 0,
    }
    for key, expected in expected_claims.items():
        equal(claim[key], expected, f"claim boundary {key}")
        checks += 1
    checks += 1

    equal(review["schema"], "dwp.hris.wave7.hrm013-final-matrix-result-independent-review.v1", "review schema")
    equal(review["decision"], "GO_TO_SEAL_DEFAULT_OFF_SOURCE_INTEGRATION_RESULT_ONLY", "review decision")
    equal(review["newSeverityCounts"], {"P0": 0, "P1": 0, "P2": 0}, "new findings")
    equal(review["inheritedActivationOnlySeverityCounts"], {"P0": 0, "P1": 0, "P2": 3}, "inherited findings")
    equal(review["receiptPin"]["bytes"], RECEIPT_BYTES, "review receipt bytes")
    equal(review["receiptPin"]["sha256"], RECEIPT_SHA256, "review receipt sha256")
    equal(review["authorityPin"]["bytes"], AUTHORITY_BYTES, "review authority bytes")
    equal(review["authorityPin"]["sha256"], AUTHORITY_SHA256, "review authority sha256")
    equal(review["validatorPin"]["bytes"], Path(__file__).stat().st_size, "review validator bytes")
    equal(review["validatorPin"]["sha256"], sha256(Path(__file__)), "review validator sha256")
    equal(review["activationOnlyP2"], activation_findings, "review activation findings")
    checks += 13

    print(f"PASS HRM-013 final matrix result: checks={checks}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (
        AssertionError,
        KeyError,
        json.JSONDecodeError,
        ET.ParseError,
        ValueError,
    ) as exc:
        print(f"FAIL HRM-013 final matrix result: {exc}", file=sys.stderr)
        raise SystemExit(1)
