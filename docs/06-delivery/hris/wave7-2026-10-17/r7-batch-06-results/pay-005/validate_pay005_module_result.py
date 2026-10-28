#!/usr/bin/env python3
import hashlib
import json
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).resolve().parent
FRONTEND = HERE.parents[5]
BACKEND = Path("/Users/a10697/Work/DWP/.codex-worktrees/hris/wave7-20261028/batch06/pay005/backend")
EVIDENCE = HERE / "module-result-evidence.v1.json"
REVIEW = HERE / "independent-review.v1.json"


def require(value: bool, message: str) -> None:
    if not value:
        raise AssertionError(message)


def git(repo: Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True).strip()


def digest(path: Path) -> tuple[str, int]:
    data = path.read_bytes()
    return hashlib.sha256(data).hexdigest(), len(data)


e = json.loads(EVIDENCE.read_text())
r = json.loads(REVIEW.read_text())
require(e["state"] == "IMPLEMENTED_TARGETED_VERIFICATION_PASS_MODULE_BRANCHES_PUSHED_CENTRAL_REVIEW_PENDING", "state drift")
require(len(e["acceptanceMapping"]) == 12 and all(x["state"] == "PASS" for x in e["acceptanceMapping"]), "acceptance drift")
require(e["verification"]["independentReview"]["frontend"]["decision"] == "GO", "frontend review not GO")
require(e["verification"]["independentReview"]["backend"]["decision"] == "GO", "backend review not GO")

for key, repo in (("frontend", FRONTEND), ("backend", BACKEND)):
    pin = e["repositories"][key]
    commit_key = "sourceCommit" if key == "frontend" else "finalCommit"
    tree_key = "sourceTree" if key == "frontend" else "finalTree"
    commit = pin[commit_key]
    require(git(repo, "rev-parse", f"{commit}^{{tree}}") == pin[tree_key], f"{key} tree drift")
    remote = pin["remoteRef"]
    subprocess.check_call(["git", "-C", str(repo), "merge-base", "--is-ancestor", commit, remote])
    changed = git(repo, "diff", "--name-only", f'{pin["baseCommit"]}..{commit}').splitlines()
    require(sorted(changed) == sorted(pin["changedPaths"]), f"{key} changed-path drift")

xml_dir = BACKEND / "dwp-payroll-server/build/test-results/test"
xml_files = sorted(xml_dir.glob("TEST-*.xml"))
require(len(xml_files) == 9, "backend XML count drift")
tests = failures = errors = skipped = 0
for path in xml_files:
    suite = ET.parse(path).getroot()
    tests += int(suite.attrib["tests"])
    failures += int(suite.attrib["failures"])
    errors += int(suite.attrib["errors"])
    skipped += int(suite.attrib["skipped"])
require((tests, failures, errors, skipped) == (47, 0, 0, 0), "backend bounded result drift")

e_sha, e_bytes = digest(EVIDENCE)
v_sha, v_bytes = digest(Path(__file__).resolve())
require(r["evidencePin"] == {"sha256": e_sha, "bytes": e_bytes}, "review evidence pin drift")
require(r["validatorPin"] == {"sha256": v_sha, "bytes": v_bytes}, "review validator pin drift")
require(r["decision"] == "GO_TO_CENTRAL_INTEGRATION_AUTHORITY", "review decision drift")
require(r["severityCounts"] == {"P0": 0, "P1": 0, "P2": 0}, "review findings remain")
print("PASS: PAY-005 module results, exact paths, 12 criteria, 47 backend tests and independent GO are sealed.")
