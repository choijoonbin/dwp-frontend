#!/usr/bin/env python3
"""Validate the final HRM-013 paired prerequisite central integration receipt."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parents[4]
BACKEND = Path("/Users/a10697/Work/DWP/dwp-backend")
EMPTY_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
FRONTEND_HEAD = "3ae4671e4d98c768a5426ae9eb2bb28ac2701f2f"
FRONTEND_TREE = "954675861ed2d211f47deb0394aefc3bc3016a53"
BACKEND_HEAD = "c50b267e7b015758ab6f7acc7fdf353eee81e631"
BACKEND_TREE = "22bd6533ab340cfb91c6cf5ab5fd6991e501e6c4"
APPROVAL_MERGE = "7b5bf40d5af3a8875e353f07bb56c4ad40fe8e9b"
APPROVAL_LANE = "ef69ffd6fb608941053e1ca48a5a7a137bd0088e"
PEOPLE_LANE = "2d814d42d07079429d265c2e534df9715685575f"
BASE = "fe2842a36d13709e6aecc27011a8f0ad3c770ce8"

ADMISSION_ARTIFACTS = {
    "paired-prerequisite-central-admission-decision.v1.json": (13356, "65f1d6858f547dd0bcd24b9b465cf5b4e5e657c38ad8365f9e2e4f0b830edf2c"),
    "paired-prerequisite-central-admission-independent-review-evidence.v1.json": (6670, "80eeb059969169f78469363160d18411b3e4c2ac3d42d3b8e5575d1ad648bdc1"),
    "validate_hrm013_paired_prerequisite_central_admission.py": (15671, "4aaad1405dd81a1ba3de5436c3353e0c8b5fc75d5f3e5a138fe2314c3562fc4a"),
}

TEST_XML = {
    "dwp-approval-server/build/test-results/test/TEST-com.dwp.services.approval.hrisbridge.separation.HrisSeparationWaiverMigrationPostgresTest.xml": (63713, "91a73b9b40fe84a1f8bb441957d3698b47e1fd7438241e3dc03d757a249c0a80", 3),
    "dwp-approval-server/build/test-results/test/TEST-com.dwp.services.approval.hrisbridge.separation.HrisSeparationWaiverStoresPostgresTest.xml": (175759, "fe04a7a2a94d2e92904ae0eb4ac589f0a67674f381b46f2ed1d3a6a2fd363547", 10),
    "dwp-approval-server/build/test-results/test/TEST-com.dwp.services.approval.hrisbridge.HrisEmployeeChangeBridgeMigrationPostgresTest.xml": (23848, "b6d7596b461845fed2d1513d61c00e986c1c6130a532375f6596c41e0e9cda01", 1),
    "dwp-approval-server/build/test-results/test/TEST-com.dwp.services.approval.hrisbridge.HrisApprovalBindingLedgerPostgresTest.xml": (18479, "2ebdb49d22216a44091e25c898adefb0151d0e4ca4b0b0e5750496fc4c541be2", 1),
    "dwp-people-server/build/test-results/test/TEST-com.dwp.services.people.hris.separation.hrm013.Hrm013PrerequisiteStoresPostgresTest.xml": (74063, "0e793d435d35691aeb305aadd323b979f5cd513398e4dff34dda777a737869d0", 4),
    "dwp-people-server/build/test-results/test/TEST-com.dwp.services.people.hris.separation.hrm013.Hrm013ServiceAuthorityPortTest.xml": (859, "a26b2a8063695ba9040922f3b22aa0eb424dba57945f4447e49c2fa6f7694ff6", 3),
    "dwp-people-server/build/test-results/test/TEST-com.dwp.services.people.hris.separation.hrm013.Hrm013V61MigrationContractTest.xml": (1269, "5ddf3fd5fef6ed3286a094e92ef3943516b0bfd1f01afbb83335bad17e0fa61a", 5),
    "dwp-people-server/build/test-results/test/TEST-com.dwp.services.people.hris.separation.hrm013.Hrm013V61MigrationPostgresTest.xml": (149601, "38b38d6eda3fca7110cd168f96ea146d25e00b89433f30275a2367e9bfda9f63", 7),
    "dwp-people-server/build/test-results/test/TEST-com.dwp.services.people.integration.Hrm012V60MigrationPostgresTest.xml": (45176, "1831bf235f5a3f40bbc2e4cb1ee8c292b28a1faddccf26a892c7559a8cc70a74", 2),
}


def run(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[bytes]:
    result = subprocess.run(args, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise RuntimeError(f"{' '.join(args)} failed in {cwd}: {result.stderr.decode(errors='replace').strip()}")
    return result


def text(cwd: Path, *args: str) -> str:
    return run(cwd, *args).stdout.decode().strip()


def digest_bytes(data: bytes) -> tuple[int, str]:
    return len(data), hashlib.sha256(data).hexdigest()


def digest_file(path: Path) -> tuple[int, str]:
    return digest_bytes(path.read_bytes())


errors: list[str] = []
checks = 0


def require(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        errors.append(message)


for relative, expected in ADMISSION_ARTIFACTS.items():
    require((HERE / relative).is_file(), f"missing admission artifact: {relative}")
    if (HERE / relative).is_file():
        require(digest_file(HERE / relative) == expected, f"admission artifact drift: {relative}")

require(text(FRONTEND, "git", "branch", "--show-current") == "dwp-dev", "frontend checkout is not dwp-dev")
require(text(FRONTEND, "git", "rev-parse", "HEAD") == FRONTEND_HEAD, "frontend admission carrier HEAD drift")
require(text(FRONTEND, "git", "rev-parse", "HEAD^{tree}") == FRONTEND_TREE, "frontend admission carrier tree drift")
require(text(FRONTEND, "git", "rev-parse", "origin/dwp-dev") == FRONTEND_HEAD, "frontend origin/dwp-dev drift")
frontend_remote = run(FRONTEND, "git", "ls-remote", "origin", "refs/heads/dwp-dev").stdout
require(digest_bytes(frontend_remote) == (60, "34f348336d2c17a0d4463e36e41ce2c8d9f6ff9bcb9753528caa57a8177cbfb8"), "frontend remote push proof drift")

require(text(BACKEND, "git", "branch", "--show-current") == "dwp-dev", "backend checkout is not dwp-dev")
require(text(BACKEND, "git", "rev-parse", "HEAD") == BACKEND_HEAD, "backend final HEAD drift")
require(text(BACKEND, "git", "rev-parse", "HEAD^{tree}") == BACKEND_TREE, "backend final tree drift")
require(text(BACKEND, "git", "rev-parse", "origin/dwp-dev") == BACKEND_HEAD, "backend origin/dwp-dev drift")
backend_status = run(BACKEND, "git", "status", "--porcelain=v1").stdout
require(backend_status == b"", "backend dwp-dev is not clean")
require(hashlib.sha256(backend_status).hexdigest() == EMPTY_SHA, "backend porcelain digest drift")
backend_remote = run(BACKEND, "git", "ls-remote", "origin", "refs/heads/dwp-dev").stdout
require(digest_bytes(backend_remote) == (60, "dec60a3d9453cb6290bce3cff209579c641078916205e91d82df67080a45270c"), "backend remote push proof drift")

require(text(BACKEND, "git", "rev-parse", f"{APPROVAL_MERGE}^1") == BASE, "Approval merge first parent drift")
require(text(BACKEND, "git", "rev-parse", f"{APPROVAL_MERGE}^2") == APPROVAL_LANE, "Approval merge second parent drift")
require(text(BACKEND, "git", "rev-parse", f"{APPROVAL_MERGE}^{{tree}}") == "db13f4a08005d37905f1b42f1e992eec8185c118", "Approval merge tree drift")
require(text(BACKEND, "git", "rev-parse", f"{BACKEND_HEAD}^1") == APPROVAL_MERGE, "People merge first parent drift")
require(text(BACKEND, "git", "rev-parse", f"{BACKEND_HEAD}^2") == PEOPLE_LANE, "People merge second parent drift")
approval_commit_object = run(BACKEND, "git", "cat-file", "commit", APPROVAL_MERGE).stdout
people_commit_object = run(BACKEND, "git", "cat-file", "commit", BACKEND_HEAD).stdout
tree_listing = run(BACKEND, "git", "ls-tree", "-r", "-z", BACKEND_TREE).stdout
require(digest_bytes(approval_commit_object) == (309, "494659df1270be08c37518a42860481dd8e78403ed44e8d96b027e899264e2c5"), "Approval merge commit object drift")
require(digest_bytes(people_commit_object) == (307, "f7d84b285438bb76131b7cbb4c1e9d41707292961b8b6989be762be1e49bc920"), "People merge commit object drift")
require(digest_bytes(tree_listing) == (1125946, "b63cf83ccc729181bc74498bdc52630793c3a42204f8c4cb2f0cc4a386bd35c3"), "combined tree listing drift")
for ancestor in (BASE, APPROVAL_LANE, PEOPLE_LANE, APPROVAL_MERGE):
    require(run(BACKEND, "git", "merge-base", "--is-ancestor", ancestor, BACKEND_HEAD, check=False).returncode == 0, f"missing final ancestry: {ancestor}")

total_tests = total_failures = total_errors = total_skipped = 0
for relative, (size, sha256, expected_tests) in TEST_XML.items():
    path = BACKEND / relative
    require(path.is_file(), f"missing test XML: {relative}")
    if not path.is_file():
        continue
    require(digest_file(path) == (size, sha256), f"test XML byte/hash drift: {relative}")
    suite = ET.parse(path).getroot()
    tests = int(suite.attrib.get("tests", "0"))
    failures = int(suite.attrib.get("failures", "0"))
    suite_errors = int(suite.attrib.get("errors", "0"))
    skipped = int(suite.attrib.get("skipped", "0"))
    require(tests == expected_tests, f"test count drift: {relative}")
    require(failures == 0 and suite_errors == 0 and skipped == 0, f"nonzero failure/error/skip: {relative}")
    total_tests += tests
    total_failures += failures
    total_errors += suite_errors
    total_skipped += skipped

hrm012 = ET.parse(BACKEND / "dwp-people-server/build/test-results/test/TEST-com.dwp.services.people.integration.Hrm012V60MigrationPostgresTest.xml").getroot()
hrm012_names = {case.attrib["name"] for case in hrm012.findall("testcase")}
require(hrm012_names == {"cleanMigrationThroughV60BuildsOnlyTheTwoTablesAndLockedControls()", "upgradeFromV59PreservesRowsAndEveryHistoricalChecksum()"}, "HRM-012 XML contains tests outside the exact two methods")
require((total_tests, total_failures, total_errors, total_skipped) == (36, 0, 0, 0), "aggregate test result is not 36/0/0/0")

receipt_path = HERE / "paired-prerequisite-central-integration-receipt.v1.json"
require(receipt_path.is_file(), "central integration receipt missing")
if receipt_path.is_file():
    receipt = json.loads(receipt_path.read_text(encoding="utf-8"))
    require(receipt["state"] == "PAIRED_PREREQUISITE_INTEGRATION_COMPLETE_RUNTIME_MODULE_OWNER_FULL_HRM013_AND_BUSINESS_COMPLETION_WITHHELD", "receipt state drift")
    require(receipt["backendFinal"]["head"] == BACKEND_HEAD and receipt["backendFinal"]["tree"] == BACKEND_TREE, "receipt backend final pin drift")
    require(receipt["verification"]["aggregate"] == {"tests": 36, "failures": 0, "errors": 0, "skipped": 0}, "receipt aggregate test evidence drift")
    own = digest_file(Path(__file__).resolve())
    require(receipt["artifactPins"]["validator"] == {"path": Path(__file__).name, "bytes": own[0], "sha256": own[1]}, "receipt validator pin drift")
    authority = receipt["authority"]
    require(authority["pairedPrerequisiteIntegrationComplete"] is True, "prerequisite integration not marked complete")
    require(authority["nextOwnerRuntimeBindingGatePreparationAuthorized"] is True, "next-gate preparation is not authorized")
    for key in ("nextOwnerRuntimeBindingGateImplementationAuthorized", "runtimeActivationAuthorized", "controllerOrRelayActivationAuthorized", "moduleOwnerPacketAuthorized", "fullHrm013ModuleImplementationAuthorized", "frontendUiMenuOrRouteAuthorized", "featureEnablementAuthorized", "tenantEnrollmentAuthorized", "runtimeCredentialBindingAuthorized", "productionBindingAuthorized", "productionReleaseAuthorized", "businessCompletionClaimed"):
        require(authority[key] is False, f"forbidden final authority true: {key}")
    require(authority["businessCompletionCredit"] == 0, "business completion credit must remain zero")
    require(receipt["nextAction"] == "PREPARE_AND_INDEPENDENTLY_REVIEW_THE_NEXT_OWNER_RUNTIME_BINDING_GATE_CARRIER_WITHOUT_STARTING_ITS_IMPLEMENTATION", "next action exceeds gate preparation")

result = {"validator": Path(__file__).name, "state": "PASS" if not errors else "FAIL", "checks": checks, "tests": total_tests, "failures": total_failures, "errorsCount": total_errors, "skipped": total_skipped, "p0": len(errors), "errors": errors}
print(json.dumps(result, ensure_ascii=False, sort_keys=True))
sys.exit(0 if not errors else 1)
