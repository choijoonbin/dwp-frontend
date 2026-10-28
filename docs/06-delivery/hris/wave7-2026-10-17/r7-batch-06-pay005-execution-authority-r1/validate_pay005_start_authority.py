#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
RECEIPT = HERE / "worktree-materialization-receipt.v1.json"
LEASE = HERE / "migration-lease-v57-active.v1.json"
TOKEN = HERE / "implementation-token.v1.json"
REVIEW = HERE / "independent-start-review.v1.json"


def digest(path: Path) -> tuple[str, int]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)


def require(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


receipt = json.loads(RECEIPT.read_text())
lease = json.loads(LEASE.read_text())
token = json.loads(TOKEN.read_text())
review = json.loads(REVIEW.read_text())

require(receipt["state"] == "MATERIALIZED_CLEAN_EXACT_PACKET_PINS_NO_SOURCE_EDITS_NO_UPSTREAM", "receipt state drift")
require(lease["state"] == "ACTIVE_EXCLUSIVE", "lease not active")
require(token["state"] == "ACTIVE_EXECUTABLE_EXACT_WORKTREES_V57_AND_BOUNDED_PAY005_SOURCE_ONLY", "token not executable")
require(receipt["sliceId"] == lease["sliceId"] == token["sliceId"] == "BASE-TFR-PAY-005", "slice drift")
require(lease["lease"]["version"] == "V57" and lease["lease"]["activeLeaseCountForVersion"] == 1, "lease cardinality drift")
require(token["implementationContract"]["migration"]["createExactly"] == ["pay_tax_result_facts"], "schema delta drift")
require(token["acceptanceContract"]["requiredCount"] == 12, "acceptance count drift")

for artifact, pins in ((receipt, receipt["immutablePredecessors"]), (lease, lease["predecessorPins"]), (token, token["predecessorPins"])):
    for pin in pins.values():
        path = HERE / pin["path"]
        sha, size = digest(path)
        require((sha, size) == (pin["sha256"], pin["bytes"]), f"predecessor drift: {path}")

for name, worktree in token["exactExecutionWorktrees"].items():
    repo = Path(worktree["path"])
    require(repo.is_dir(), f"missing {name} worktree")
    require(git(repo, "branch", "--show-current") == worktree["branch"], f"{name} branch drift")
    require(git(repo, "rev-parse", "HEAD") == worktree["initialHead"], f"{name} head drift")
    require(git(repo, "rev-parse", "HEAD^{tree}") == worktree["initialTree"], f"{name} tree drift")
    porcelain = subprocess.check_output(["git", "-C", str(repo), "status", "--porcelain=v1"])
    require(hashlib.sha256(porcelain).hexdigest() == worktree["initialPorcelainSha256"], f"{name} porcelain drift")
    upstream = subprocess.run(["git", "-C", str(repo), "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], capture_output=True, text=True)
    require(upstream.returncode != 0 and worktree["initialUpstream"] is None, f"{name} upstream drift")

for key in ("dwpAgentWriteAuthorized", "centralProductAuthorizationWriteAuthorized", "authGatewaySharedSecurityShellMenuOrI18nWriteAuthorized", "directDwpDevMergeAuthorized", "routeOrMenuMountAuthorized", "featureEnablementAuthorized", "tenantEnrollmentAuthorized", "officialLegalRateOrProviderBindingAuthorized", "fullSliceCompletionAuthorized", "productionReleaseAuthorized"):
    require(token["authority"][key] is False, f"unsafe token authority {key}")

receipt_sha, receipt_bytes = digest(RECEIPT)
lease_sha, lease_bytes = digest(LEASE)
token_sha, token_bytes = digest(TOKEN)
validator_sha, validator_bytes = digest(Path(__file__).resolve())
require(review["receiptPin"] == {"sha256": receipt_sha, "bytes": receipt_bytes}, "review receipt pin drift")
require(review["leasePin"] == {"sha256": lease_sha, "bytes": lease_bytes}, "review lease pin drift")
require(review["tokenPin"] == {"sha256": token_sha, "bytes": token_bytes}, "review token pin drift")
require(review["validatorPin"] == {"sha256": validator_sha, "bytes": validator_bytes}, "review validator pin drift")
require(review["decision"] == "GO_TO_BOUNDED_PAY005_MODULE_IMPLEMENTATION", "review decision drift")
require(review["severityCounts"] == {"P0": 0, "P1": 0, "P2": 0}, "review finding drift")
print("PASS: PAY-005 clean worktrees, active exclusive V57 lease and bounded executable token are exact.")
