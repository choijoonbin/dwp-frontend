#!/usr/bin/env python3
import hashlib
import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parents[4]
BACKEND = FRONTEND.parent / "dwp-backend"
AUTHORITY = HERE / "backend-rebase-authority.v1.json"
REVIEW = HERE / "independent-review.v1.json"


def require(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def git(*args: str) -> str:
    return subprocess.check_output(["git", "-C", str(BACKEND), *args], text=True).strip()


def digest(path: Path) -> tuple[str, int]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)


a = json.loads(AUTHORITY.read_text())
r = json.loads(REVIEW.read_text())
require(a["state"] == "ACTIVE_EXACT_NON_OVERLAPPING_BACKEND_MERGE_COMMIT_AUTHORIZED", "state drift")
base = a["concurrentBackendAdvance"]["currentDwpDev"]
module = a["pay005Module"]["finalCommit"]
require(git("rev-parse", "origin/dwp-dev") == base, "backend dwp-dev moved again")
require(git("rev-parse", f"{base}^{{tree}}") == a["concurrentBackendAdvance"]["currentTree"], "base tree drift")
require(git("rev-parse", a["pay005Module"]["remoteRef"]) == module, "module ref drift")
require(git("rev-parse", f"{module}^{{tree}}") == a["pay005Module"]["finalTree"], "module tree drift")

old = a["concurrentBackendAdvance"]["previousBase"]
concurrent = set(git("diff", "--name-only", f"{old}..{base}").splitlines())
pay005 = set(git("diff", "--name-only", f"{old}..{module}").splitlines())
require(sorted(concurrent) == sorted(a["concurrentBackendAdvance"]["changedPaths"]), "concurrent paths drift")
require(concurrent.isdisjoint(pay005) and a["mergeProof"]["overlapCount"] == 0, "path overlap")
merged_tree = git("merge-tree", "--write-tree", base, module)
require(merged_tree == a["mergeProof"]["predictedMergedTree"], "merge tree drift")

authority_sha, authority_bytes = digest(AUTHORITY)
validator_sha, validator_bytes = digest(Path(__file__).resolve())
require(r["authorityPin"] == {"sha256": authority_sha, "bytes": authority_bytes}, "review authority pin drift")
require(r["validatorPin"] == {"sha256": validator_sha, "bytes": validator_bytes}, "review validator pin drift")
require(r["decision"] == "GO_TO_EXACT_NON_OVERLAPPING_BACKEND_MERGE", "review decision drift")
require(r["severityCounts"] == {"P0": 0, "P1": 0, "P2": 0}, "review findings")
print("PASS: concurrent Backend advance is non-overlapping; exact no-edit PAY-005 merge is authorized without test rerun.")
